import { describe, expect, it } from 'vitest'
import { suggestText } from './suggestText'
import type { Page } from '../db/types'

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    documentId: 'doc-1',
    pageIndex: 0,
    width: 1000,
    height: 1400,
    contentType: 'text',
    ...overrides,
  }
}

describe('suggestText', () => {
  it('uses the text layer and never touches OCR when it finds a match', async () => {
    const page = makePage({
      textLayer: [{ str: 'Jane Doe', x: 0.1, y: 0.1, width: 0.2, height: 0.03 }],
    })
    const result = await suggestText(page, { x: 0.08, y: 0.09, width: 0.25, height: 0.05 })
    expect(result).toEqual({ text: 'Jane Doe', ocrSuggested: false })
  })

  it('throws a clear error instead of silently failing when OCR is needed but the page has no image yet', async () => {
    const page = makePage({ contentType: 'scanned', textLayer: undefined, image: undefined })
    await expect(suggestText(page, { x: 0, y: 0, width: 0.1, height: 0.1 })).rejects.toThrow(
      /has not finished rendering/,
    )
  })
})
