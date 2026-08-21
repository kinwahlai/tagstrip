import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import {
  applySuggestedText,
  createAnnotation,
  deleteAnnotation,
  restoreAnnotation,
} from '../../db/annotations'
import { suggestText } from '../../lib/suggestText'
import { isHotkey } from '../../lib/hotkeys'
import { Toolbar, ZOOM_MIN } from './Toolbar'
import { PageStageLoader } from './PageStageLoader'
import { RegionList } from './RegionList'
import { DocsOverlay } from './DocsOverlay'
import type { NormalizedRect } from '../../lib/geometry'
import type { Annotation, Doc } from '../../db/types'

// Horizontal padding inside the page stage's scroll container (p-6 = 24px each
// side — see PageStage.tsx) that isn't available for the page image itself.
const PAGE_STAGE_PADDING_X = 48

interface AnnotationCanvasProps {
  docId: string
  onBack: () => void
  projectName: string
  docs: Doc[]
  overlayOpen: boolean
  onCloseOverlay: () => void
  onSelectDoc: (docId: string) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
}

// A simple undo/redo command stack for the two annotation actions this
// canvas supports: draw (create) and delete. Each command carries a full
// snapshot of the affected annotation, so undoing a delete (or redoing a
// create) can re-insert the exact original row — same id, same geometry —
// rather than fabricating a new one.
type AnnotationCommand = { type: 'create' | 'delete'; annotation: Annotation }

