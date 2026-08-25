import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { MIN_BOX_SIZE, pointToNormalized, rectFromPoints, tagPlacement } from '../../lib/geometry'
import type { TagPlacement } from '../../lib/geometry'
import type { NormalizedRect } from '../../lib/geometry'
import type { Annotation, Label, Page } from '../../db/types'

interface PageStageProps {
  page: Page
  imageUrl: string
  zoom: number
  annotations: Annotation[]
  labelsById: Map<string, Label>
  selectedAnnotationId: string | null
  selectedLabelId: string | null
  onCreateAnnotation: (rect: NormalizedRect) => void
  onSelectAnnotation: (id: string) => void
  onDeselect: () => void
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
  onCreateAnnotation,
  onSelectAnnotation,
  onDeselect,
}: PageStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{
    start: { x: number; y: number }
    current: { x: number; y: number }
  } | null>(null)
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
      const finalRect = rectFromPoints(started.start, current)
      if (finalRect.width >= MIN_BOX_SIZE && finalRect.height >= MIN_BOX_SIZE) {
        onCreateAnnotation(finalRect)
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
    if (!selectedLabelId) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const start = pointToNormalized(e.clientX, e.clientY, rect)
    updateDrag({ start, current: start })
  }

  const width = page.width * zoom
  const height = page.height * zoom
  const liveRect = drag ? rectFromPoints(drag.start, drag.current) : null
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
          cursor: selectedLabelId ? 'crosshair' : 'default',
        }}
      >
        <img
          src={imageUrl}
          alt={`Page ${page.pageIndex + 1}`}
          draggable={false}
          className="pointer-events-none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />

        {annotations.map((annotation) => {
          const label = labelsById.get(annotation.labelId)
          const color = label?.color ?? '#999'
          const isSelected = annotation.id === selectedAnnotationId
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
            annotation,
            annotations.filter((other) => other.id !== annotation.id),
            height,
          )
          return (
            <button
              key={annotation.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelectAnnotation(annotation.id)
              }}
              style={{
                position: 'absolute',
                left: `${annotation.x * 100}%`,
                top: `${annotation.y * 100}%`,
                width: `${annotation.width * 100}%`,
                height: `${annotation.height * 100}%`,
                padding: 0,
                border: `2px solid ${color}`,
                background: isSelected ? `${color}33` : `${color}26`,
                // Selection is never colour alone: a heavy ink ring, four
                // handles, and the word "selected" in the tag all say so.
                boxShadow: isSelected
                  ? '0 0 0 3px color-mix(in srgb, var(--color-text) 34%, transparent)'
                  : undefined,
                cursor: 'pointer',
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
                  <span className="ts-handle" style={{ left: -5, top: -5 }} />
                  <span className="ts-handle" style={{ right: -5, top: -5 }} />
                  <span className="ts-handle" style={{ left: -5, bottom: -5 }} />
                  <span className="ts-handle" style={{ right: -5, bottom: -5 }} />
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
