interface MiniRailProps {
  docIndex: number
  docTotal: number
  overlayOpen: boolean
  onToggleOverlay: () => void
  onPrevDoc: () => void
  onNextDoc: () => void
  hasPrev: boolean
  hasNext: boolean
}

// Annotate is the only screen that collapses the rail. The canvas gains the rail's
// width back, and what is left is the part you still need mid-batch: reach the
// document list, and step to the next document without leaving the canvas at all.
export function MiniRail({
  docIndex,
  docTotal,
  overlayOpen,
  onToggleOverlay,
  onPrevDoc,
  onNextDoc,
  hasPrev,
  hasNext,
}: MiniRailProps) {
  return (
    <nav
      aria-label="Navigation"
      style={{
        flex: 'none',
        width: 'var(--ts-rail-collapsed)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 'var(--space-2) 0',
        borderRight: '2px solid var(--color-divider)',
      }}
    >
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        aria-label="Show documents in this project"
        aria-expanded={overlayOpen}
        onClick={onToggleOverlay}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div
        style={{
          width: 24,
          height: 2,
          background: 'var(--color-divider)',
          margin: 'var(--space-2) 0',
        }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        style={{ borderColor: 'transparent' }}
        aria-label="Previous document"
        onClick={onPrevDoc}
        disabled={!hasPrev}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          aria-hidden="true"
        >
          <path d="M12 19V5M12 5l-6 6M12 5l6 6" />
        </svg>
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        style={{ borderColor: 'transparent' }}
        aria-label="Next document"
        onClick={onNextDoc}
        disabled={!hasNext}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          aria-hidden="true"
        >
          <path d="M12 5v14M12 19l-6-6M12 19l6-6" />
        </svg>
      </button>
      <div style={{ flex: 1 }} />
      <span
        className="mono"
        style={{
          fontSize: 10,
          textAlign: 'center',
          lineHeight: 1.4,
          color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
        }}
      >
        {docIndex}
        <br />
        of {docTotal}
      </span>
    </nav>
  )
}
