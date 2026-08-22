import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { createProject, deleteProject } from '../db/projects'
import { importNativeExport, parseNativeExport } from '../lib/nativeImport'
import { formatWhen } from '../lib/formatDate'
import { summarizeProject } from '../lib/stats'
import { useWorkspaceStats } from '../lib/useWorkspaceStats'
import { ConfirmDialog } from './ConfirmDialog'
import { SurfaceHeader } from './shell/SurfaceHeader'
import type { Project } from '../db/types'

const HINT = 'color-mix(in srgb, var(--color-text) 68%, transparent)'

interface ProjectsOverviewProps {
  onOpenProject: (projectId: string) => void
}

export function ProjectsOverview({ onOpenProject }: ProjectsOverviewProps) {
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])
  const schemas = useLiveQuery(() => db.labelSchemas.orderBy('name').toArray(), [])
  const stats = useWorkspaceStats()

  const [name, setName] = useState('')
  const [schemaId, setSchemaId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)

  if (projects === undefined || schemas === undefined) return null

  const schemaNameById = new Map(schemas.map((s) => [s.id, s.name]))
  const summaries = new Map(projects.map((p) => [p.id, summarizeProject(p.id, stats)]))
  const selectedSchemaId = schemaId || schemas[0]?.id || ''

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
      onOpenProject(await importNativeExport(parseNativeExport(json)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedSchemaId) {
      setError('Create a label schema first — a project needs one to define what you annotate.')
      return
    }
    try {
      const id = await createProject(name, selectedSchemaId)
      setName('')
      onOpenProject(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDelete) return
    await deleteProject(pendingDelete.id)
    setPendingDelete(null)
  }

  const docTotal = [...summaries.values()].reduce((n, s) => n + s.docs, 0)
  const annotatedTotal = [...summaries.values()].reduce((n, s) => n + s.annotated, 0)
  const regionTotal = [...summaries.values()].reduce((n, s) => n + s.regions, 0)

  return (
    <>
      <SurfaceHeader
        title={`Projects · ${projects.length}`}
        subtitle={
          projects.length === 0
            ? undefined
            : `${docTotal} document${docTotal === 1 ? '' : 's'} · ${annotatedTotal} annotated · ${regionTotal} region${
                regionTotal === 1 ? '' : 's'
              }`
        }
        error={error}
        actions={
          <label className="btn btn-secondary">
            Import project…
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
          New project
        </h3>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 'var(--space-3)',
          }}
        >
          <div className="field" style={{ flex: 1, minWidth: 200, maxWidth: 420 }}>
            <label htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. KYC batch 1"
            />
          </div>
          <div className="field" style={{ width: 260 }}>
            <label htmlFor="project-schema">Label schema</label>
            <select
              id="project-schema"
              className="input"
              value={selectedSchemaId}
              onChange={(e) => setSchemaId(e.target.value)}
            >
              {schemas.length === 0 && <option value="">No schemas yet</option>}
              {schemas.map((schema) => (
                <option key={schema.id} value={schema.id}>
                  {schema.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ minHeight: 36 }}>
            Create project
          </button>
        </div>
        <p
          className="mono"
          style={{ margin: 'var(--space-2) 0 0', fontSize: '11.5px', color: HINT }}
        >
          A project takes one schema and many documents.
        </p>
      </form>

      <div
        className="ts-scroll"
        style={{ flex: 1, minHeight: 0, padding: '0 var(--space-4) var(--space-4)' }}
      >
        {projects.length === 0 ? (
          <p style={{ padding: 'var(--space-4) 0', fontSize: '12.5px', color: HINT }}>
            No projects yet. Create one above to start uploading documents.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th style={{ width: 220 }}>Schema</th>
                <th style={{ width: 110 }}>Documents</th>
                <th style={{ width: 190 }}>Annotated</th>
                <th style={{ width: 110 }}>Regions</th>
                <th style={{ width: 170 }}>Updated</th>
                <th style={{ width: 86 }}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const summary = summaries.get(project.id) ?? { docs: 0, annotated: 0, regions: 0 }
                const pct = summary.docs === 0 ? 0 : (summary.annotated / summary.docs) * 100
                return (
                  <tr key={project.id}>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: 14, padding: 0, color: 'var(--color-text)' }}
                        onClick={() => onOpenProject(project.id)}
                      >
                        {project.name}
                      </button>
                    </td>
                    <td style={{ fontSize: '12.5px', color: HINT }}>
                      {schemaNameById.get(project.schemaId) ?? 'unknown schema'}
                    </td>
                    <td className="mono" style={{ fontSize: 13 }}>
                      {summary.docs}
                    </td>
                    <td>
                      {/* Progress is a bar AND a written ratio: the bar alone would
                        put the whole meaning in length and colour. */}
                      <span
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                      >
                        <span
                          style={{
                            flex: 1,
                            height: 8,
                            background: 'var(--color-neutral-200)',
                            position: 'relative',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${pct}%`,
                              background: 'var(--color-accent)',
                            }}
                          />
                        </span>
                        <span
                          className="mono"
                          style={{ fontSize: 12, width: 66, textAlign: 'right' }}
                        >
                          {summary.annotated} / {summary.docs}
                        </span>
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 13 }}>
                      {summary.regions}
                    </td>
                    <td style={{ fontSize: '12.5px', color: HINT }}>
                      {formatWhen(project.updatedAt)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`Delete ${project.name}`}
                        onClick={() => setPendingDelete(project)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${pendingDelete.name}" and all its documents and annotations? This cannot be undone.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
