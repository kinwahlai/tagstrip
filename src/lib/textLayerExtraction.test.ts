import { describe, expect, it } from 'vitest'
import { extractTextFromLayer } from './textLayerExtraction'
import type { PdfTextItem } from '../db/types'

describe('extractTextFromLayer', () => {
  it('returns an empty string when nothing overlaps the box', () => {
    const textLayer: PdfTextItem[] = [{ str: 'Hello', x: 0, y: 0, width: 0.1, height: 0.02 }]
    const result = extractTextFromLayer(textLayer, { x: 0.5, y: 0.5, width: 0.1, height: 0.1 })
    expect(result).toBe('')
  })

  it('extracts a single overlapping item', () => {
    const textLayer: PdfTextItem[] = [{ str: 'John Doe', x: 0.1, y: 0.1, width: 0.2, height: 0.03 }]
    const result = extractTextFromLayer(textLayer, { x: 0.08, y: 0.09, width: 0.25, height: 0.05 })
    expect(result).toBe('John Doe')
  })

  it('ignores items only barely clipped by the box edge', () => {
    // Item mostly outside the box — less than the 40% overlap threshold.
    const textLayer: PdfTextItem[] = [{ str: 'Outside', x: 0.5, y: 0.5, width: 0.2, height: 0.02 }]
    const result = extractTextFromLayer(textLayer, { x: 0.55, y: 0.5, width: 0.03, height: 0.02 })
    expect(result).toBe('')
  })

  it('joins same-line items left-to-right and stacks separate lines top-to-bottom', () => {
    const textLayer: PdfTextItem[] = [
      // Second word of line 1, listed first to prove sorting works.
      { str: 'Doe', x: 0.2, y: 0.1, width: 0.1, height: 0.03 },
      { str: 'John', x: 0.1, y: 0.1, width: 0.08, height: 0.03 },
      // Line 2, well below line 1.
      { str: '1990-01-01', x: 0.1, y: 0.2, width: 0.15, height: 0.03 },
    ]
    const result = extractTextFromLayer(textLayer, { x: 0, y: 0, width: 1, height: 1 })
    expect(result).toBe('John Doe\n1990-01-01')
  })
})
