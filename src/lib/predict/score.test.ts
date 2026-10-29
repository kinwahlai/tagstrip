import { describe, expect, it } from 'vitest'
import { iou, parseDate, scoreField, summarise, valueVerdict } from './score'
import type { Box, FieldBox } from './score'

const truth: FieldBox = { label: 'Full name', value: 'Mary Ann Tan', bbox: [0.2, 0.2, 0.6, 0.3] }
const shift = (b: Box, dx: number): Box => [b[0] + dx, b[1], b[2] + dx, b[3]]

describe('iou', () => {
  it('is 1 for identical boxes and 0 for disjoint ones', () => {
    expect(iou([0.1, 0.1, 0.5, 0.2], [0.1, 0.1, 0.5, 0.2])).toBe(1)
    expect(iou([0, 0, 0.1, 0.1], [0.5, 0.5, 0.6, 0.6])).toBe(0)
    expect(iou([0, 0, 0.1, 0.1], [0.1, 0, 0.2, 0.1])).toBe(0) // touching edges
  })
  it('divides by the union, not by the predicted box', () => {
    // Prediction wholly inside a much larger truth: over-the-predicted-box would say 1.
    const small: Box = [0.4, 0.4, 0.5, 0.5]
    const big: Box = [0.0, 0.0, 1.0, 1.0]
    expect(iou(small, big)).toBeCloseTo(0.01, 10)
  })
})

describe('box verdict', () => {
  it('hits at 0.5 and above, misses below', () => {
    // width 0.4; shift 0.4/3 -> overlap 2/3 of width, iou = (2/3)/(4/3) = 0.5
    const exactly = scoreField(truth, [{ ...truth, bbox: shift(truth.bbox, 0.4 / 3) }], 'f001')
    expect(exactly.iou).toBeCloseTo(0.5, 10)
    expect(exactly.box).toBe('hit')
    const below = scoreField(truth, [{ ...truth, bbox: shift(truth.bbox, 0.14) }], 'f001')
    expect(below.box).toBe('miss')
  })
  it('a box shifted by half its width is a miss, though a predicted-box-only overlap passes it', () => {
    const shifted = shift(truth.bbox, 0.2) // half of the 0.4 width
    // Intersection over the predicted box alone would be 0.5 and pass a >= 0.5 test.
    const w = Math.min(shifted[2], truth.bbox[2]) - Math.max(shifted[0], truth.bbox[0])
    const overPredicted = (w * 0.1) / ((shifted[2] - shifted[0]) * (shifted[3] - shifted[1]))
    expect(overPredicted).toBeGreaterThanOrEqual(0.5)
    const r = scoreField(truth, [{ ...truth, bbox: shifted }], 'f001')
    expect(r.iou).toBeCloseTo(1 / 3, 10)
    expect(r.box).toBe('miss')
    expect(r.value).toBe('match') // value verdict is unaffected by the box
  })
  it('is a miss and blank when no entry has the label', () => {
    expect(scoreField(truth, [{ ...truth, label: 'Place' }], 'f002')).toEqual({
      id: 'f002',
      box: 'miss',
      iou: 0,
      value: 'blank',
    })
    expect(scoreField(truth, [], 'f003').box).toBe('miss')
  })
  it('matches labels ignoring case and spacing, and picks the highest-IoU entry', () => {
    const far: FieldBox = {
      ...truth,
      label: 'FULL  NAME',
      value: 'Other',
      bbox: [0.7, 0.7, 0.9, 0.8],
    }
    const near: FieldBox = { ...truth, label: 'full name' }
    const r = scoreField(truth, [far, near], 'f004')
    expect(r.box).toBe('hit')
    expect(r.value).toBe('match')
  })
})

describe('value verdict', () => {
  it('a different non-empty value is wrong', () => {
    expect(valueVerdict('Jane Doe', 'Mary Ann Tan', 'Full name')).toBe('wrong')
    expect(scoreField(truth, [{ ...truth, value: 'Jane Doe' }], 'f001').value).toBe('wrong')
  })
  it('blank when nothing readable', () => {
    expect(valueVerdict('', 'x', 'Place')).toBe('blank')
    expect(valueVerdict('2012-05-23', '2012年5月23日', '出生日期')).toBe('match')
    expect(valueVerdict('黃海燕', '黄海燕', '姓名')).toBe('wrong')
    expect(valueVerdict(' - ', 'x', 'Place')).toBe('blank')
  })
  it('uses the existing normalisation', () => {
    expect(valueVerdict('A-123/45', 'a 123 45', 'Certificate number')).toBe('match')
  })
  it('an empty expected value is never a match', () => {
    expect(valueVerdict('abc', '', 'Place')).toBe('wrong')
  })
  it('names match in either order, only for labels containing "name"', () => {
    expect(valueVerdict('Tan, Mary Ann', 'Mary Ann Tan', 'Husband name')).toBe('match')
    expect(valueVerdict('Tan Mary', 'Mary Ann Tan', 'Full name')).toBe('wrong')
    expect(valueVerdict('Tan Mary Ann', 'Mary Ann Tan', 'Place')).toBe('wrong')
  })
  it('dates match when they are the same calendar date', () => {
    expect(valueVerdict('7 March 2024', '2024-03-07', 'Date of marriage')).toBe('match')
    expect(valueVerdict('07/03/2024', 'March 7, 2024', 'Date of marriage')).toBe('match')
    expect(valueVerdict('7 Mar 2024', '7th March 2024', 'Date')).toBe('match')
    expect(valueVerdict('8 March 2024', '2024-03-07', 'Date of marriage')).toBe('wrong')
    // D/M/Y, not M/D/Y
    expect(valueVerdict('03/07/2024', '2024-03-07', 'Date')).toBe('wrong')
  })
})

describe('parseDate', () => {
  it('parses the four supported forms', () => {
    expect(parseDate('2024-03-07')).toBe('2024-03-07')
    expect(parseDate('7/3/2024')).toBe('2024-03-07')
    expect(parseDate('7.3.2024')).toBe('2024-03-07')
    expect(parseDate('7 March 2024')).toBe('2024-03-07')
    expect(parseDate('March 7, 2024')).toBe('2024-03-07')
    expect(parseDate('Sept 1 2020')).toBe('2020-09-01')
  })
  it('rejects non-dates and impossible dates', () => {
    expect(parseDate('Mary Tan')).toBeNull()
    expect(parseDate('31/02/2024')).toBeNull()
    expect(parseDate('13/13/2024')).toBeNull()
    expect(parseDate('7 Marchh 2024')).toBeNull()
    expect(parseDate('12345')).toBeNull()
  })
})

describe('summarise', () => {
  it('counts hits and verdicts and takes the median page time', () => {
    const rs = [
      scoreField(truth, [truth], 'f001'),
      scoreField(truth, [{ ...truth, value: 'zzz', bbox: [0.8, 0.8, 0.9, 0.9] }], 'f002'),
      scoreField(truth, [], 'f003'),
    ]
    expect(summarise(rs, [10, 30, 20])).toEqual({
      total: 3,
      boxHits: 1,
      match: 1,
      wrong: 1,
      blank: 1,
      medianMs: 20,
    })
  })
})
