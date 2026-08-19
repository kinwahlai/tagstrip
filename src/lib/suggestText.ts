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
//      the page image and runs it through the OCR engine. The engine module
//      (and its ~4MB of WASM/model assets) is dynamically imported here, so
//      it's never fetched unless this branch actually runs.
export async function suggestText(page: Page, rect: NormalizedRect): Promise<SuggestTextResult> {
  if (page.textLayer) {
    const extracted = extractTextFromLayer(page.textLayer, rect)
    if (extracted) return { text: extracted, ocrSuggested: false }
  }

  if (!page.image) {
    throw new Error('This page has not finished rendering yet — try again in a moment.')
  }

  const crop = await cropPageRegion(page.image, rect, page.width, page.height)
  const { tesseractEngine } = await import('./ocr/tesseract')
  const result = await tesseractEngine.recognize(crop)
  return { text: result.text, ocrSuggested: true }
}
