import { useState } from 'react'
import { updateAnnotationText } from '../../db/annotations'
import type { Annotation, Label } from '../../db/types'

interface RegionListProps {
  annotations: Annotation[]
  labelsById: Map<string, Label>
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onSuggestText: (id: string) => Promise<void>
}

const HINT = 'color-mix(in srgb, var(--color-text) 68%, transparent)'

export function RegionList({
  annotations,
  labelsById,
  selectedId,
  onSelect,
  onDelete,
  onSuggestText,
}: RegionListProps) {
  const [suggestingId, setSuggestingId] = useState<string | null>(null)
  const [errorById, setErrorById] = useState<Record<string, string>>({})

  async function handleSuggest(id: string) {
    setSuggestingId(id)
    setErrorById((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    try {
      await onSuggestText(id)
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : String(err),
      }))
    } finally {
      setSuggestingId(null)
    }
  }

  if (annotations.length === 0) {
    return (
      <p style={{ margin: 0, padding: 'var(--space-4)', fontSize: '12.5px', lineHeight: 1.6, color: HINT }}>
        No regions on this page yet. Pick a label above, then drag on the page to draw one.
      </p>
    )
  }

  return (
    <>
      {annotations.map((annotation) => {
        const label = labelsById.get(annotation.labelId)
        const labelName = label?.name ?? 'Unknown label'
        const selected = selectedId === annotation.id
        return (
          <div
            key={annotation.id}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--color-divider)',
              background: selected
                ? 'color-mix(in srgb, var(--color-text) 8%, transparent)'
                : 'transparent',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 7,
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(annotation.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  padding: 0,
                  background: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span
                  className="ts-swatch"
                  style={{ background: label?.color ?? '#999' }}
                  aria-hidden="true"
                />
                <span
                  className="mono"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '12.5px',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {labelName}
                </span>
              </button>
              {annotation.ocrSuggested && (
                <span className="tag tag-accent" style={{ fontSize: '9.5px', fontWeight: 600 }}>
                  OCR
                </span>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onDelete(annotation.id)}
                aria-label={`Delete region for ${labelName}`}
              >
                Delete
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
              <input
                className="input mono"
                type="text"
                value={annotation.text ?? ''}
                onChange={(e) => updateAnnotationText(annotation.id, e.target.value)}
                placeholder="Transcription…"
                aria-label={`Transcription for ${labelName} region`}
                style={{ minHeight: 30, fontSize: '12.5px' }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => handleSuggest(annotation.id)}
                disabled={suggestingId === annotation.id}
              >
                {suggestingId === annotation.id ? 'Suggesting…' : 'Suggest text'}
              </button>
            </div>
            {errorById[annotation.id] && (
              <p
                role="alert"
                style={{
                  margin: '5px 0 0',
                  fontSize: 11,
                  color: 'var(--color-accent-700)',
                }}
              >
                {errorById[annotation.id]}
              </p>
            )}
          </div>
        )
      })}
    </>
  )
}
