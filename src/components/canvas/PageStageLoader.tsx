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
  onCreateAnnotation: (rect: NormalizedRect) => void
  onSelectAnnotation: (id: string) => void
  onDeselect: () => void
}

// Mount this keyed by page.id (see AnnotationCanvas) so navigating to a
// different page remounts it fresh — that's what resets `imageUrl` to null
// for the new page, with no manual reset needed.
export function PageStageLoader({ page, ...rest }: PageStageLoaderProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
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
  }, [page.id])

  if (!imageUrl) {
    return (
      <p className="p-6 text-sm text-slate-500" role="status">
        Rendering page…
      </p>
    )
  }

  return <PageStage page={page} imageUrl={imageUrl} {...rest} />
}
