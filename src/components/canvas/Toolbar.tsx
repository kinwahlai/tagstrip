import type { Label } from '../../db/types'

interface ToolbarProps {
  labels: Label[]
  selectedLabelId: string | null
  onSelectLabel: (labelId: string) => void
  zoom: number
  onZoomChange: (zoom: number) => void
  pageIndex: number
  pageCount: number
  onPageChange: (pageIndex: number) => void
}

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.25

export function Toolbar({
  labels,
  selectedLabelId,
  onSelectLabel,
  zoom,
  onZoomChange,
  pageIndex,
  pageCount,
  onPageChange,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.map((label) => (
          <button
            key={label.id}
            type="button"
            onClick={() => onSelectLabel(label.id)}
            aria-pressed={selectedLabelId === label.id}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
              selectedLabelId === label.id
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                : 'border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'
            }`}
          >
            <span
              className="h-3 w-3 rounded-full border border-black/10"
              style={{ backgroundColor: label.color }}
              aria-hidden="true"
            />
            <span className="text-slate-800 dark:text-slate-100">{label.name}</span>
            {label.hotkey && (
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1 text-[10px] text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {label.hotkey}
              </kbd>
            )}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}
            aria-label="Zoom out"
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            −
          </button>
          <span className="w-12 text-center text-xs text-slate-600 dark:text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}
            aria-label="Zoom in"
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={pageIndex <= 0}
            aria-label="Previous page"
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            ←
          </button>
          <span className="w-20 text-center text-xs text-slate-600 dark:text-slate-300">
            Page {pageIndex + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={pageIndex >= pageCount - 1}
            aria-label="Next page"
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
