import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { createProject, deleteProject } from '../db/projects'
import { ConfirmDialog } from './ConfirmDialog'
import type { Project } from '../db/types'

interface ProjectManagerProps {
  onOpenProject: (projectId: string) => void
}

export function ProjectManager({ onOpenProject }: ProjectManagerProps) {
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])
  const schemas = useLiveQuery(() => db.labelSchemas.toArray(), [])
  const [name, setName] = useState('')
  const [schemaId, setSchemaId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)

  if (projects === undefined || schemas === undefined) return null

  const schemaById = new Map(schemas.map((s) => [s.id, s]))
  const selectedSchemaId = schemaId || schemas[0]?.id || ''

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedSchemaId) {
      setError('Create a label schema first (see the Schemas tab).')
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

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Projects</h1>

      {projects.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          No projects yet. Create one below to start uploading documents.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center gap-3 px-3 py-2">
              <button
                type="button"
                onClick={() => onOpenProject(project.id)}
                className="flex-1 truncate text-left text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-100"
              >
                {project.name}
                <span className="ml-1.5 text-xs text-slate-400">
                  ({schemaById.get(project.schemaId)?.name ?? 'unknown schema'})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(project)}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="project-name"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Project name
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. KYC batch 1"
            className="mt-1 w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="project-schema"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Label schema
          </label>
          <select
            id="project-schema"
            value={selectedSchemaId}
            onChange={(e) => setSchemaId(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            {schemas.length === 0 && <option value="">No schemas yet</option>}
            {schemas.map((schema) => (
              <option key={schema.id} value={schema.id}>
                {schema.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Create project
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${pendingDelete.name}" and all its documents and annotations? This cannot be undone.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
