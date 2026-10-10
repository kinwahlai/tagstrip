import { pageWindow } from '../../lib/pageWindow'

interface ToolbarProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  onFitZoom: () => void
  minZoom: number
  pageIndex: number
  pageCount: number
  onPageChange: (pageIndex: number) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

// Default zoom bounds. minZoom is only the floor for a "normal"-sized page —
// AnnotationCanvas passes a smaller value (via the minZoom prop) for pages
// too large to fit the viewport at 50%, so "zoom out" can always reach a
// level that actually shows the whole page.
export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.25

// Drawn, not typed: ↶ and ↷ are not in Archivo, so they fell back to whatever
// system font had them and came out thin, small and off the baseline. The
// buttons carry no word beside the icon: with the words the row was a few
// pixels too wide for one line at 1440px. aria-label and title name them.
function UndoRedoIcon({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

// The toolbar holds what acts on the view — undo/redo, zoom and page navigation — on one row.
// Labels moved to the inspector because a real schema has too many for a row; the text-layer tag
// sits beside the filename in the header.
export function Toolbar({
  zoom,
  onZoomChange,
  onFitZoom,
  minZoom,
  pageIndex,
  pageCount,
  onPageChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: ToolbarProps) {
  // Every slot in the page strip, gap or number, is as wide as the widest page
  // number plus 12px. Otherwise a gap is narrower than a button and the strip,
  // and everything left of it, shifts as you page. 12px is tighter than
  // .btn-sm's own padding and border (20px), about the width of the − and +
  // beside it: with that, the 12px between groups and the narrow zoom readout,
  // the control row fits one line in a 1024px-wide window.
  const pageSlotStyle = {
    width: `calc(${String(pageCount).length}ch + 12px)`,
    paddingInline: 0,
    fontSize: 12,
  }
  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-3)',
        boxSizing: 'border-box',
        minHeight: 'var(--ts-bar)',
        padding: 'var(--space-2) var(--space-3)',
        borderBottom: '2px solid var(--color-divider)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
        >
          <UndoRedoIcon d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
        >
          <UndoRedoIcon d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />
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
        <span
          className="mono"
          data-testid="zoom-readout"
          style={{ minWidth: 40, textAlign: 'center', fontSize: 12 }}
        >
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
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onFitZoom}
          aria-label="Fit page to available width"
        >
          Fit
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onZoomChange(1)}
          aria-label="Zoom to 100%"
        >
          100%
        </button>
      </div>

      <div
        role="group"
        aria-label="Pages"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
      >
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={pageIndex <= 0}
          aria-label="Previous page"
        >
          ←
        </button>
        {pageWindow(pageIndex, pageCount).map((index, slot) =>
          index === null ? (
            <span
              key={`gap-${slot}`}
              className="mono"
              aria-hidden="true"
              style={{ ...pageSlotStyle, textAlign: 'center' }}
            >
              …
            </span>
          ) : (
            <button
              key={`page-${index}`}
              type="button"
              className={`btn ${index === pageIndex ? 'btn-primary' : 'btn-secondary'} btn-sm mono`}
              aria-label={`Page ${index + 1}`}
              aria-current={index === pageIndex ? 'page' : undefined}
              style={pageSlotStyle}
              onClick={() => onPageChange(index)}
            >
              {index + 1}
            </button>
          ),
        )}
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
    </div>
  )
}
