import { describe, expect, it } from 'vitest'
import {
  CLICK_BOX_MARGIN,
  clickWindow,
  narrowToSegment,
  pickLineBox,
  pickTextItem,
  padRect,
} from './clickToBox'
import type { PdfTextItem } from '../db/types'

const item = (str: string, x: number, y: number, width: number, height: number): PdfTextItem => ({
  str,
  x,
  y,
  width,
  height,
})

describe('pickTextItem', () => {
  const items = [
    item('Account number', 0.1, 0.1, 0.2, 0.02),
    item('48 Rusholme Grove', 0.1, 0.14, 0.25, 0.02),
  ]

  it('returns the item under the point', () => {
    expect(pickTextItem(items, { x: 0.2, y: 0.15 })?.str).toBe('48 Rusholme Grove')
  })

  it('returns nothing for a point between items', () => {
    expect(pickTextItem(items, { x: 0.2, y: 0.13 })).toBeNull()
  })

  it('picks the smallest of overlapping items', () => {
    const nested = [item('whole line', 0.1, 0.1, 0.5, 0.03), item('value', 0.3, 0.1, 0.1, 0.03)]
    expect(pickTextItem(nested, { x: 0.35, y: 0.11 })?.str).toBe('value')
  })

  it('skips whitespace-only items', () => {
    expect(pickTextItem([item('   ', 0.1, 0.1, 0.2, 0.02)], { x: 0.2, y: 0.11 })).toBeNull()
  })
})

describe('pickLineBox', () => {
  const lines = [
    { x: 0.1, y: 0.1, width: 0.4, height: 0.03 },
    { x: 0.1, y: 0.15, width: 0.4, height: 0.03 },
  ]

  it('returns the line under the point', () => {
    expect(pickLineBox(lines, { x: 0.3, y: 0.16 })).toEqual(lines[1])
  })

  it('returns nothing for a point in no line', () => {
    expect(pickLineBox(lines, { x: 0.3, y: 0.14 })).toBeNull()
  })
})

describe('padRect', () => {
  it('grows the box by the margin on every side, clamped to the page', () => {
    const r = padRect({ x: 0, y: 0.5, width: 0.2, height: 0.02 }, CLICK_BOX_MARGIN)
    expect(r.x).toBe(0)
    expect(r.y).toBeCloseTo(0.5 - CLICK_BOX_MARGIN)
    expect(r.width).toBeCloseTo(0.2 + CLICK_BOX_MARGIN)
    expect(r.height).toBeCloseTo(0.02 + 2 * CLICK_BOX_MARGIN)
  })
})

describe('clickWindow', () => {
  it('is centred on the click and stays on the page', () => {
    const w = clickWindow({ x: 0.5, y: 0.5 })
    expect(w.x + w.width / 2).toBeCloseTo(0.5)
    expect(w.y + w.height / 2).toBeCloseTo(0.5)
    const edge = clickWindow({ x: 0.99, y: 0.01 })
    expect(edge.x + edge.width).toBeLessThanOrEqual(1)
    expect(edge.y).toBeGreaterThanOrEqual(0)
  })

  it('is a full-width band, not the whole page', () => {
    const w = clickWindow({ x: 0.5, y: 0.5 })
    expect(w.width).toBe(1)
    expect(w.height).toBeLessThan(0.5)
  })
})

describe('narrowToSegment', () => {
  // A 100x10 grey image: background 250, dark ink in columns [10,30) and [50,90).
  function image(spans: [number, number][], shade = 20) {
    const width = 100
    const height = 10
    const data = new Uint8ClampedArray(width * height * 4).fill(250)
    for (let y = 0; y < height; y++)
      for (const [a, b] of spans)
        for (let x = a; x < b; x++) {
          const i = (y * width + x) * 4
          data[i] = data[i + 1] = data[i + 2] = shade
        }
    return { data, width, height }
  }

  it('keeps the ink run under the click when a wide gap splits the line', () => {
    const img = image([
      [10, 30],
      [50, 90],
    ])
    expect(narrowToSegment(img, [0, 0, 100, 10], 70)).toEqual([50, 0, 90, 10])
    expect(narrowToSegment(img, [0, 0, 100, 10], 20)).toEqual([10, 0, 30, 10])
  })

  it('does not split at a gap narrower than the threshold', () => {
    // gap of 4 px on a 10 px line: under 0.6 x height
    const img = image([
      [10, 30],
      [34, 90],
    ])
    expect(narrowToSegment(img, [0, 0, 100, 10], 70)).toEqual([10, 0, 90, 10])
  })

  it('counts light grey text as ink', () => {
    const img = image(
      [
        [10, 30],
        [50, 90],
      ],
      140,
    )
    expect(narrowToSegment(img, [0, 0, 100, 10], 20)).toEqual([10, 0, 30, 10])
  })

  it('returns nothing for a click in the gap', () => {
    const img = image([
      [10, 30],
      [50, 90],
    ])
    expect(narrowToSegment(img, [0, 0, 100, 10], 40)).toBeNull()
  })
})
