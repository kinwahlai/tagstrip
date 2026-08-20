// TagStrip's main reason to exist, for anyone handling documents they are not
// permitted to upload, is that there is nowhere to upload them to. That belongs in
// the chrome, not only in the README.
//
// Deliberately a monitor rather than a padlock: IndexedDB is not encrypted at rest,
// so a padlock would imply a guarantee this does not make, to exactly the audience
// most likely to check.
export function LocalOnlyBadge() {
  return (
    <span
      data-testid="local-only-badge"
      title="Documents, annotations, and label schemas are stored in this browser (IndexedDB). Nothing is uploaded — TagStrip has no server."
      className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
        <rect x="3" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 16.5h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      Nothing leaves your browser
    </span>
  )
}
