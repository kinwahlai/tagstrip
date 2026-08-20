// TagStrip's reason to exist, for anyone handling documents they are contractually
// barred from uploading, is that there is nowhere to upload them to. This states it
// at full size in the space the schemas view would otherwise leave empty.
//
// Deliberately never says "secure" or "encrypted": IndexedDB is plaintext at rest, and
// this audience checks. The claim is location, and it is one they can falsify in ten
// seconds by pulling their network cable.
const POINTS = [
  {
    title: 'Stored on your device',
    body: "Documents, page images, annotations, and label schemas live in this browser's IndexedDB.",
    icon: (
      <>
        <rect x="3" y="4" width="14" height="9" rx="1.5" strokeWidth="1.5" />
        <path d="M2 16.5h16" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: 'Nothing is uploaded',
    body: 'No account, no backend, no telemetry. There is no server to send it to.',
    icon: (
      <>
        <path
          d="M5.5 15a3.5 3.5 0 0 1-.4-6.98 5 5 0 0 1 9.2-1.7"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M16.5 9.2A3.5 3.5 0 0 1 15.5 15H9" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M3 3l14 14" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: 'Works offline',
    body: 'Load the page once, disconnect, and keep working — text extraction and OCR included.',
    icon: (
      <>
        <path
          d="M10 3v6.5M10 17a6 6 0 0 0 4.6-9.9M10 17a6 6 0 0 1-4.6-9.9"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>
    ),
  },
]

export function LocalOnlyPanel() {
  return (
    <section
      data-testid="local-only-panel"
      aria-labelledby="local-only-heading"
      className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-6 dark:border-indigo-900/60 dark:bg-indigo-950/30"
    >
      <h2
        id="local-only-heading"
        className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50"
      >
        Your documents never leave this browser
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        TagStrip has no server, so you can annotate material you are not permitted to send to a
        third party — customer KYC packets, identity documents, medical records.
      </p>

      <ul className="mt-6 space-y-4">
        {POINTS.map((p) => (
          <li key={p.title} className="flex gap-3">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400"
            >
              {p.icon}
            </svg>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{p.title}</p>
              <p className="mt-0.5 max-w-prose text-sm text-slate-600 dark:text-slate-400">
                {p.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
