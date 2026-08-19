import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { setPageContentType, updateDocNotes } from '../db/docs'
import { ContentTypeBadge } from './ContentTypeBadge'
import type { Doc, Page } from '../db/types'

const CONTENT_TYPES: Page['contentType'][] = ['text', 'scanned', 'unknown']

export function DocDetail({
  doc,
  onOpenAnnotate,
}: {
  doc: Doc
  onOpenAnnotate: (docId: string) => void
}) {
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
    <div>
      <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
        {doc.filename}
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {doc.sourceType.toUpperCase()} · {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'}
      </p>

      <button
        type="button"
        onClick={() => onOpenAnnotate(doc.id)}
        className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        Open annotation canvas
      </button>

      <div className="mt-4">
        <label
          htmlFor="doc-notes"
          className="block text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          Notes
        </label>
        <textarea
          id="doc-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          rows={3}
          placeholder="Free-form notes about this document..."
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-medium text-slate-600 dark:text-slate-300">Pages</h3>
        {pages === undefined ? null : (
          <ul
            data-testid="page-nav-strip"
            className="mt-1 divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-700 dark:border-slate-700"
          >
            {pages.map((page) => (
              <li key={page.id} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-16 text-sm text-slate-600 dark:text-slate-300">
                  Page {page.pageIndex + 1}
                </span>
                <ContentTypeBadge contentType={page.contentType} />
                {page.contentTypeOverridden && (
                  <span className="text-xs text-slate-400">(overridden)</span>
                )}
                <label className="ml-auto flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  Override
                  <select
                    aria-label={`Content type for page ${page.pageIndex + 1}`}
                    value={page.contentType}
                    onChange={(e) => handleOverride(page.id, e)}
                    className="rounded border border-slate-300 px-1 py-0.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {CONTENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
