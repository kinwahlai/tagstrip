import { ContentTypeBadge } from '../ContentTypeBadge'
import type { Label, Page } from '../../db/types'

interface ToolbarProps {
  labels: Label[]
  selectedLabelId: string | null
  onSelectLabel: (labelId: string) => void
  zoom: number
  onZoomChange: (zoom: number) => void
  minZoom: number
  pageIndex: number
  pageCount: number
  onPageChange: (pageIndex: number) => void
  contentType: Page['contentType'] | null
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

// Default zoom bounds. minZoom is only the floor for a "normal"-sized page —
// AnnotationCanvas passes a smaller value (via the minZoom prop) for pages
// too large to fit the viewport at 50%, so "zoom out" can always reach a
// level that actually shows the whole page width.
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.25

// Everything that acts on the page lives in one row: labels, undo/redo, zoom,
// page navigation, and the page's text-layer state. Undo and redo used to sit in
// a separate strip above, whose only other content was a "← filename" back link;
// the breadcrumb is the back link now, so that strip had nothing left in it.
export function Toolbar({
  labels,
  selectedLabelId,
  onSelectLabel,
  zoom,
  onZoomChange,
  minZoom,
  pageIndex,
  pageCount,
  onPageChange,
  contentType,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: ToolbarProps) {
  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-2) var(--space-3)',
        borderBottom: '2px solid var(--color-divider)',
      }}
    >
      <div
        role="group"
        aria-label="Labels"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}
      >
        {labels.map((label) => {
          const on = selectedLabelId === label.id
          return (
            <button
              key={label.id}
              type="button"
              className="ts-chip"
              aria-pressed={on}
              onClick={() => onSelectLabel(label.id)}
            >
              <span
                className="ts-swatch"
                style={{ width: 11, height: 11, background: label.color }}
                aria-hidden="true"
              />
              <span className="mono" style={{ fontSize: 12, fontWeight: on ? 700 : 400 }}>
                {label.name}
              </span>
              {label.hotkey && (
                <span className="ts-kbd" style={{ minWidth: 17, height: 17, fontSize: 10 }}>
                  {label.hotkey}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷ Redo
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onZoomChange(Math.max(minZoom, zoom - ZOOM_STEP))}
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="mono" style={{ minWidth: 48, textAlign: 'center', fontSize: 12 }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onZoomChange(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={pageIndex <= 0}
          aria-label="Previous page"
        >
          ←
        </button>
        <span className="mono" style={{ minWidth: 84, textAlign: 'center', fontSize: 12 }}>
          Page {pageIndex + 1} / {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={pageIndex >= pageCount - 1}
          aria-label="Next page"
        >
          →
        </button>
      </div>

      {contentType && <ContentTypeBadge contentType={contentType} />}
    </div>
  )
}
