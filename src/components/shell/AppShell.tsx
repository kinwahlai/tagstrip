import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { applyTheme, initialTheme } from '../../lib/theme'
import type { Theme } from '../../lib/theme'
import { LocalOnlyBadge } from '../LocalOnlyBadge'

interface AppShellProps {
  crumbTop: string
  crumbMain: string
  // Set only on the annotation canvas, where the breadcrumb's upper line is the
  // way back to the project rather than dead text.
  onCrumbBack?: () => void
  // The rail is the caller's to supply: full on every screen except annotate,
  // which collapses it to 56px so the canvas gains the width back. Below 640px
  // it leaves the flow entirely and `onOpenNav` puts its trigger in the header.
  rail: ReactNode
  onOpenNav?: () => void
  navLabel?: string
  // Below 640px the claim strip cannot share a row with the wordmark and the
  // breadcrumb without one of them being squeezed out. It gets its own row
  // rather than being dropped: it is the product's central claim, and the M4
  // rubric requires it visible at 375px.
  stackClaim: boolean
  children: ReactNode
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="btn btn-secondary"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
      style={{ border: 0, width: 56, padding: 0, justifyContent: 'center', flex: 'none' }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 000 16z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  )
}

// A fixed three-part frame — toolbar, rail, work surface — filling the window
// edge to edge. The header used to span full width over content capped at
// 1024px and centred; that mismatch is gone, and column widths now come from
// one set of tokens on .ts-shell rather than being restated per screen.
export function AppShell({
  crumbTop,
  crumbMain,
  onCrumbBack,
  rail,
  onOpenNav,
  navLabel = 'Show navigation',
  stackClaim,
  children,
}: AppShellProps) {
  return (
    <div
      className="ts-shell"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          flex: 'none',
          borderBottom: '2px solid var(--color-divider)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch', height: 56 }}>
          {onOpenNav && (
            <button
              type="button"
              className="btn btn-secondary"
              aria-label={navLabel}
              onClick={onOpenNav}
              style={{
                border: 0,
                borderRight: '2px solid var(--color-divider)',
                width: 48,
                padding: 0,
                flex: 'none',
                justifyContent: 'center',
              }}
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
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 var(--space-4)',
              borderRight: '2px solid var(--color-divider)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                width: 16,
                height: 16,
                background: 'var(--color-accent)',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 3,
                  top: 6,
                  width: 10,
                  height: 3,
                  background: 'var(--color-bg)',
                }}
              />
            </span>
            {!stackClaim && (
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: 16,
                  letterSpacing: '0.02em',
                }}
              >
                TAGSTRIP
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 1,
              padding: '0 var(--space-4)',
              minWidth: 0,
              flex: 1,
            }}
          >
            {onCrumbBack ? (
              <button
                type="button"
                className="ts-crumb-back"
                title="Back to project (Esc)"
                onClick={onCrumbBack}
                style={{ alignSelf: 'flex-start' }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="square"
                  aria-hidden="true"
                >
                  <path d="M15 6l-6 6 6 6" />
                </svg>
                {crumbTop}
              </button>
            ) : (
              <span className="ts-eyebrow">{crumbTop}</span>
            )}
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {crumbMain}
            </span>
          </div>

          {!stackClaim && <LocalOnlyBadge />}
          <ThemeToggle />
        </div>
        {stackClaim && (
          <div style={{ borderTop: '2px solid var(--color-divider)', display: 'flex' }}>
            <LocalOnlyBadge />
          </div>
        )}
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {rail}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
