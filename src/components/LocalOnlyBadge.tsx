// TagStrip's main reason to exist, for anyone handling documents they are not
// permitted to upload, is that there is nowhere to upload them to. That belongs in
// the chrome, not only in the README.
//
// Deliberately a monitor rather than a padlock: IndexedDB is not encrypted at rest,
// so a padlock would imply a guarantee this does not make, to exactly the audience
// most likely to check.
export function LocalOnlyBadge() {
  return (
    <div
      data-testid="local-only-badge"
      title="Documents, annotations, and label schemas are stored in this browser (IndexedDB). Nothing is uploaded — TagStrip has no server."
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        padding: '0 var(--space-4)',
        borderLeft: '2px solid var(--color-divider)',
        borderRight: '2px solid var(--color-divider)',
        minHeight: 34,
        flex: 'none',
      }}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
        style={{ width: 15, height: 15, flex: 'none', color: 'var(--color-accent-700)' }}
      >
        <rect x="3" y="4" width="14" height="9" strokeWidth="1.5" />
        <path d="M2 16.5h16" strokeWidth="1.5" strokeLinecap="square" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          fontSize: '13.5px',
          whiteSpace: 'nowrap',
          color: 'var(--color-accent-700)',
        }}
      >
        Nothing leaves your browser
      </span>
    </div>
  )
}
