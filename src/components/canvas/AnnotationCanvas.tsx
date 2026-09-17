import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import {
  applySuggestedText,
  createAnnotation,
  deleteAnnotation,
  restoreAnnotation,
  updateAnnotationGeometry,
} from '../../db/annotations'
import { suggestText } from '../../lib/suggestText'
import { isHotkey } from '../../lib/hotkeys'
import { clamp, computeFitZoom, moveRect, pointToNormalized } from '../../lib/geometry'
import { Toolbar, ZOOM_MAX, ZOOM_MIN } from './Toolbar'
import { PageStageLoader } from './PageStageLoader'
import { RegionList } from './RegionList'
import { DocsOverlay } from './DocsOverlay'
import type { NormalizedRect } from '../../lib/geometry'
import type { Annotation, Doc } from '../../db/types'
import type { AnnotationGeometry } from '../../db/annotations'

// With a region selected, arrow keys nudge it by this many normalized units,
// Shift+arrow by the larger step. Normalized rather than pixels, because the
// model itself is normalized — a pixel-sized step would cover a different
// fraction of the page at every zoom level, so the same keypress would move
// the box by a different visual amount depending on how far in you'd zoomed.
const NUDGE_STEP = 0.002
const NUDGE_STEP_LARGE = 0.02

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

