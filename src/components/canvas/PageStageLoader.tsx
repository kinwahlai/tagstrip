import { useEffect, useState } from 'react'
import { ensurePageRendered } from '../../db/docs'
import { PageStage } from './PageStage'
import type { Annotation, Label, Page } from '../../db/types'
import type { NormalizedRect } from '../../lib/geometry'

interface PageStageLoaderProps {
  page: Page
  zoom: number
  annotations: Annotation[]
  labelsById: Map<string, Label>
  selectedAnnotationId: string | null
  selectedLabelId: string | null
  // True when the document this page belongs to was imported from an
  // annotations-only native export (Doc.sourceMissing — see nativeImport.ts).
  // There is no blob to rasterize and never will be, so this skips
  // ensurePageRendered entirely rather than calling it and catching the
  // throw it's guarded to produce.
  sourceMissing: boolean
  onCreateAnnotation: (rect: NormalizedRect) => void
  onSelectAnnotation: (id: string) => void
  onDeselect: () => void
  onUpdateGeometry: (id: string, before: NormalizedRect, after: NormalizedRect) => void
  onPageElement?: (el: HTMLDivElement | null) => void
}

// Mount this keyed by page.id (see AnnotationCanvas) so navigating to a
// different page remounts it fresh — that's what resets `imageUrl` to null
// for the new page, with no manual reset needed.
export function PageStageLoader({ page, sourceMissing, ...rest }: PageStageLoaderProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (sourceMissing) return // nothing to fetch — see the prop comment above
    let cancelled = false
    let objectUrl: string | null = null

    async function run() {
      const resolved = page.image ? page : await ensurePageRendered(page)
      if (cancelled || !resolved.image) return
      objectUrl = URL.createObjectURL(resolved.image)
      setImageUrl(objectUrl)
    }
    run()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, sourceMissing])

  // A source-missing page has no image coming, ever, so it skips the loading
  // state below and goes straight to PageStage with imageUrl null — that's
  // what tells PageStage to render its placeholder instead of waiting forever
  // on a spinner that will never resolve.
  if (!imageUrl && !sourceMissing) {
    return (
      <p className="p-6 text-sm text-slate-500" role="status">
        Rendering page…
      </p>
    )
  }

  return <PageStage page={page} imageUrl={imageUrl} sourceMissing={sourceMissing} {...rest} />
}
