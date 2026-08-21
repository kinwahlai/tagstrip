import type { ReactNode } from 'react'

interface SurfaceHeaderProps {
  // Names the section — "Labels · 6", "Documents · 62" — not the thing itself.
  // The thing's name is in the breadcrumb, once.
  title: string
  subtitle?: string
  actions?: ReactNode
  error?: string | null
}

export function SurfaceHeader({ title, subtitle, actions, error }: SurfaceHeaderProps) {
  return (
    <div
      style={{
        flex: 'none',
        padding: 'var(--space-4)',
        borderBottom: '2px solid var(--color-divider)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="ts-eyebrow" style={{ margin: '0 0 2px' }}>
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                margin: 0,
                fontSize: '12.5px',
                color: 'color-mix(in srgb, var(--color-text) 65%, transparent)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </div>
      {error && (
        <p
          role="alert"
          style={{
            margin: 'var(--space-2) 0 0',
            fontSize: '12.5px',
            color: 'var(--color-accent-700)',
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
