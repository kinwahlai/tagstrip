// Value-to-line matching for TS-16: given a field's value and the text lines Florence-2 found
// (each with a box), returns the box where the value is printed, or null. Plain code, no model.
// Order: exact normalised match, value inside a longer line, closest line by edit distance,
// value split over two vertically adjacent lines (union box).
import { normalise } from '../ocrEval/score'
import type { Box } from './score'

export interface Line {
  text: string
  box: Box
}

export const MAX_EDIT_RATIO = 0.25

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

// Edit distance over the longer length, 0 = identical, 1 = nothing shared.
export function editRatio(a: string, b: string): number {
  const n = Math.max(a.length, b.length)
  return n === 0 ? 0 : editDistance(a, b) / n
}

export function unionBox(a: Box, b: Box): Box {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

// Vertically adjacent: b starts below a's top, and the gap between a's bottom and b's top is at
// most one line height of the shorter line. Lines overlapping in height still count (gap < 0).
function stacked(a: Box, b: Box): boolean {
  const h = Math.min(a[3] - a[1], b[3] - b[1])
  return b[1] > a[1] && b[1] - a[3] <= h
}

export function matchLines(value: string, lines: Line[]): Box | null {
  const v = normalise(value)
  if (v === '') return null
  const norm = lines.map((l) => normalise(l.text))

  const exact = norm.findIndex((n) => n === v)
  if (exact >= 0) return lines[exact].box

  // Several lines may contain the value; the shortest one is the tightest fit.
  let inside = -1
  norm.forEach((n, i) => {
    if (n.includes(v) && (inside < 0 || n.length < norm[inside].length)) inside = i
  })
  if (inside >= 0) return lines[inside].box

  let near = -1
  let nearRatio = Infinity
  norm.forEach((n, i) => {
    if (n === '') return
    const r = editRatio(n, v)
    if (r < nearRatio) {
      near = i
      nearRatio = r
    }
  })
  if (near >= 0 && nearRatio <= MAX_EDIT_RATIO) return lines[near].box

  let split: Box | null = null
  let splitRatio = Infinity
  for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < lines.length; j++) {
      if (i === j || !stacked(lines[i].box, lines[j].box)) continue
      const r = editRatio(norm[i] + norm[j], v)
      if (r <= MAX_EDIT_RATIO && r < splitRatio) {
        split = unionBox(lines[i].box, lines[j].box)
        splitRatio = r
      }
    }
  }
  return split
}
