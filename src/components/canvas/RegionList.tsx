import { updateAnnotationText } from '../../db/annotations'
import type { Annotation, Label } from '../../db/types'

interface RegionListProps {
  annotations: Annotation[]
  labelsById: Map<string, Label>
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export function RegionList({
  annotations,
  labelsById,
  selectedId,
  onSelect,
  onDelete,
}: RegionListProps) {
  if (annotations.length === 0) {
    return (
      <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
        No regions on this page yet. Pick a label above, then drag on the page to draw one.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
      {annotations.map((annotation) => {
        const label = labelsById.get(annotation.labelId)
        return (
          <li
            key={annotation.id}
            className={`px-3 py-2 ${
              selectedId === annotation.id ? 'bg-indigo-50 dark:bg-indigo-950' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(annotation.id)}
                className="flex flex-1 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: label?.color ?? '#999' }}
                  aria-hidden="true"
                />
                <span className="truncate text-sm text-slate-800 dark:text-slate-100">
                  {label?.name ?? 'Unknown label'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(annotation.id)}
                aria-label={`Delete region for ${label?.name ?? 'unknown label'}`}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete
              </button>
            </div>
            <input
              type="text"
              value={annotation.text ?? ''}
              onChange={(e) => updateAnnotationText(annotation.id, e.target.value)}
              placeholder="Transcription…"
              aria-label={`Transcription for ${label?.name ?? 'unknown label'} region`}
              className="mt-1.5 w-full rounded border border-slate-300 px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </li>
        )
      })}
    </ul>
  )
}
