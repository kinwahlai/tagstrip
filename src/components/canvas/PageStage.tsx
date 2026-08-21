import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { MIN_BOX_SIZE, pointToNormalized, rectFromPoints } from '../../lib/geometry'
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
              }}
            >
              <span className="ts-box-tag" style={{ background: color }}>
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
            <span className="ts-box-tag" style={{ background: 'var(--color-accent)' }}>
              {Math.round(liveRect.width * page.width)} ×{' '}
              {Math.round(liveRect.height * page.height)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
