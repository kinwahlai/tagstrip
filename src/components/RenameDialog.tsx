import { useState } from 'react'
import type { FormEvent } from 'react'

interface RenameDialogProps {
  title: string
  label: string
  initialValue: string
  error?: string | null
  onSubmit: (value: string) => void
  onCancel: () => void
}

// Rename used to swap the rail row for a bare input, which put an unlabelled
// field in a list of buttons and lost the name on any stray blur. It is reached
// from two places now — the overview table and the schema header — so it is one
// dialog with a real label rather than two inline editors.
export function RenameDialog({
  title,
  label,
  initialValue,
  error,
  onSubmit,
  onCancel,
}: RenameDialogProps) {
  const [value, setValue] = useState(initialValue)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(value)
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={onCancel}
      style={{ position: 'fixed', zIndex: 50 }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-dialog-title"
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id="rename-dialog-title" className="dialog-title">
          {title}
        </h2>
        <div className="field">
          <label htmlFor="rename-dialog-input">{label}</label>
          <input
            id="rename-dialog-input"
            className="input"
            type="text"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
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
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
