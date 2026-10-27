import { describe, expect, it } from 'vitest'
import { argmaxFrames, ctcGreedyDecode, decodeIds } from './ctc'

describe('ctcGreedyDecode', () => {
  it('collapses repeats and drops blanks', () => {
    // frames: a a _ a b b _ _ c   (0 = blank, 1 = a, 2 = b, 3 = c)
    const ids = [1, 1, 0, 1, 2, 2, 0, 0, 3]
    const conf = [0.9, 0.8, 0.99, 0.7, 0.6, 0.5, 0.99, 0.99, 1.0]
    const r = ctcGreedyDecode(ids, conf, ids.length)
    // the blank between the two runs of "a" keeps both: a a b c
    expect(r.ids).toEqual([1, 1, 2, 3])
    // confidences of the first frame of each kept run: 0.9, 0.7, 0.6, 1.0
    expect(r.meanConf).toBeCloseTo((0.9 + 0.7 + 0.6 + 1.0) / 4)
  })

  it('returns nothing for an all-blank line', () => {
    expect(ctcGreedyDecode([0, 0, 0], [1, 1, 1], 3)).toEqual({ ids: [], meanConf: 0 })
  })

  it('ignores frames past the line length and accepts bigint ids', () => {
    const r = ctcGreedyDecode(BigInt64Array.from([2n, 2n, 3n, 3n]), [0.5, 0.5, 0.9, 0.9], 2)
    expect(r.ids).toEqual([2])
  })

  it('decodes a tiny hand-made logits array through argmax', () => {
    const logits = [
      [0.1, 2.0, 0.3], // a
      [0.1, 1.5, 0.3], // a (repeat)
      [3.0, 0.2, 0.1], // blank
      [0.0, 0.1, 2.5], // b
      [0.0, 0.1, 2.0], // b (repeat)
      [2.0, 0.1, 0.0], // blank
    ]
    const ids = argmaxFrames(logits)
    expect(ids).toEqual([1, 1, 0, 2, 2, 0])
    const r = ctcGreedyDecode(ids, [1, 1, 1, 1, 1, 1], ids.length)
    expect(decodeIds(r.ids, ['a', 'b'])).toBe('ab')
  })
})

describe('decodeIds', () => {
  it('maps class i to chars[i - 1] and skips ids out of range', () => {
    expect(decodeIds([1, 2, 99, 0], ['x', 'y'])).toBe('xy')
  })
  it('spaces a LaTeX command from a following letter', () => {
    expect(decodeIds([1, 2], ['\\alpha', 'x'])).toBe('\\alpha x')
  })
})
