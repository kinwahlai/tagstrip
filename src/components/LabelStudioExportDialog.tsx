import { useState } from 'react'
import type { FormEvent } from 'react'
import { DEFAULT_LABEL_STUDIO_OPTIONS, exportProjectToLabelStudio } from '../lib/labelStudioExport'
import type { LabelStudioExportOptions } from '../lib/labelStudioExport'

const HINT = 'color-mix(in srgb, var(--color-text) 68%, transparent)'

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
      className="dialog-backdrop"
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', zIndex: 50 }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ls-export-title"
        className="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="ls-export-title" className="dialog-title">
            Export to Label Studio
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5, color: HINT }}>
            Best-effort format, reverse-engineered from a Label Studio export sample. Match these
            tag names to your labeling config, then verify the re-import on your Label Studio
            version.
          </p>
        </div>

        <div className="field">
          <label htmlFor="ls-bbox-tag">Rectangle tag name</label>
          <input
            id="ls-bbox-tag"
            className="input mono"
            type="text"
            value={options.bboxTagName}
            onChange={(e) => setOptions((o) => ({ ...o, bboxTagName: e.target.value }))}
          />
        </div>

        <div className="field">
          <label htmlFor="ls-label-tag">Labels tag name</label>
          <input
            id="ls-label-tag"
            className="input mono"
            type="text"
            value={options.labelTagName}
            onChange={(e) => setOptions((o) => ({ ...o, labelTagName: e.target.value }))}
          />
        </div>

        <div>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 14 }}
          >
            <input
              type="checkbox"
              checked={options.includeTranscription}
              onChange={(e) =>
                setOptions((o) => ({ ...o, includeTranscription: e.target.checked }))
              }
              style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }}
            />
            Include transcription text
          </label>
          <p style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.5, color: HINT }}>
            Only turn this on if your Label Studio config has a matching textarea control — a
            mismatched tag name will silently fail to import there.
          </p>
        </div>

        {options.includeTranscription && (
          <div className="field">
            <label htmlFor="ls-transcription-tag">Transcription tag name</label>
            <input
              id="ls-transcription-tag"
              className="input mono"
              type="text"
              value={options.transcriptionTagName}
              onChange={(e) => setOptions((o) => ({ ...o, transcriptionTagName: e.target.value }))}
            />
          </div>
        )}

        {error && (
          <p
            role="alert"
            style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-accent-700)' }}
          >
            {error}
          </p>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Export
          </button>
        </div>
      </form>
    </div>
  )
}
