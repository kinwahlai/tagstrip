import { useState } from 'react'
import type { FormEvent } from 'react'
import { DEFAULT_LABEL_STUDIO_OPTIONS, exportProjectToLabelStudio } from '../lib/labelStudioExport'
import type { LabelStudioExportOptions } from '../lib/labelStudioExport'

export function LabelStudioExportDialog({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const [options, setOptions] = useState<LabelStudioExportOptions>(DEFAULT_LABEL_STUDIO_OPTIONS)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await exportProjectToLabelStudio(projectId, options)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ls-export-title"
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="ls-export-title"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Export to Label Studio
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Best-effort format, reverse-engineered from a Label Studio export sample. Match these tag
          names to your labeling config, then verify the re-import on your Label Studio version.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="ls-bbox-tag"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Rectangle tag name
            </label>
            <input
              id="ls-bbox-tag"
              type="text"
              value={options.bboxTagName}
              onChange={(e) => setOptions((o) => ({ ...o, bboxTagName: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="ls-label-tag"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Labels tag name
            </label>
            <input
              id="ls-label-tag"
              type="text"
              value={options.labelTagName}
              onChange={(e) => setOptions((o) => ({ ...o, labelTagName: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={options.includeTranscription}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, includeTranscription: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600"
              />
              Include transcription text
            </label>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Only turn this on if your Label Studio config has a matching textarea control — a
              mismatched tag name will silently fail to import there.
            </p>
          </div>
          {options.includeTranscription && (
            <div>
              <label
                htmlFor="ls-transcription-tag"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Transcription tag name
              </label>
              <input
                id="ls-transcription-tag"
                type="text"
                value={options.transcriptionTagName}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, transcriptionTagName: e.target.value }))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Export
          </button>
        </div>
      </form>
    </div>
  )
}
