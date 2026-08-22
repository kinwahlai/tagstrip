import type { ReactNode } from 'react'

// Below 640px the rail has no room in the flow, so it opens over the work
// surface instead of pushing it. Same reasoning as the canvas document overlay:
// a push would reflow whatever you were reading to make room for the menu.
export function RailOverlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        background: 'color-mix(in srgb, #000 42%, transparent)',
      }}
    >
      <div
        role="dialog"
        aria-label="Schemas and projects"
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 'none',
          maxWidth: '86vw',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            flex: 'none',
            display: 'flex',
            justifyContent: 'flex-end',
            padding: 'var(--space-2) var(--space-3)',
            borderBottom: '2px solid var(--color-divider)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label="Close navigation"
            onClick={onClose}
            style={{ padding: '3px 7px' }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
