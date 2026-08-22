import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { createSchema, SchemaValidationError } from '../db/labelSchemas'
import { importSchemaExport, parseSchemaExport } from '../lib/schemaImport'
import { importNativeExport, parseNativeExport } from '../lib/nativeImport'

const HINT = 'color-mix(in srgb, var(--color-text) 68%, transparent)'
const BODY = 'color-mix(in srgb, var(--color-text) 72%, transparent)'

// The three points the claim rests on. Deliberately never "secure" or
// "encrypted": IndexedDB is plaintext at rest, and this audience checks. The
// claim is location, and it is one they can falsify in ten seconds by pulling
// their network cable — which is also why the "What this is not" strip below
// names the limit rather than leaving it to be discovered.
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

interface FirstRunProps {
  onOpenSchema: (schemaId: string) => void
  onOpenProject: (projectId: string) => void
}

// Nothing in IndexedDB yet. This is the one place the accent runs as a full
// ground rather than as chrome — the claim is the product, so on day one it gets
// the whole width and 52px type. Both themes clear 4.5:1 on that fill because
// --ts-accent-solid steps down the ramp in light and up in dark.
export function FirstRun({ onOpenSchema, onOpenProject }: FirstRunProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      onOpenSchema(await createSchema(name))
    } catch (err) {
      if (err instanceof SchemaValidationError) setError(err.message)
      else throw err
    }
  }

  async function readJson(file: File): Promise<unknown | null> {
    const text = await file.text()
    try {
      return JSON.parse(text)
    } catch {
      setError(`"${file.name}" is not valid JSON — it couldn’t be parsed at all.`)
      return null
    }
  }

  async function handleImportSchema(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const json = await readJson(file)
      if (json === null) return
      onOpenSchema(await importSchemaExport(parseSchemaExport(json)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleImportProject(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const json = await readJson(file)
      if (json === null) return
      onOpenProject(await importNativeExport(parseNativeExport(json)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <div
        style={{
          flex: 'none',
          background: 'var(--ts-accent-solid)',
          color: 'var(--color-bg)',
          padding: 'var(--space-8) var(--space-8) var(--space-6)',
        }}
      >
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-3)',
            opacity: 0.92,
          }}
        >
          No server · no account · no upload
        </span>
        <h1
          style={{
            margin: '0 0 var(--space-3)',
            fontSize: 52,
            letterSpacing: '-0.022em',
            maxWidth: '17ch',
          }}
        >
          Your documents never leave this browser
        </h1>
        <p style={{ margin: 0, maxWidth: '74ch', fontSize: 17, lineHeight: 1.5 }}>
          TagStrip has no server, so you can annotate material you are not permitted to send to a
          third party — customer KYC packets, identity documents, medical records.
        </p>
      </div>

      <div
        style={{
          flex: 'none',
          borderBottom: '2px solid var(--color-divider)',
          background: 'var(--color-surface)',
        }}
      >
        <p
          style={{
            margin: 0,
            padding: 'var(--space-3) var(--space-8)',
            fontSize: '12.5px',
            lineHeight: 1.5,
            maxWidth: '104ch',
            color: 'color-mix(in srgb, var(--color-text) 78%, transparent)',
          }}
        >
          <strong style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
            What this is not:
          </strong>{' '}
          IndexedDB is plaintext at rest: anything that can read this browser profile can read
          your documents. TagStrip adds nothing on top of that. The claim is location, and it is
          one you can falsify in ten seconds by pulling your network cable.
        </p>
      </div>

      <div
        className="ts-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          alignItems: 'start',
        }}
      >
        <section
          data-testid="local-only-panel"
          aria-labelledby="local-only-heading"
          style={{ padding: 'var(--space-8)', borderRight: '2px solid var(--color-divider)' }}
        >
          <h2
            id="local-only-heading"
            className="ts-eyebrow"
            style={{ margin: '0 0 var(--space-4)' }}
          >
            How that works
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {POINTS.map((p, i) => (
              <div
                key={p.title}
                style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4) 0',
                  borderTop: '1px solid var(--color-divider)',
                  borderBottom:
                    i === POINTS.length - 1 ? '1px solid var(--color-divider)' : undefined,
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
                  <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5, color: BODY }}>
                    {p.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ padding: 'var(--space-8)' }}>
          <h2 className="ts-eyebrow" style={{ margin: '0 0 var(--space-3)' }}>
            Start here
          </h2>
          <form
            onSubmit={handleCreate}
            style={{
              border: '2px solid var(--color-divider)',
              padding: 'var(--space-6)',
              background: 'var(--color-surface)',
            }}
          >
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 20 }}>
              Create your first label schema
            </h3>
            <p
              style={{
                margin: '0 0 var(--space-4)',
                fontSize: '13.5px',
                lineHeight: 1.5,
                maxWidth: '46ch',
                color: BODY,
              }}
            >
              A schema is the set of fields you will annotate. Projects take one schema and many
              documents, so this comes first.
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
              <div className="field" style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor="first-schema-name">Schema name</label>
                <input
                  id="first-schema-name"
                  className="input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. KYC passport"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ minHeight: 36 }}>
                Create
              </button>
            </div>
            <p
              className="mono"
              style={{ margin: 'var(--space-2) 0 0', fontSize: '11.5px', color: HINT }}
            >
              Written straight to IndexedDB. Nothing is sent.
            </p>
          </form>

          <h2 className="ts-eyebrow" style={{ margin: 'var(--space-6) 0 var(--space-2)' }}>
            Or import what you have
          </h2>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <label className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              Import schema…
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleImportSchema}
                className="sr-only"
              />
            </label>
            <label className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
              Import project…
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleImportProject}
                className="sr-only"
              />
            </label>
          </div>
          <p
            className="mono"
            style={{ margin: 'var(--space-2) 0 0', fontSize: '11.5px', color: HINT }}
          >
            TagStrip JSON or Label Studio JSON. Read in this tab.
          </p>

          {error && (
            <p
              role="alert"
              style={{
                margin: 'var(--space-3) 0 0',
                fontSize: '12.5px',
                color: 'var(--color-accent-700)',
              }}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
