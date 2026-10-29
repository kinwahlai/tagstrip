import { describe, expect, it } from 'vitest'
import { ctcChars, ctcDecode, dbBoxes, parseCharDict, readingOrder } from './ppocr'

describe('parseCharDict', () => {
  it('reads plain and single-quoted entries and keeps whitespace entries', () => {
    const yml = [
      'PostProcess:',
      '  name: CTCLabelDecode',
      '  character_dict:',
      "  - '!'",
      "  - ''''",
      '  - a',
      '  - 中',
      '  - 　',
      'Other: 1',
    ].join('\n')
    expect(parseCharDict(yml)).toEqual(['!', "'", 'a', '中', '　'])
  })
})

describe('ctcDecode', () => {
  const chars = ctcChars(['a', 'b', '中'], 5) // blank, a, b, 中, space
  // one-hot rows over 5 classes
  const rows = (idx: number[]) => idx.flatMap((i) => [0, 1, 2, 3, 4].map((c) => (c === i ? 1 : 0)))
  it('collapses repeats, drops blanks and keeps a repeat split by a blank', () => {
    expect(ctcDecode(rows([1, 1, 0, 1, 2, 2, 3]), 7, 5, chars)).toBe('aab中')
  })
  it('returns an empty string for all blanks, and maps the extra class to a space', () => {
    expect(ctcDecode(rows([0, 0, 0]), 3, 5, chars)).toBe('')
    expect(ctcDecode(rows([1, 4, 2]), 3, 5, chars)).toBe('a b')
  })
})

function blank(w: number, h: number) {
  return new Float32Array(w * h)
}
function fill(
  p: Float32Array,
  w: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  v: number,
) {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) p[y * w + x] = v
}

describe('dbBoxes', () => {
  const w = 100
  const h = 60
  it('finds one box per region and grows it by the unclip distance', () => {
    const p = blank(w, h)
    fill(p, w, 10, 10, 49, 19, 0.9) // 40 x 10
    fill(p, w, 10, 40, 29, 47, 0.9) // 20 x 8
    const boxes = dbBoxes(p, w, h)
    expect(boxes).toHaveLength(2)
    const d1 = (40 * 10 * 1.4) / (2 * 50) // 5.6
    const first = boxes.find((b) => b[1] < 30)!
    expect(first[0]).toBeCloseTo(10 - d1)
    expect(first[1]).toBeCloseTo(10 - d1)
    expect(first[2]).toBeCloseTo(50 + d1)
    expect(first[3]).toBeCloseTo(20 + d1)
    const second = boxes.find((b) => b[1] > 30)!
    expect(second[0]).toBeLessThan(10)
    expect(second[2]).toBeGreaterThan(30)
  })
  it('drops a region scored under the box threshold, and a region thinner than 3 px', () => {
    const p = blank(w, h)
    fill(p, w, 10, 10, 49, 19, 0.3) // above 0.2 but mean 0.3 < 0.45
    fill(p, w, 60, 30, 90, 31, 0.9) // 2 px tall
    expect(dbBoxes(p, w, h)).toEqual([])
  })
  it('clamps boxes to the map', () => {
    const p = blank(w, h)
    fill(p, w, 0, 0, 39, 9, 0.9)
    const [b] = dbBoxes(p, w, h)
    expect(b[0]).toBe(0)
    expect(b[1]).toBe(0)
  })
})

describe('readingOrder', () => {
  it('sorts rows top to bottom and boxes within a row left to right', () => {
    const a: [number, number, number, number] = [60, 12, 90, 22]
    const b: [number, number, number, number] = [10, 10, 40, 20]
    const c: [number, number, number, number] = [10, 50, 40, 60]
    expect(readingOrder([c, a, b])).toEqual([b, a, c])
  })
})
