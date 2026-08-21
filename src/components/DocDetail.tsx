import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { setPageContentType, updateDocNotes } from '../db/docs'
import { ContentTypeBadge } from './ContentTypeBadge'
import { PagePreview } from './PagePreview'
import type { Doc, Page } from '../db/types'

const CONTENT_TYPES: Page['contentType'][] = ['text', 'scanned', 'unknown']
const HINT = 'color-mix(in srgb, var(--color-text) 65%, transparent)'

// The document's own name is in the breadcrumb and the header above this, so the
// body starts straight in on what it holds: the page as it will actually be
// annotated, the notes, and the per-page content type that decides which route
// Suggest text takes.
export function DocDetail({ doc }: { doc: Doc }) {
  const pages = useLiveQuery(
    () => db.pages.where('documentId').equals(doc.id).sortBy('pageIndex'),
    [doc.id],
  )
  const [notes, setNotes] = useState(doc.notes ?? '')

  async function handleNotesBlur() {
    if (notes !== (doc.notes ?? '')) {
      await updateDocNotes(doc.id, notes)
    }
  }

  async function handleOverride(pageId: string, e: ChangeEvent<HTMLSelectElement>) {
    await setPageContentType(pageId, e.target.value as Page['contentType'])
  }

  return (
    <div
      className="ts-scroll"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '288px 1fr',
        alignItems: 'start',
      }}
    >
      <div style={{ padding: 'var(--space-4)', borderRight: '2px solid var(--color-divider)' }}>
        <h3 className="ts-eyebrow" style={{ margin: '0 0 var(--space-3)' }}>
          Page 1 preview
        </h3>
        <PagePreview key={doc.id} docId={doc.id} pageCount={doc.pageCount} />
        <p
          className="mono"
          style={{ margin: 'var(--space-2) 0 0', fontSize: 11, lineHeight: 1.5, color: HINT }}
        >
          Rasterised on demand by pdf.js, so a long PDF does not render every page up front.
        </p>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        <div className="field" style={{ maxWidth: '60ch' }}>
          <label htmlFor="doc-notes">Notes</label>
          <textarea
            id="doc-notes"
            className="input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Free-form notes about this document..."
            style={{ minHeight: 66, fontSize: '13.5px' }}
          />
          <p className="mono" style={{ margin: '5px 0 0', fontSize: 11, color: HINT }}>
            Saved to IndexedDB when you click away.
          </p>
        </div>

        <h3 className="ts-eyebrow" style={{ margin: 'var(--space-6) 0 var(--space-2)' }}>
          Pages · {doc.pageCount}
        </h3>
        {pages !== undefined && (
          <div data-testid="page-nav-strip" style={{ border: '2px solid var(--color-divider)' }}>
            {pages.map((page) => (
              <div
                key={page.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderBottom: '1px solid var(--color-divider)',
                }}
              >
                <span style={{ flex: 'none', width: 62, fontSize: 13 }}>
                  Page {page.pageIndex + 1}
                </span>
                <ContentTypeBadge contentType={page.contentType} />
                {page.contentTypeOverridden && (
                  <span style={{ fontSize: 11, color: HINT }}>(overridden)</span>
                )}
                <label
                  style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: '11.5px',
                    color: HINT,
                  }}
                >
                  Override
                  <select
                    className="input mono"
                    aria-label={`Content type for page ${page.pageIndex + 1}`}
                    value={page.contentType}
                    onChange={(e) => handleOverride(page.id, e)}
                    style={{ width: 104, minHeight: 28, fontSize: '11.5px', padding: '2px 6px' }}
                  >
                    {CONTENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        )}
        <p
          className="mono"
          style={{ margin: 'var(--space-2) 0 0', fontSize: 11, lineHeight: 1.5, color: HINT }}
        >
          Detected per page on import. Overriding one changes which route Suggest text takes on it.
        </p>
      </div>
    </div>
  )
}
