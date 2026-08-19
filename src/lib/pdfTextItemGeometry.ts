import type { PdfTextItem } from '../db/types'

// Minimal PDF text item shape this module needs — kept independent of
// pdfjs-dist so it (and its tests) don't drag in pdf.js's worker/canvas glue,
// which requires browser globals (DOMMatrix, etc.) unavailable in jsdom.
export interface PdfTextRunLike {
  str: string
  transform: number[]
  width: number
  height: number
}

function applyAffineTransform(x: number, y: number, m: number[]): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

// Converts one pdf.js text item into a normalized (0-1) bounding box in the
// given viewport's pixel space.
//
// item.width/item.height are already real page-space magnitudes (font size
// baked in) — NOT glyph-space units needing item.transform's own a/b/c/d
// scale applied to them. Transforming a corner point like (item.width, 0)
// through item.transform (as an earlier version of this function did) reapplies
// that same font-size scale a second time, inflating the box by roughly the
// font size. The fix: derive unit direction vectors from item.transform
// (magnitude 1, so no scale is reintroduced) and use THOSE with
// item.width/item.height to build the box's corners in page space, then
// transform only those points — not raw magnitudes — through the viewport
// transform.
export function textItemBoundingBox(
  item: PdfTextRunLike,
  viewportTransform: number[],
  viewportWidth: number,
  viewportHeight: number,
): PdfTextItem {
  const [a, b, c, d, e, f] = item.transform

  const xNorm = Math.hypot(a, b) || 1
  const ux = a / xNorm
  const uy = b / xNorm

  const yNorm = Math.hypot(c, d) || 1
  const vx = c / yNorm
  const vy = d / yNorm

  // Corners in PDF page space: origin is the text's baseline-left point;
  // width extends along the text's local x-direction, height along its local
  // y-direction (toward the ascent).
  const corners: [number, number][] = [
    [e, f],
    [e + ux * item.width, f + uy * item.width],
    [e + vx * item.height, f + vy * item.height],
    [e + ux * item.width + vx * item.height, f + uy * item.width + vy * item.height],
  ]

  const viewportCorners = corners.map(([x, y]) => applyAffineTransform(x, y, viewportTransform))

  const xs = viewportCorners.map((p) => p[0])
  const ys = viewportCorners.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)

  return {
    str: item.str,
    x: minX / viewportWidth,
    y: minY / viewportHeight,
    width: (maxX - minX) / viewportWidth,
    height: (maxY - minY) / viewportHeight,
  }
}
