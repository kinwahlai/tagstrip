import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { ensurePageRendered } from '../db/docs'

// Pages are rasterized lazily, so the first page of a document a user has never
// opened has no image yet. Rendering it here is the same on-demand path the
// canvas uses — it is not a second thumbnail pipeline, and it does not rasterize
// anything beyond the page actually shown.
export function PagePreview({
  docId,
  pageCount,
  sourceMissing = false,
}: {
  docId: string
  pageCount: number
  // This document was imported without its source (Doc.sourceMissing) — there
  // is no blob to rasterize, so this skips ensurePageRendered and shows a
  // stated placeholder instead of a "rendering page" spinner that would never
  // resolve.
  sourceMissing?: boolean
}) {
  const page = useLiveQuery(
    () => db.pages.where('[documentId+pageIndex]').equals([docId, 0]).first(),
    [docId],
  )
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!page || sourceMissing) return
    let cancelled = false
    let objectUrl: string | null = null

    async function run() {
      const resolved = page!.image ? page! : await ensurePageRendered(page!)
      if (cancelled || !resolved.image) return
      objectUrl = URL.createObjectURL(resolved.image)
      setImageUrl(objectUrl)
    }
    run()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [page, sourceMissing])

  const aspect = page ? page.width / page.height : 0.707

  return (
    <div className="ts-page" style={{ width: '100%', aspectRatio: aspect }}>
      {sourceMissing ? (
        <span className="ts-page-note" role="status">
          source not included
          <br />on export
        </span>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={`Page 1 of ${pageCount}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      ) : (
        <span className="ts-page-note" role="status">
          rendering page
          <br />1 of {pageCount}
        </span>
      )}
    </div>
  )
}
