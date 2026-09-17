import { useState } from 'react'
import type { FormEvent } from 'react'
import { DEFAULT_NATIVE_EXPORT_OPTIONS, exportProjectToFile } from '../lib/nativeExport'
import type { NativeExportOptions } from '../lib/nativeExport'

const HINT = 'color-mix(in srgb, var(--color-text) 68%, transparent)'

export function NativeExportDialog({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const [options, setOptions] = useState<NativeExportOptions>(DEFAULT_NATIVE_EXPORT_OPTIONS)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await exportProjectToFile(projectId, options)
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
        aria-labelledby="native-export-title"
        className="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="native-export-title" className="dialog-title">
            Export JSON
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5, color: HINT }}>
            TagStrip's own format — this is the only file that can restore a project, schema,
            documents and regions from scratch. Choose whether it also carries the original
            document bytes.
          </p>
        </div>

        <div role="radiogroup" aria-label="What to include" style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <input
              type="radio"
              name="native-export-mode"
              checked={options.includeSource}
              onChange={() => setOptions({ includeSource: true })}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--color-accent)' }}
            />
            <span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>
                Include source document
              </span>
              <span style={{ display: 'block', fontSize: 12, lineHeight: 1.5, color: HINT }}>
                Every document's original PDF or image bytes are base64-encoded into the file, on
                top of the schema, regions, transcriptions and notes. Re-importing this file gives
                you back a fully viewable project. Larger file, and it leaves the browser.
              </span>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <input
              type="radio"
              name="native-export-mode"
              checked={!options.includeSource}
              onChange={() => setOptions({ includeSource: false })}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--color-accent)' }}
            />
            <span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>
                Annotations only
              </span>
              <span style={{ display: 'block', fontSize: 12, lineHeight: 1.5, color: HINT }}>
                The schema, every region's coordinates and text, each document's notes and each
                page's content type — no document bytes at all. Dramatically smaller, but
                re-importing it leaves every document showing a placeholder instead of its page.
              </span>
            </span>
          </label>
        </div>

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