// A simple undo/redo command stack for the three annotation actions this
// canvas supports: draw (create), delete, and move/resize (geometry). The
// create/delete commands carry a full snapshot of the affected annotation, so
// undoing a delete (or redoing a create) can re-insert the exact original row
// — same id, same geometry — rather than fabricating a new one. A geometry
// command instead carries just the before/after rect, since the annotation
// itself never stops existing across a move or resize — there is nothing to
// re-insert, only a position to put back.
type AnnotationCommand =
  | { type: 'create' | 'delete'; annotation: Annotation }
  | { type: 'geometry'; id: string; before: AnnotationGeometry; after: AnnotationGeometry }

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
  // Toggled true the first time the scroll container actually mounts. The
  // container only renders once doc/project/schema/pages have all loaded
  // (see the early `return null` below), which happens on a later render
  // than the component's first — a wheel-attaching effect keyed on state that
  // doesn't change in step with that (zoom, minZoom) would see a null
  // container once and never look again, so this is what lets it retry.
  const [canvasMounted, setCanvasMounted] = useState(false)
  const didAutoFitZoom = useRef(false)
  // The actual page element (see PageStage's containerRef), reported up via
  // onPageElement so Ctrl/Cmd+wheel zoom can measure its true rendered
  // position with getBoundingClientRect() rather than assume where it sits
  // inside the scroll container's padding — see the wheel handler below for
  // why that assumption doesn't hold.
  const pageElementRef = useRef<HTMLDivElement | null>(null)
  // Set by the wheel handler just before a zoom change, read by the layout
  // effect just after it: the pointer's client position and its normalized
  // point on the page, so that effect can re-measure the (now resized) page
  // and adjust scroll so the same page point ends up back under the pointer.
  // Null whenever the zoom change came from somewhere else (a toolbar
  // button), so those don't get scroll-adjusted at all.
  const wheelZoomAnchorRef = useRef<{
    clientX: number
    clientY: number
    point: { x: number; y: number }
  } | null>(null)

  const currentPage = pages?.[pageIndex]

  // Opening a document always starts at 100% zoom otherwise, which is wider
  // than the viewport for most real page sizes — most noticeably on narrow
  // screens, where that meant scrolling sideways just to see the whole page.
  // The initial fit-to-width only runs once per document open (not on every
  // page navigation, so it never fights a zoom level the user picked
  // themselves) and never zooms IN past 100%, only ever out to fit.
  //
  // minZoom, on the other hand, is recomputed whenever the container's width
  // changes: a fixed 50% floor doesn't fit an oversized page any better than
  // 100% does, so the floor itself drops (below the usual 50%) whenever a
  // page's true fit-zoom is smaller than that — otherwise "zoom out" on a very
  // large page hits a wall well before the whole page is visible.
  //
  // Both measurements are driven by a ResizeObserver rather than by a render
  // pass. An effect keyed only on the page runs while Dexie's live queries are
  // still resolving, so it can measure a container that has not been laid out
  // yet, take the `fitZoom === null` exit, and never run again — leaving the
  // floor stuck at its 50% default and the fit-on-open never applied. That is
  // not hypothetical: it left Fit unable to zoom a 2400px page out past 50%,
  // because a correctly measured fit-zoom was being clamped back up against
  // that stale floor. Observing the element also covers window resizes, which
  // a page-keyed effect never did.
  useEffect(() => {
    const container = canvasAreaRef.current
    if (!currentPage || !container) return

    function measure() {
      const el = canvasAreaRef.current
      if (!el || !currentPage) return
      const fitZoom = computeFitZoom(el.clientWidth, PAGE_STAGE_PADDING_X, currentPage.width)
      if (fitZoom === null) return
      const effectiveMinZoom = Math.min(ZOOM_MIN, fitZoom)
      setMinZoom(effectiveMinZoom)

      if (!didAutoFitZoom.current) {
        didAutoFitZoom.current = true
        const initialZoom = Math.min(1, fitZoom)
        if (initialZoom < 1) setZoom(Math.max(effectiveMinZoom, initialZoom))
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [currentPage, canvasMounted])

  // Ctrl/Cmd + wheel zooms about the pointer instead of the corner. Attached
  // manually (not React's onWheel) so preventDefault can be called only when
  // the modifier is held — { passive: false } is required for that to have
  // any effect, and JSX's onWheel doesn't let you choose passivity. Plain
  // scroll (no modifier) never calls preventDefault, so the page area keeps
  // scrolling exactly as it always has.
  //
  // A trackpad pinch arrives as a wheel event with ctrlKey set, so this gets
  // pinch-to-zoom for free — no separate gesture handling needed.
  useEffect(() => {
    const container = canvasAreaRef.current
    if (!container) return

    function handleWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()

      const pageEl = pageElementRef.current
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect()
        wheelZoomAnchorRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          point: pointToNormalized(e.clientX, e.clientY, pageRect),
        }
      }

      // Multiplicative, not ZOOM_STEP: wheel deltas vary wildly between mice
      // and trackpads, and a fixed step would make a trackpad pinch jump
      // several zoom levels in one gesture.
      setZoom((z) => clamp(z * Math.exp(-e.deltaY * 0.0015), minZoom, ZOOM_MAX))
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
    // canvasMounted (unused in the body) is here so this re-runs once the
    // container actually exists in the DOM — see its declaration above for
    // why an effect keyed on minZoom alone would miss that.
  }, [minZoom, canvasMounted])

  // Runs after every zoom change (the page has already re-rendered at the new
  // size) to fix up scroll so the point the wheel handler captured lands back
  // under the same client coordinates. Skips entirely when the zoom change
  // didn't come from the wheel handler (anchor is null) — a toolbar button
  // press has no pointer position to preserve.
  useLayoutEffect(() => {
    const anchor = wheelZoomAnchorRef.current
    wheelZoomAnchorRef.current = null
    const container = canvasAreaRef.current
    const pageEl = pageElementRef.current
    if (!anchor || !container || !pageEl) return

    const pageRect = pageEl.getBoundingClientRect()
    const newClientX = pageRect.left + anchor.point.x * pageRect.width
    const newClientY = pageRect.top + anchor.point.y * pageRect.height
    container.scrollLeft += newClientX - anchor.clientX
    container.scrollTop += newClientY - anchor.clientY
  }, [zoom])

  function handleFitZoom() {
    const container = canvasAreaRef.current
    if (!container || !currentPage) return
    const fitZoom = computeFitZoom(container.clientWidth, PAGE_STAGE_PADDING_X, currentPage.width)
    if (fitZoom === null) return
    // The floor is derived from this same fresh measurement rather than read
    // from the minZoom state, which is only ever as current as the last time
    // something measured. Clamping a correct fit-zoom against a stale, larger
    // floor is precisely how Fit came to leave a wide page still needing to be
    // scrolled sideways.
    const floor = Math.min(ZOOM_MIN, fitZoom)
    setMinZoom(floor)
    // Unlike the one-shot auto-fit on open, this is allowed to exceed 100% —
    // that cap exists only to avoid surprising someone when a document first
    // opens, and a button the user just pressed is not a surprise.
    setZoom(clamp(fitZoom, floor, ZOOM_MAX))
  }

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

  // Shared by a mouse move/resize (from PageStage) and an arrow-key nudge:
  // both are a single gesture that changes an annotation's geometry once, so
  // both persist the same way and produce exactly one undo entry.
  function handleUpdateGeometry(id: string, before: AnnotationGeometry, after: AnnotationGeometry) {
    updateAnnotationGeometry(id, after)
    pushCommand({ type: 'geometry', id, before, after })
  }

  function handleUndo() {
    const command = undoStack[undoStack.length - 1]
    if (!command) return
    switch (command.type) {
      case 'create':
        deleteAnnotation(command.annotation.id)
        break
      case 'delete':
        restoreAnnotation(command.annotation)
        break
      case 'geometry':
        updateAnnotationGeometry(command.id, command.before)
        break
    }
    setUndoStack(undoStack.slice(0, -1))
    setRedoStack([...redoStack, command])
  }

  function handleRedo() {
    const command = redoStack[redoStack.length - 1]
    if (!command) return
    switch (command.type) {
      case 'create':
        restoreAnnotation(command.annotation)
        break
      case 'delete':
        deleteAnnotation(command.annotation.id)
        break
      case 'geometry':
        updateAnnotationGeometry(command.id, command.after)
        break
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
      // Guarded on isModified: hotkeys are bare letters now, so without this
      // Ctrl+D (or any other browser shortcut) would also switch label.
      if (!isModified && isHotkey(e.key) && schema) {
        const label = schema.labels.find((l) => l.hotkey === e.key)
        if (label) setSelectedLabelId(label.id)
        return
      }
      // A selected region claims the arrow keys for nudging; page navigation
      // on ArrowLeft/ArrowRight only applies once nothing is selected, or an
      // arrow meant to nudge a field a couple of pixels would flip the page
      // out from under it instead.
      const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
      if (isArrowKey && selectedAnnotationId) {
        const annotation = annotations?.find((a) => a.id === selectedAnnotationId)
        if (annotation) {
          e.preventDefault()
          const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
          const before: AnnotationGeometry = {
            x: annotation.x,
            y: annotation.y,
            width: annotation.width,
            height: annotation.height,
          }
          handleUpdateGeometry(annotation.id, before, moveRect(before, dx, dy))
        }
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
      // Esc is the keyboard route out, matching the breadcrumb, and it unwinds
      // one layer at a time so it never skips two steps at once. A selected
      // region is the innermost of those layers, and it has to be: a selection
      // claims the arrow keys for nudging, so deselecting is also the only
      // keyboard route back to page navigation. Without this, a keyboard-only
      // user who selected a region could never page through the document again.
      if (e.key === 'Escape') {
        e.preventDefault()
        if (overlayOpen) onCloseOverlay()
        else if (selectedAnnotationId) setSelectedAnnotationId(null)
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
  const sourceMissing = doc.sourceMissing ?? false

  const suggestUnavailableReason = sourceMissing
    ? 'This export did not include the source document, so there are no pixels for Suggest text to read. Re-import it with the source included to use this.'
    : null

  const suggestHint =
    suggestUnavailableReason ??
    (currentPage && currentPage.contentType !== 'text'
      ? 'The text layer is tried first on every page. This one has none, so Suggest text crops the region and runs Tesseract in this tab — English only, engine and model loaded locally, never from a CDN.'
      : 'The text layer is tried first on every page, exactly and for free. OCR only runs when it finds nothing, and its assets are not fetched until then.')

  return (
    <div className="ts-annotate">
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
          onFitZoom={handleFitZoom}
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
          ref={(el) => {
            canvasAreaRef.current = el
            if (el && !canvasMounted) setCanvasMounted(true)
          }}
          data-testid="canvas-scroll-area"
          className="ts-scroll"
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
              sourceMissing={sourceMissing}
              onPageElement={(el) => {
                pageElementRef.current = el
              }}
              onSelectAnnotation={setSelectedAnnotationId}
              onDeselect={() => setSelectedAnnotationId(null)}
              onUpdateGeometry={handleUpdateGeometry}
              onCreateAnnotation={(rect: NormalizedRect) => {
                if (!activeLabelId || sourceMissing) return
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

      <aside className="ts-inspector" aria-label="Regions on this page">
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
            suggestUnavailableReason={suggestUnavailableReason}
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
