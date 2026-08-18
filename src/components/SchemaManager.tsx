import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { createSchema, deleteSchema, renameSchema, SchemaValidationError } from '../db/labelSchemas'
import { ConfirmDialog } from './ConfirmDialog'
import { LabelEditor } from './LabelEditor'
import type { LabelSchema } from '../db/types'

export function SchemaManager() {
  const schemas = useLiveQuery(() => db.labelSchemas.orderBy('updatedAt').reverse().toArray(), [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LabelSchema | null>(null)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)
    try {
      const id = await createSchema(newName)
      setNewName('')
      setSelectedId(id)
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        setCreateError(err.message)
      } else {
        throw err
      }
    }
  }

  function startRename(schema: LabelSchema) {
    setRenamingId(schema.id)
    setRenameValue(schema.name)
  }

  async function handleRenameSubmit(e: FormEvent) {
    e.preventDefault()
    if (!renamingId) return
    try {
      await renameSchema(renamingId, renameValue)
      setRenamingId(null)
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        setCreateError(err.message)
      } else {
        throw err
      }
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDelete) return
    setDeleteError(null)
    try {
      await deleteSchema(pendingDelete.id)
      if (selectedId === pendingDelete.id) setSelectedId(null)
      setPendingDelete(null)
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        setDeleteError(err.message)
        setPendingDelete(null)
      } else {
        throw err
      }
    }
  }

  if (schemas === undefined) return null

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
      <aside>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Label schemas</h1>

        {schemas.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            No label schemas yet. Create one to define the fields you'll annotate.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {schemas.map((schema) => (
              <li key={schema.id}>
                {renamingId === schema.id ? (
                  <form onSubmit={handleRenameSubmit} className="flex gap-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => setRenamingId(null)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </form>
                ) : (
                  <div
                    className={`group flex items-center gap-1 rounded-md px-2 py-1.5 ${
                      selectedId === schema.id
                        ? 'bg-indigo-50 dark:bg-indigo-950'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(schema.id)}
                      className="flex-1 truncate text-left text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-100"
                    >
                      {schema.name}
                      <span className="ml-1.5 text-xs text-slate-400">
                        ({schema.labels.length})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startRename(schema)}
                      aria-label={`Rename ${schema.name}`}
                      className="rounded px-1.5 py-0.5 text-xs text-slate-500 opacity-0 hover:bg-slate-200 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 group-hover:opacity-100 dark:hover:bg-slate-700"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(schema)}
                      aria-label={`Delete ${schema.name}`}
                      className="rounded px-1.5 py-0.5 text-xs text-red-600 opacity-0 hover:bg-red-50 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 group-hover:opacity-100 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreate} className="mt-4 flex gap-2">
          <label htmlFor="new-schema-name" className="sr-only">
            New schema name
          </label>
          <input
            id="new-schema-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New schema name"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Create
          </button>
        </form>
        {createError && (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {createError}
          </p>
        )}
        {deleteError && (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {deleteError}
          </p>
        )}
      </aside>

      <section>
        {selectedId ? (
          <LabelEditor schemaId={selectedId} />
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a schema to manage its labels, or create a new one.
          </p>
        )}
      </section>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete schema"
          message={`Delete "${pendingDelete.name}" and all its labels? This cannot be undone.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
