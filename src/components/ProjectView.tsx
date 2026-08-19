import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addImageDocument, addPdfDocument, deleteDoc } from '../db/docs'
import { exportProjectToFile } from '../lib/nativeExport'
import { ConfirmDialog } from './ConfirmDialog'
import { DocDetail } from './DocDetail'
import { LabelStudioExportDialog } from './LabelStudioExportDialog'
import type { Doc } from '../db/types'

interface ProjectViewProps {
  projectId: string
  onOpenAnnotate: (docId: string) => void
  onBack: () => void
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])

export function ProjectView({ projectId, onOpenAnnotate, onBack }: ProjectViewProps) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId])
  const schema = useLiveQuery(
    () => (project ? db.labelSchemas.get(project.schemaId) : undefined),
    [project],
  )
  const docs = useLiveQuery(
    () => db.docs.where('projectId').equals(projectId).sortBy('createdAt'),
    [projectId],
  )
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<{
    filename: string
    done: number
    total: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Doc | null>(null)
  const [showLabelStudioDialog, setShowLabelStudioDialog] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExportNative() {
    setExportError(null)
    try {
      await exportProjectToFile(projectId)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    setError(null)

    for (const file of files) {
      setUploadState({ filename: file.name, done: 0, total: 1 })
      try {
        let docId: string
        if (file.type === 'application/pdf') {
          docId = await addPdfDocument(projectId, file, (done, total) =>
            setUploadState({ filename: file.name, done, total }),
          )
        } else if (IMAGE_TYPES.has(file.type)) {
          docId = await addImageDocument(projectId, file)
        } else {
          setError(`Unsupported file type for "${file.name}": ${file.type || 'unknown'}.`)
          continue
        }
        setSelectedDocId(docId)
      } catch (err) {
        setError(
          `Failed to process "${file.name}": ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
    setUploadState(null)
  }

  async function handleDeleteConfirmed() {
    if (!pendingDelete) return
    await deleteDoc(pendingDelete.id)
    if (selectedDocId === pendingDelete.id) setSelectedDocId(null)
    setPendingDelete(null)
  }

  if (project === undefined || docs === undefined) return null
  if (project === null) return <p className="text-sm text-slate-500">Project not found.</p>

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? null

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-indigo-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-indigo-400"
      >
        ← All projects
      </button>
      <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
        {project.name}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Schema: {schema?.name ?? 'unknown'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExportNative}
          className="whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => setShowLabelStudioDialog(true)}
          className="whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Export to Label Studio…
        </button>
      </div>
      {exportError && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {exportError}
        </p>
      )}

      <div className="mt-4">
        <label className="inline-block cursor-pointer rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:bg-indigo-700 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-500">
          Upload document
          <input
            type="file"
            accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
            multiple
            onChange={handleUpload}
            className="sr-only"
          />
        </label>

        {uploadState && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400" role="status">
            Processing {uploadState.filename}
            {uploadState.total > 1 ? ` (page ${uploadState.done}/${uploadState.total})` : '…'}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
        <div>
          {docs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No documents yet. Upload a PDF or image to get started.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`flex-1 truncate text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                      selectedDocId === doc.id
                        ? 'font-medium text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {doc.filename}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(doc)}
                    className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {selectedDoc ? (
            <div className="max-w-md rounded-md border border-slate-200 p-4 dark:border-slate-700">
              <DocDetail doc={selectedDoc} onOpenAnnotate={onOpenAnnotate} />
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select a document to view its pages, or upload a new one.
            </p>
          )}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete document"
          message={`Delete "${pendingDelete.filename}" and all its annotations? This cannot be undone.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {showLabelStudioDialog && (
        <LabelStudioExportDialog
          projectId={projectId}
          onClose={() => setShowLabelStudioDialog(false)}
        />
      )}
    </div>
  )
}
