// TagStrip's reason to exist, for anyone handling documents they are contractually
// barred from uploading, is that there is nowhere to upload them to. This states it
// at full size in the space an empty schema list would otherwise leave blank.
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
        <rect x="3" y="4" width="14" height="9" strokeWidth="1.5" />
        <path d="M2 16.5h16" strokeWidth="1.5" strokeLinecap="square" />
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
          strokeLinecap="square"
        />
        <path d="M16.5 9.2A3.5 3.5 0 0 1 15.5 15H9" strokeWidth="1.5" strokeLinecap="square" />
        <path d="M3 3l14 14" strokeWidth="1.5" strokeLinecap="square" />
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
          strokeLinecap="square"
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
      style={{ maxWidth: '78ch' }}
    >
      <h2 id="local-only-heading" style={{ margin: '0 0 var(--space-2)', fontSize: 30 }}>
        Your documents never leave this browser
      </h2>
      <p style={{ margin: '0 0 var(--space-6)', maxWidth: '74ch', fontSize: 15, lineHeight: 1.5 }}>
        TagStrip has no server, so you can annotate material you are not permitted to send to a
        third party — customer KYC packets, identity documents, medical records.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {POINTS.map((p, i) => (
          <div
            key={p.title}
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              padding: 'var(--space-4) 0',
              borderTop: '1px solid var(--color-divider)',
              borderBottom: i === POINTS.length - 1 ? '1px solid var(--color-divider)' : undefined,
            }}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
              style={{
                width: 20,
                height: 20,
                flex: 'none',
                marginTop: 2,
                color: 'var(--color-accent-700)',
              }}
            >
              {p.icon}
            </svg>
            <div>
              <h3 style={{ margin: '0 0 3px', fontSize: 15 }}>{p.title}</h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '13.5px',
                  lineHeight: 1.5,
                  color: 'color-mix(in srgb, var(--color-text) 72%, transparent)',
                }}
              >
                {p.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
