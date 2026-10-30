import { clamp, type NormalizedRect } from './geometry'
import type { PdfTextItem } from '../db/types'

// Click to box (TS-19): a single click on printed text becomes a region around
// that text. Text-layer pages use the stored box of the pdf.js item under the
// click; other pages run the OCR line detector on a window around the click.

export interface NormalizedPoint {
  x: number
  y: number
}

// Breathing room around the text, as a fraction of the page. Kept small so the
// box does not reach into the neighbouring line or item.
export const CLICK_BOX_MARGIN = 0.001

// The strip of page the detector reads: the full width (a line can run across
// the page) and a band this tall around the click. A strip, not the whole page,
// because the detector shrinks its input to 960 px on the long side, and on a
// whole page small print shrinks away.
const WINDOW_HEIGHT = 0.1

function contains(r: NormalizedRect, p: NormalizedPoint): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
}

// The smallest box under the point, so a value nested in a wider item wins.
function smallestContaining<T extends NormalizedRect>(rects: T[], p: NormalizedPoint): T | null {
  let best: T | null = null
  for (const r of rects) {
    if (!contains(r, p)) continue
    if (!best || r.width * r.height < best.width * best.height) best = r
  }
  return best
}

export function pickTextItem(items: PdfTextItem[], p: NormalizedPoint): PdfTextItem | null {
  return smallestContaining(
    items.filter((i) => i.str.trim() !== ''),
    p,
  )
}

export function pickLineBox(lines: NormalizedRect[], p: NormalizedPoint): NormalizedRect | null {
  return smallestContaining(lines, p)
}

export function padRect(r: NormalizedRect, margin: number): NormalizedRect {
  const x = clamp(r.x - margin, 0, 1)
  const y = clamp(r.y - margin, 0, 1)
  const right = clamp(r.x + r.width + margin, 0, 1)
  const bottom = clamp(r.y + r.height + margin, 0, 1)
  return { x, y, width: right - x, height: bottom - y }
}

export function clickWindow(p: NormalizedPoint): NormalizedRect {
  const y = clamp(p.y - WINDOW_HEIGHT / 2, 0, 1 - WINDOW_HEIGHT)
  return { x: 0, y, width: 1, height: WINDOW_HEIGHT }
}
