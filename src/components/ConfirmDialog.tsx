interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={onCancel}
      // The design system's .dialog-backdrop is absolute, since it was drawn
      // inside a fixed mockup frame. In the app it has to cover the viewport.
      style={{ position: 'fixed', zIndex: 50 }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="dialog-title">
          {title}
        </h2>
        <p className="dialog-body" style={{ margin: 0 }}>
          {message}
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
