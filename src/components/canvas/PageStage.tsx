import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import {
  MIN_BOX_SIZE,
  moveRect,
  pointToNormalized,
  rectFromPoints,
  resizeRect,
  tagPlacement,
} from '../../lib/geometry'
import type { Corner, TagPlacement } from '../../lib/geometry'
import type { NormalizedRect } from '../../lib/geometry'
import type { Annotation, Label, Page } from '../../db/types'

type Point = { x: number; y: number }

// One drag state covers all three gestures a pointer can start on the stage:
// drawing a brand new region (from the background), moving one (from its
// body), or resizing one (from a corner handle). Keeping them as a single
// discriminated union — rather than three separate pieces of state — means
// there is exactly one place tracking the drag via window mousemove/mouseup,
// which is what keeps a held-down drag from being recorded as more than one
// undo entry.
type DragState =
  | { mode: 'draw'; start: Point; current: Point }
  | { mode: 'move'; id: string; origin: NormalizedRect; start: Point; current: Point }
  | { mode: 'resize'; id: string; corner: Corner; origin: NormalizedRect; start: Point; current: Point }

// Exact equality is safe here (no epsilon needed): when a gesture ends
// without moving the pointer, moveRect/resizeRect are fed the same numbers
// they started with and return them unchanged, rather than drifting through
// some lossy computation.
function rectsEqual(a: NormalizedRect, b: NormalizedRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

// The in-progress rect for whichever annotation is currently being moved or
// resized, or null for every other annotation (and for a draw-in-progress,
// which has no annotation id to match against). A plain function rather than
// a boolean flag plus a cast, so the mode narrowing happens once, in one
// place, instead of at every call site.
function draggedRectFor(drag: DragState | null, id: string): NormalizedRect | null {
  if (!drag || drag.mode === 'draw' || drag.id !== id) return null
  if (drag.mode === 'move') {
    return moveRect(drag.origin, drag.current.x - drag.start.x, drag.current.y - drag.start.y)
  }
  return resizeRect(drag.origin, drag.corner, drag.current)
}

interface PageStageProps {
  page: Page
  // Null only when sourceMissing is true (see PageStageLoader) — every other
  // path resolves an image before this component is even rendered.
  imageUrl: string | null
  zoom: number
  annotations: Annotation[]
  labelsById: Map<string, Label>
  selectedAnnotationId: string | null
  selectedLabelId: string | null
  // This document was imported without its source (Doc.sourceMissing). The
  // page raster is replaced by a stated placeholder, and drawing a new region
  // is disabled — there is nothing to draw on top of. Existing regions still
  // render and are still selectable.
  sourceMissing: boolean
  onCreateAnnotation: (rect: NormalizedRect) => void
  onSelectAnnotation: (id: string) => void
  onDeselect: () => void
  // Called once per move/resize gesture, on release — never per frame. Not
  // called at all when the gesture ends back where it started, so a click
  // that never moved the pointer produces neither a database write nor an
  // undo entry.
  onUpdateGeometry: (id: string, before: NormalizedRect, after: NormalizedRect) => void
}

// Both the saved-region tags and the live drag readout render through this, so a
// placement state cannot be wired into one and forgotten in the other. It was:
// the compact state reached the regions but not the drag readout, which went
// back to spilling past the box — the exact bug the compact state exists to fix.
// Low enough that the selected label reads as the foreground, high enough that
// the other regions are still visible as context — you need to see that a field
// is already boxed even while working on a different one.
const DIMMED_OPACITY = 0.28

function tagStyle(placement: TagPlacement): { className: string; top: 0 | undefined } {
  return {
    className: `ts-box-tag${placement === 'inside-compact' ? ' ts-box-tag--compact' : ''}`,
    top: placement === 'above' ? undefined : 0,
  }
}

export function PageStage({
  page,
  imageUrl,
  zoom,
  annotations,
  labelsById,
  selectedAnnotationId,
  selectedLabelId,
  sourceMissing,
  onCreateAnnotation,
  onSelectAnnotation,
  onDeselect,
  onUpdateGeometry,
}: PageStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  // Mirrors `drag` for handleUp to read synchronously. Using the setDrag
  // updater form there (`setDrag(prev => ...)`) to get the latest position
  // would run onCreateAnnotation as a side effect of a state updater, which
  // React 18 Strict Mode double-invokes in dev — creating two annotations per
  // drag. Reading a ref instead keeps the side effect in the event handler,
  // where it only ever runs once.
  const dragRef = useRef<typeof drag>(null)

  function updateDrag(next: typeof drag) {
    dragRef.current = next
    setDrag(next)
  }

  useEffect(() => {
    if (!drag) return

    function handleMove(e: MouseEvent) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect || !dragRef.current) return
      const current = pointToNormalized(e.clientX, e.clientY, rect)
      updateDrag({ ...dragRef.current, current })
    }

    function handleUp(e: MouseEvent) {
      const rect = containerRef.current?.getBoundingClientRect()
      const started = dragRef.current
      updateDrag(null)
      if (!started || !rect) return

      const current = pointToNormalized(e.clientX, e.clientY, rect)

      if (started.mode === 'draw') {
        const finalRect = rectFromPoints(started.start, current)
        if (finalRect.width >= MIN_BOX_SIZE && finalRect.height >= MIN_BOX_SIZE) {
          onCreateAnnotation(finalRect)
        }
        return
      }

      // Move and resize persist once per gesture, here on mouse-up — never
      // per mousemove frame — and only when the gesture actually changed
      // anything, so a click that never moved the pointer writes nothing and
      // leaves no undo entry.
      const finalRect =
        started.mode === 'move'
          ? moveRect(started.origin, current.x - started.start.x, current.y - started.start.y)
          : resizeRect(started.origin, started.corner, current)
      if (!rectsEqual(finalRect, started.origin)) {
        onUpdateGeometry(started.id, started.origin, finalRect)
      }
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  function handleMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return
    onDeselect()
    // No pixels to draw on top of — see the sourceMissing prop comment. The
    // aside panel in AnnotationCanvas states the reason; this just makes sure
    // a drag can't start one to begin with.
    if (sourceMissing) return
    if (!selectedLabelId) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const start = pointToNormalized(e.clientX, e.clientY, rect)
    updateDrag({ mode: 'draw', start, current: start })
  }

  // Dragging a region's body moves it. This works on any region, selected or
  // not — grabbing an unselected one selects it and moves it in the same
  // gesture, rather than requiring a click first to select and a second drag
  // to move.
  function handleRegionMouseDown(e: ReactMouseEvent, annotation: Annotation) {
    if (e.button !== 0) return
    onSelectAnnotation(annotation.id)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const start = pointToNormalized(e.clientX, e.clientY, rect)
    const origin = {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
    }
    updateDrag({ mode: 'move', id: annotation.id, origin, start, current: start })
  }

  // Dragging a corner handle resizes instead. stopPropagation keeps this from
  // also bubbling up to the region body's own onMouseDown above — the handle
  // is a descendant of the region box in the DOM, so without it a single
  // mousedown would start a resize and then immediately overwrite it with a
  // move.
  function handleResizeMouseDown(e: ReactMouseEvent, annotation: Annotation, corner: Corner) {
    if (e.button !== 0) return
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const start = pointToNormalized(e.clientX, e.clientY, rect)
    const origin = {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height,
    }
    updateDrag({ mode: 'resize', id: annotation.id, corner, origin, start, current: start })
  }

  const width = page.width * zoom
  const height = page.height * zoom
  const liveRect = drag && drag.mode === 'draw' ? rectFromPoints(drag.start, drag.current) : null
  // An empty collision list on purpose: weighing the readout against existing
  // boxes mid-drag would make it jump around while you are trying to read it.
  // It still shrinks and flips, so it stays inside the box being drawn.
  const livePlacement: TagPlacement = liveRect ? tagPlacement(liveRect, [], height) : 'above'

  return (
    <div className="ts-scroll" style={{ padding: 'var(--space-6)' }}>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="select-none"
        style={{
          position: 'relative',
          width,
          height,
          background: 'var(--color-neutral-100)',
          boxShadow: 'var(--shadow-md)',
          cursor: sourceMissing ? 'default' : selectedLabelId ? 'crosshair' : 'default',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Page ${page.pageIndex + 1}`}
            draggable={false}
            className="pointer-events-none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        ) : (
          <div
            role="status"
            className="pointer-events-none"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-6)',
              textAlign: 'center',
              fontSize: '12.5px',
              lineHeight: 1.6,
              color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
            }}
          >
            This export did not include the source document, so there is no page image to show.
            Existing regions can still be selected, re-labelled, transcribed and deleted — drawing a
            new region and Suggest text need pixels that aren't here.
          </div>
        )}

        {annotations.map((annotation) => {
          const label = labelsById.get(annotation.labelId)
          const color = label?.color ?? '#999'
          const isSelected = annotation.id === selectedAnnotationId
          // While this annotation is the one being moved or resized, render it
          // at its provisional rect instead of its last-saved geometry — the
          // database isn't written to until mouse-up, so this is the only
          // place the in-progress position is visible at all.
          const box: NormalizedRect = draggedRectFor(drag, annotation.id) ?? annotation
          // A schema with 20+ fields puts 20+ colours on the page at once, which
          // is well past the number anyone can tell apart at a glance. Dimming
          // the labels you are not working on means you only ever have to
          // discriminate one colour against a muted background — it does more
          // for a large schema than any palette could. The region you have
          // actually selected is never dimmed, even under another label, or
          // clicking a neighbour would make it fade as you inspect it. Dimmed
          // regions stay clickable, so this narrows attention, not access.
          const dimmed =
            Boolean(selectedLabelId) && !isSelected && annotation.labelId !== selectedLabelId
          // Recomputed per render because it depends on zoom: the tag is a
          // fixed pixel height, so the gap it needs grows as the page shrinks.
          const placement = tagPlacement(
            box,
            annotations.filter((other) => other.id !== annotation.id),
            height,
          )
          return (
            <button
              key={annotation.id}
              type="button"
              onMouseDown={(e) => handleRegionMouseDown(e, annotation)}
              onClick={(e) => {
                e.stopPropagation()
                onSelectAnnotation(annotation.id)
              }}
              style={{
                position: 'absolute',
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
                padding: 0,
                border: `2px solid ${color}`,
                background: isSelected ? `${color}33` : `${color}26`,
                // Selection is never colour alone: a heavy ink ring, four
                // handles, and the word "selected" in the tag all say so.
                boxShadow: isSelected
                  ? '0 0 0 3px color-mix(in srgb, var(--color-text) 34%, transparent)'
                  : undefined,
                cursor: 'move',
                opacity: dimmed ? DIMMED_OPACITY : undefined,
                transition: 'opacity 120ms ease-out',
              }}
            >
              <span
                className={tagStyle(placement).className}
                style={{ background: color, top: tagStyle(placement).top }}
              >
                {label?.name ?? 'Unknown'}
                {isSelected ? ' · selected' : ''}
              </span>
              {isSelected && (
                <>
                  <span
                    className="ts-handle"
                    style={{ left: -5, top: -5, cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, annotation, 'nw')}
                  />
                  <span
                    className="ts-handle"
                    style={{ right: -5, top: -5, cursor: 'nesw-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, annotation, 'ne')}
                  />
                  <span
                    className="ts-handle"
                    style={{ left: -5, bottom: -5, cursor: 'nesw-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, annotation, 'sw')}
                  />
                  <span
                    className="ts-handle"
                    style={{ right: -5, bottom: -5, cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleResizeMouseDown(e, annotation, 'se')}
                  />
                </>
              )}
            </button>
          )
        })}

        {liveRect && (
          <div
            style={{
              position: 'absolute',
              left: `${liveRect.x * 100}%`,
              top: `${liveRect.y * 100}%`,
              width: `${liveRect.width * 100}%`,
              height: `${liveRect.height * 100}%`,
              border: '2px dashed var(--color-accent)',
              background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
            }}
          >
            <span
              className={tagStyle(livePlacement).className}
              style={{ background: 'var(--color-accent)', top: tagStyle(livePlacement).top }}
            >
              {Math.round(liveRect.width * page.width)} ×{' '}
              {Math.round(liveRect.height * page.height)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
