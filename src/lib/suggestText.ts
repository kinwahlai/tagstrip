import { extractTextFromLayer } from './textLayerExtraction'
import { cropPageRegion } from './ocrCrop'
import type { NormalizedRect } from './geometry'
import type { Page } from '../db/types'

export interface SuggestTextResult {
  text: string
  ocrSuggested: boolean
}

// The two-tier "Suggest text" flow from SPEC.md M4.5:
//   1. Text-layer extraction — free, exact, no model. Tried whenever the page
//      has one, regardless of contentType, since a "text" page's layer might
//      not cover every region and a manually-overridden page could still have
//      a usable layer underneath.
//   2. OCR fallback — only when step 1 finds nothing. Crops the region out of
//      the page image and runs it through the OCR engine (PP-OCRv6,
//      English and Chinese — see src/lib/ocr/ppocr.ts). The engine module
//      (and the ~57MB of model and WASM files it loads from the app's own
//      origin) is dynamically imported here, so nothing is fetched unless this
//      branch actually runs.
export async function suggestText(page: Page, rect: NormalizedRect): Promise<SuggestTextResult> {
  if (page.textLayer) {
    const extracted = extractTextFromLayer(page.textLayer, rect)
    if (extracted) return { text: extracted, ocrSuggested: false }
  }

  if (!page.image) {
    throw new Error('This page has not finished rendering yet — try again in a moment.')
  }

  const crop = await cropPageRegion(page.image, rect, page.width, page.height)
  const { ppocrEngine, ppocrBackend } = await import('./ocr/ppocr')
  const result = await ppocrEngine.recognize(crop)
  // Which backend ran, for the verify driver to read (a window property, not shown in the UI).
  ;(window as unknown as { __ocrBackend?: string | null }).__ocrBackend = ppocrBackend()
  return { text: result.text, ocrSuggested: true }
}
