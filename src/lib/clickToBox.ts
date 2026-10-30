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

export interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

// A gap at least this many line-heights wide splits a detected line. The
// detector joins a printed caption and its value into one line when they sit
// on the same row ("出生日期   2012年5月23日" on p09: a gap of ~0.9 line heights);
// word spaces run ~0.3, gaps inside a value less.
const SPLIT_GAP = 0.6

// Narrows a detector line box ([x0, y0, x1, y1] in the image's pixels) to the
// run of ink under clickX, splitting at wide blank gaps. Null when the click
// falls in such a gap, or clear of any ink.
export function narrowToSegment(
  img: Pixels,
  box: [number, number, number, number],
  clickX: number,
): [number, number, number, number] | null {
  const x0 = Math.max(0, Math.floor(box[0]))
  const y0 = Math.max(0, Math.floor(box[1]))
  const x1 = Math.min(img.width, Math.ceil(box[2]))
  const y1 = Math.min(img.height, Math.ceil(box[3]))
  if (x1 <= x0 || y1 <= y0) return null

  const lum = (x: number, y: number) => {
    const i = (y * img.width + x) * 4
    return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
  }
  let lo = 255
  let hi = 0
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const v = lum(x, y)
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  // No contrast to read gaps from: keep the detector's box.
  if (hi - lo < 30) return [box[0], box[1], box[2], box[3]]
  const threshold = hi - 0.25 * (hi - lo)

  const ink: boolean[] = []
  for (let x = x0; x < x1; x++) {
    let has = false
    for (let y = y0; y < y1 && !has; y++) has = lum(x, y) < threshold
    ink.push(has)
  }

  const minGap = Math.max(1, Math.ceil(SPLIT_GAP * (y1 - y0)))
  const segments: [number, number][] = []
  let start = -1
  let lastInk = -1
  ink.forEach((has, i) => {
    if (!has) return
    if (start === -1) start = i
    else if (i - lastInk - 1 >= minGap) {
      segments.push([start, lastInk + 1])
      start = i
    }
    lastInk = i
  })
  if (start !== -1) segments.push([start, lastInk + 1])

  const cx = clickX - x0
  const hit = segments.find(([a, b]) => cx >= a - minGap / 2 && cx < b + minGap / 2)
  return hit ? [x0 + hit[0], box[1], x0 + hit[1], box[3]] : null
}
