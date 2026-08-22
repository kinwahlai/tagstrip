import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addImageDocument, addPdfDocument, deleteDoc } from '../db/docs'
import { exportProjectToFile } from '../lib/nativeExport'
import { ConfirmDialog } from './ConfirmDialog'
import { DocDetail } from './DocDetail'
import { LabelStudioExportDialog } from './LabelStudioExportDialog'
import { ContentTypeBadge } from './ContentTypeBadge'
import { SurfaceHeader } from './shell/SurfaceHeader'
import { useWorkspaceStats } from '../lib/useWorkspaceStats'
import type { Doc } from '../db/types'

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const HINT = 'color-mix(in srgb, var(--color-text) 65%, transparent)'

interface ProjectDetailProps {
  projectId: string
  onOpenAnnotate: (docId: string) => void
}

// The only screen with three columns, because a document list is long enough to
// earn one. The rail is the first; documents the second; the selected document
// takes the remainder. Every column carries data — the old layout left one
// permanently empty (survey finding 6).
export function ProjectDetail({ projectId, onOpenAnnotate }: ProjectDetailProps) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId])
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
  const stats = useWorkspaceStats()

  if (project === undefined || docs === undefined) return null
  if (project === null) return <p style={{ padding: 'var(--space-4)' }}>Project not found.</p>

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? null

  async function handleExportNative() {
    setError(null)
    try {
      await exportProjectToFile(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <section
        aria-label="Documents"
        style={{
          flex: 'none',
          width: 'var(--ts-mid)',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '2px solid var(--color-divider)',
        }}
      >
        <div
          style={{
            flex: 'none',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '2px solid var(--color-divider)',
          }}
        >
          <h2 className="ts-eyebrow" style={{ margin: '0 0 var(--space-2)' }}>
            Documents · {docs.length}
          </h2>
          <label className="btn btn-primary btn-sm btn-block" style={{ margin: 0 }}>
            Upload document
            <input
              type="file"
              accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
              multiple
              onChange={handleUpload}
              className="sr-only"
            />
          </label>
          <p
            className="mono"
            style={{ margin: 'var(--space-2) 0 0', fontSize: 11, lineHeight: 1.5, color: HINT }}
          >
            PDF, PNG, JPEG or WebP. Read in this tab.
          </p>
          {uploadState && (
            <p role="status" style={{ margin: 'var(--space-2) 0 0', fontSize: 12, color: HINT }}>
              Processing {uploadState.filename}
              {uploadState.total > 1 ? ` (page ${uploadState.done}/${uploadState.total})` : '…'}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-3)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--color-divider)',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, justifyContent: 'flex-start' }}
              onClick={handleExportNative}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, justifyContent: 'flex-start' }}
              onClick={() => setShowLabelStudioDialog(true)}
            >
              Label Studio…
            </button>
          </div>
        </div>

        <div className="ts-scroll" style={{ flex: 1, minHeight: 0 }}>
          {docs.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: 'var(--space-3) var(--space-4)',
                fontSize: '12.5px',
                color: HINT,
              }}
            >
              No documents yet. Upload a PDF or image to get started.
            </p>
          ) : (
            docs.map((doc, i) => (
              <button
                key={doc.id}
                type="button"
                className="ts-row-btn"
                aria-current={selectedDocId === doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderBottom: '1px solid var(--color-divider)',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  className="mono"
                  style={{
                    flex: 'none',
                    width: 22,
                    fontSize: 11,
                    paddingTop: 2,
                    color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="mono"
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {doc.filename}
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 3,
                    }}
                  >
                    <ContentTypeBadge
                      contentType={stats.contentTypeByDoc.get(doc.id) ?? 'unknown'}
                    />
                    <span
                      className="mono"
                      style={{
                        fontSize: '10.5px',
                        whiteSpace: 'nowrap',
                        color: 'color-mix(in srgb, var(--color-text) 58%, transparent)',
                      }}
                    >
                      {doc.sourceType === 'image'
                        ? 'image'
                        : `${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'}`}{' '}
                      · {stats.regionsByDoc.get(doc.id) ?? 0} regions
                    </span>
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <SurfaceHeader
          title="Selected document"
          subtitle={
            selectedDoc
              ? `${selectedDoc.sourceType.toUpperCase()} · ${selectedDoc.pageCount} page${
                  selectedDoc.pageCount === 1 ? '' : 's'
                }`
              : undefined
          }
          error={error}
          actions={
            selectedDoc && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPendingDelete(selectedDoc)}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onOpenAnnotate(selectedDoc.id)}
                >
                  Open annotation canvas
                </button>
              </>
            )
          }
        />
        {selectedDoc ? (
          <DocDetail doc={selectedDoc} />
        ) : (
          <p style={{ padding: 'var(--space-4)', fontSize: '12.5px', color: HINT }}>
            Select a document to view its pages, or upload a new one.
          </p>
        )}
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
