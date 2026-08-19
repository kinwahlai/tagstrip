import type { NormalizedRect } from './geometry'
import type { PdfTextItem } from '../db/types'

const MIN_OVERLAP_FRACTION = 0.4

function intersectionArea(rect: NormalizedRect, item: PdfTextItem): number {
  const x1 = Math.max(rect.x, item.x)
  const y1 = Math.max(rect.y, item.y)
  const x2 = Math.min(rect.x + rect.width, item.x + item.width)
  const y2 = Math.min(rect.y + rect.height, item.y + item.height)
  if (x2 <= x1 || y2 <= y1) return 0
  return (x2 - x1) * (y2 - y1)
}

// Tier 1 of the "Suggest text" flow (SPEC.md M4.5): the free, exact case —
// no OCR model, just the PDF's own text layer. Finds every text-layer item
// substantially overlapping the drawn box and joins them in reading order
// (top-to-bottom, then left-to-right within a line). Returns '' if nothing
// in the text layer overlaps the box, signaling the caller to fall back to OCR.
export function extractTextFromLayer(textLayer: PdfTextItem[], rect: NormalizedRect): string {
  const matches = textLayer.filter((item) => {
    const itemArea = item.width * item.height
    if (itemArea <= 0) return false
    return intersectionArea(rect, item) / itemArea >= MIN_OVERLAP_FRACTION
  })
  if (matches.length === 0) return ''

  const avgHeight = matches.reduce((sum, item) => sum + item.height, 0) / matches.length
  const lineTolerance = avgHeight / 2

  const byPosition = [...matches].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: PdfTextItem[][] = []
  for (const item of byPosition) {
    const line = lines.find((l) => Math.abs(l[0].y - item.y) <= lineTolerance)
    if (line) line.push(item)
    else lines.push([item])
  }
  lines.forEach((line) => line.sort((a, b) => a.x - b.x))
  lines.sort((a, b) => a[0].y - b[0].y)

  return lines
    .map((line) => line.map((item) => item.str).join(' '))
    .join('\n')
    .trim()
}
