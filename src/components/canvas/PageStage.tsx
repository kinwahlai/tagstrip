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
    <div className="overflow-auto p-6">
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="relative select-none bg-white shadow-sm"
        style={{ width, height, cursor: selectedLabelId ? 'crosshair' : 'default' }}
      >
        <img
          src={imageUrl}
          alt={`Page ${page.pageIndex + 1}`}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {annotations.map((annotation) => {
          const label = labelsById.get(annotation.labelId)
          const isSelected = annotation.id === selectedAnnotationId
          return (
            <button
              key={annotation.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelectAnnotation(annotation.id)
              }}
              className="absolute border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              style={{
                left: `${annotation.x * 100}%`,
                top: `${annotation.y * 100}%`,
                width: `${annotation.width * 100}%`,
                height: `${annotation.height * 100}%`,
                borderColor: label?.color ?? '#999',
                backgroundColor: isSelected ? `${label?.color ?? '#999'}33` : 'transparent',
                boxShadow: isSelected ? '0 0 0 2px white, 0 0 0 4px rgb(99 102 241)' : undefined,
              }}
            >
              <span
                className="absolute -top-5 left-0 whitespace-nowrap rounded-t px-1 text-[10px] font-medium text-white"
                style={{ backgroundColor: label?.color ?? '#999' }}
              >
                {label?.name ?? 'Unknown'}
              </span>
            </button>
          )
        })}

        {liveRect && (
          <div
            className="absolute border-2 border-dashed border-indigo-500 bg-indigo-500/10"
            style={{
              left: `${liveRect.x * 100}%`,
              top: `${liveRect.y * 100}%`,
              width: `${liveRect.width * 100}%`,
              height: `${liveRect.height * 100}%`,
            }}
          >
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-indigo-600 px-1 text-[10px] font-medium text-white">
              {Math.round(liveRect.width * page.width)} ×{' '}
              {Math.round(liveRect.height * page.height)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
