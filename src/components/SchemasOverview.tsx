import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { createSchema, deleteSchema, renameSchema, SchemaValidationError } from '../db/labelSchemas'
import { exportSchemaToFile } from '../lib/schemaExport'
import { importSchemaExport, parseSchemaExport } from '../lib/schemaImport'
import { formatHotkeyRanges } from '../lib/hotkeys'
import { formatWhen } from '../lib/formatDate'
import { ConfirmDialog } from './ConfirmDialog'
import { RenameDialog } from './RenameDialog'
import { SurfaceHeader } from './shell/SurfaceHeader'
import type { LabelSchema } from '../db/types'

const HINT = 'color-mix(in srgb, var(--color-text) 68%, transparent)'

interface SchemasOverviewProps {
  onOpenSchema: (schemaId: string) => void
}

// Creating a schema previously had nowhere to live: the rail only offered
// Import, and the create form sat under the list it fed. Here it is pinned above
// the table (survey finding 5), on this screen, which the rail's group header
// routes to.
export function SchemasOverview({ onOpenSchema }: SchemasOverviewProps) {
  const schemas = useLiveQuery(() => db.labelSchemas.orderBy('updatedAt').reverse().toArray(), [])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<LabelSchema | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LabelSchema | null>(null)

  if (schemas === undefined) return null

  const labelTotal = schemas.reduce((n, s) => n + s.labels.length, 0)

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const text = await file.text()
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        setError(`"${file.name}" is not valid JSON — it couldn’t be parsed at all.`)
        return
      }
      onOpenSchema(await importSchemaExport(parseSchemaExport(json)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const id = await createSchema(newName)
      setNewName('')
      onOpenSchema(id)
    } catch (err) {
      if (err instanceof SchemaValidationError) setError(err.message)
      else throw err
    }
  }

  async function handleRename(name: string) {
    if (!renaming) return
    setError(null)
    try {
      await renameSchema(renaming.id, name)
      setRenaming(null)
    } catch (err) {
      if (err instanceof SchemaValidationError) setError(err.message)
      else throw err
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDelete) return
    setError(null)
    const target = pendingDelete
    setPendingDelete(null)
    try {
      await deleteSchema(target.id)
    } catch (err) {
      if (err instanceof SchemaValidationError) setError(err.message)
      else throw err
    }
  }

  return (
    <>
      <SurfaceHeader
        title={`Label schemas · ${schemas.length}`}
        subtitle={
          schemas.length === 0
            ? undefined
            : `${labelTotal} label${labelTotal === 1 ? '' : 's'} across ${schemas.length} schema${
                schemas.length === 1 ? '' : 's'
              }`
        }
        error={error}
        actions={
          <label className="btn btn-secondary">
            Import schema…
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImport}
              className="sr-only"
            />
          </label>
        }
      />

      <form
        onSubmit={handleCreate}
        style={{
          flex: 'none',
          padding: 'var(--space-4)',
          background: 'var(--color-surface)',
          borderBottom: '2px solid var(--color-divider)',
        }}
      >
        <h3 className="ts-eyebrow" style={{ margin: '0 0 var(--space-3)' }}>
          New schema
        </h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
          <div className="field" style={{ flex: 1, minWidth: 0, maxWidth: 420 }}>
            <label htmlFor="new-schema-name">Schema name</label>
            <input
              id="new-schema-name"
              className="input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. KYC passport"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ minHeight: 36 }}>
            Create
          </button>
        </div>
        <p
          className="mono"
          style={{ margin: 'var(--space-2) 0 0', fontSize: '11.5px', color: HINT }}
        >
          A schema is the set of fields you annotate. Add its labels next.
        </p>
      </form>

      <div
        className="ts-scroll"
        style={{ flex: 1, minHeight: 0, padding: '0 var(--space-4) var(--space-4)' }}
      >
        {schemas.length === 0 ? (
          <p style={{ padding: 'var(--space-4) 0', fontSize: '12.5px', color: HINT }}>
            No label schemas yet. Create one above to define the fields you'll annotate.
          </p>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Schema</th>
                  <th style={{ width: 100 }}>Labels</th>
                  <th style={{ width: 150 }}>Hotkeys set</th>
                  <th style={{ width: 170 }}>Updated</th>
                  <th style={{ width: 210 }}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {schemas.map((schema) => {
                  const hotkeys = formatHotkeyRanges(
                    schema.labels.map((l) => l.hotkey).filter((k): k is string => Boolean(k)),
                  )
                  return (
                    <tr key={schema.id}>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 14, padding: 0, color: 'var(--color-text)' }}
                          onClick={() => onOpenSchema(schema.id)}
                        >
                          {schema.name}
                        </button>
                      </td>
                      <td className="mono" style={{ fontSize: 13 }}>
                        {schema.labels.length}
                      </td>
                      <td className="mono" style={{ fontSize: '12.5px', color: HINT }}>
                        {hotkeys || 'none'}
                      </td>
                      <td style={{ fontSize: '12.5px', color: HINT }}>
                        {formatWhen(schema.updatedAt)}
                      </td>
                      <td>
                        <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            aria-label={`Export ${schema.name}`}
                            onClick={() => exportSchemaToFile(schema.id)}
                          >
                            Export
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            aria-label={`Rename ${schema.name}`}
                            onClick={() => setRenaming(schema)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            aria-label={`Delete ${schema.name}`}
                            onClick={() => setPendingDelete(schema)}
                          >
                            Delete
                          </button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p style={{ margin: 'var(--space-3) 0 0', fontSize: '12.5px', color: HINT }}>
              Deleting a schema is refused while a project still uses it.
            </p>
          </>
        )}
      </div>

      {renaming && (
        <RenameDialog
          title="Rename schema"
          label="Schema name"
          initialValue={renaming.name}
          error={error}
          onSubmit={handleRename}
          onCancel={() => {
            setRenaming(null)
            setError(null)
          }}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete schema"
          message={`Delete "${pendingDelete.name}" and all its labels? This cannot be undone.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