export function AnnotationCanvas({
  docId,
  onBack,
  projectName,
  docs,
  overlayOpen,
  onCloseOverlay,
  onSelectDoc,
}: AnnotationCanvasProps) {
  const doc = useLiveQuery(() => db.docs.get(docId), [docId])
  const project = useLiveQuery(
    () => (doc ? db.projects.get(doc.projectId) : undefined),
    [doc?.projectId],
  )
  const schema = useLiveQuery(
    () => (project ? db.labelSchemas.get(project.schemaId) : undefined),
    [project?.schemaId],
  )
  const pages = useLiveQuery(
    () => db.pages.where('documentId').equals(docId).sortBy('pageIndex'),
    [docId],
  )

  const [pageIndex, setPageIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(ZOOM_MIN)
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<AnnotationCommand[]>([])
  const [redoStack, setRedoStack] = useState<AnnotationCommand[]>([])
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const didAutoFitZoom = useRef(false)

  const currentPage = pages?.[pageIndex]

  // Opening a document always starts at 100% zoom otherwise, which is wider
  // than the viewport for most real page sizes — most noticeably on narrow
  // screens, where that meant scrolling sideways just to see the whole page.
  // The initial fit-to-width only runs once per document open (not on every
  // page navigation, so it never fights a zoom level the user picked
  // themselves) and never zooms IN past 100%, only ever out to fit.
  //
  // minZoom, on the other hand, is recomputed on every page change: a fixed
  // 50% floor doesn't fit an oversized page any better than 100% does, so the
  // floor itself drops (below the usual 50%) whenever a page's true fit-zoom
  // is smaller than that — otherwise "zoom out" on a very large page hits a
  // wall well before the whole page is visible.
  useEffect(() => {
    const container = canvasAreaRef.current
    if (!currentPage || !container) return

    const availableWidth = container.clientWidth - PAGE_STAGE_PADDING_X
    if (availableWidth <= 0) return
    const fitZoom = availableWidth / currentPage.width
    const effectiveMinZoom = Math.min(ZOOM_MIN, fitZoom)
    setMinZoom(effectiveMinZoom)

    if (!didAutoFitZoom.current) {
      didAutoFitZoom.current = true
      const initialZoom = Math.min(1, fitZoom)
      if (initialZoom < 1) setZoom(Math.max(effectiveMinZoom, initialZoom))
    }
  }, [currentPage])

  const annotations = useLiveQuery(
    () => db.annotations.where('[documentId+pageIndex]').equals([docId, pageIndex]).toArray(),
    [docId, pageIndex],
  )

  function goToPage(next: number) {
    if (!pages) return
    setPageIndex(Math.max(0, Math.min(pages.length - 1, next)))
    setSelectedAnnotationId(null)
  }

  function pushCommand(command: AnnotationCommand) {
    setUndoStack((stack) => [...stack, command])
    setRedoStack([])
  }

  function handleDeleteAnnotation(id: string) {
    const annotation = annotations?.find((a) => a.id === id)
    if (!annotation) return
    deleteAnnotation(id)
    pushCommand({ type: 'delete', annotation })
    if (selectedAnnotationId === id) setSelectedAnnotationId(null)
  }

  async function handleSuggestText(id: string) {
    const annotation = annotations?.find((a) => a.id === id)
    if (!annotation || !currentPage) return
    const result = await suggestText(currentPage, annotation)
    await applySuggestedText(id, result.text, result.ocrSuggested)
  }

  function handleUndo() {
    const command = undoStack[undoStack.length - 1]
    if (!command) return
    if (command.type === 'create') {
      deleteAnnotation(command.annotation.id)
    } else {
      restoreAnnotation(command.annotation)
    }
    setUndoStack(undoStack.slice(0, -1))
    setRedoStack([...redoStack, command])
  }

  function handleRedo() {
    const command = redoStack[redoStack.length - 1]
    if (!command) return
    if (command.type === 'create') {
      restoreAnnotation(command.annotation)
    } else {
      deleteAnnotation(command.annotation.id)
    }
    setRedoStack(redoStack.slice(0, -1))
    setUndoStack([...undoStack, command])
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return

      const isModified = e.ctrlKey || e.metaKey
      if (isModified && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) handleRedo()
        else handleUndo()
        return
      }
      if (isModified && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handleRedo()
        return
      }
      if (isHotkey(e.key) && schema) {
        const label = schema.labels.find((l) => l.hotkey === e.key)
        if (label) setSelectedLabelId(label.id)
        return
      }
      if (e.key === 'ArrowLeft') {
        goToPage(pageIndex - 1)
        return
      }
      if (e.key === 'ArrowRight') {
        goToPage(pageIndex + 1)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotationId) {
        e.preventDefault()
        handleDeleteAnnotation(selectedAnnotationId)
        return
      }
      // Esc is the keyboard route out, matching the breadcrumb. An open document
      // overlay swallows it first, so Esc never skips two steps at once.
      if (e.key === 'Escape') {
        e.preventDefault()
        if (overlayOpen) onCloseOverlay()
        else onBack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    schema,
    pages,
    pageIndex,
    selectedAnnotationId,
    annotations,
    undoStack,
    redoStack,
    overlayOpen,
  ])

  if (doc === undefined || project === undefined || schema === undefined || pages === undefined) {
    return null
  }
  if (!doc || !project || !schema) {
    return <p style={{ padding: 'var(--space-4)' }}>Document not found.</p>
  }

  const labelsById = new Map(schema.labels.map((l) => [l.id, l]))
  const activeLabelId = selectedLabelId ?? schema.labels[0]?.id ?? null

  const suggestHint =
    currentPage && currentPage.contentType !== 'text'
      ? 'The text layer is tried first on every page. This one has none, so Suggest text crops the region and runs Tesseract in this tab — English only, engine and model loaded locally, never from a CDN.'
      : 'The text layer is tried first on every page, exactly and for free. OCR only runs when it finds nothing, and its assets are not fetched until then.'

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Toolbar
          labels={schema.labels}
          selectedLabelId={activeLabelId}
          onSelectLabel={setSelectedLabelId}
          zoom={zoom}
          onZoomChange={setZoom}
          minZoom={minZoom}
          pageIndex={pageIndex}
          pageCount={pages.length}
          onPageChange={goToPage}
          contentType={currentPage?.contentType ?? null}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />

        <div
          ref={canvasAreaRef}
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            overflow: 'auto',
            background: 'var(--color-surface)',
          }}
        >
          {!currentPage ? (
            <p style={{ padding: 'var(--space-4)' }}>This document has no pages.</p>
          ) : (
            <PageStageLoader
              key={currentPage.id}
              page={currentPage}
              zoom={zoom}
              annotations={annotations ?? []}
              labelsById={labelsById}
              selectedAnnotationId={selectedAnnotationId}
              selectedLabelId={activeLabelId}
              onSelectAnnotation={setSelectedAnnotationId}
              onDeselect={() => setSelectedAnnotationId(null)}
              onCreateAnnotation={(rect: NormalizedRect) => {
                if (!activeLabelId) return
                createAnnotation(docId, pageIndex, activeLabelId, rect).then((annotation) => {
                  setSelectedAnnotationId(annotation.id)
                  pushCommand({ type: 'create', annotation })
                })
              }}
            />
          )}

          {overlayOpen && (
            <DocsOverlay
              projectName={projectName}
              docs={docs}
              currentDocId={docId}
              onSelectDoc={onSelectDoc}
              onClose={onCloseOverlay}
              onBackToProject={onBack}
            />
          )}
        </div>
      </main>

      <aside
        aria-label="Regions on this page"
        style={{
          flex: 'none',
          width: 'var(--ts-inspector)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '2px solid var(--color-divider)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '2px solid var(--color-divider)',
          }}
        >
          <h2 className="ts-eyebrow" style={{ margin: 0 }}>
            Regions on this page · {annotations?.length ?? 0}
          </h2>
          <span
            className="mono"
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
            }}
          >
            {schema.name}
          </span>
        </div>

        <div className="ts-scroll" style={{ flex: 1, minHeight: 0 }}>
          <RegionList
            annotations={annotations ?? []}
            labelsById={labelsById}
            selectedId={selectedAnnotationId}
            onSelect={setSelectedAnnotationId}
            onDelete={handleDeleteAnnotation}
            onSuggestText={handleSuggestText}
          />
        </div>

        <div
          style={{
            flex: 'none',
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '2px solid var(--color-divider)',
            background: 'var(--color-surface)',
          }}
        >
          <span className="ts-eyebrow" style={{ display: 'block', marginBottom: 4 }}>
            Suggest text
          </span>
          <p
            className="mono"
            style={{
              margin: 0,
              fontSize: 11,
              lineHeight: 1.55,
              color: 'color-mix(in srgb, var(--color-text) 72%, transparent)',
            }}
          >
            {suggestHint}
          </p>
        </div>
      </aside>
    </div>
  )
}
