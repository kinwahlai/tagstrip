import { describe, expect, it } from 'vitest'
import { median, normalise, summarise, verdict } from './score'

describe('normalise', () => {
  it('lowercases and drops everything but letters and digits', () => {
    expect(normalise('Nov 9, 1995')).toBe('nov91995')
    expect(normalise('KX-482915 / b7')).toBe('kx482915b7')
  })
  it('is Unicode-aware', () => {
    expect(normalise('Zoë Müller 三')).toBe('zoëmüller三')
  })
  it('keeps Chinese characters and digits, drops full-width punctuation and spaces', () => {
    expect(normalise('临海市新华路19号 506室')).toBe('临海市新华路19号506室')
    expect(normalise('2012年5月23日')).toBe('2012年5月23日')
    expect(normalise('黄海燕，')).toBe('黄海燕')
    expect(normalise('，。 ')).toBe('')
  })
  it('keeps English results unchanged', () => {
    expect(normalise('Mara Brandt')).toBe('marabrandt')
    expect(normalise('1975-04-22')).toBe('19750422')
  })
})

describe('verdict on Chinese values', () => {
  it('matches the same characters and tells simplified from traditional', () => {
    expect(verdict('黄海燕', '黄海燕')).toBe('match')
    expect(verdict('黄 海燕。', '黄海燕')).toBe('match')
    expect(verdict('黃海燕', '黄海燕')).toBe('wrong')
    expect(verdict('。', '黄海燕')).toBe('blank')
  })
})

describe('verdict', () => {
  it('matches when the normalised strings are equal', () => {
    expect(verdict('Marcus  Aldervane.', 'marcus aldervane')).toBe('match')
  })
  it('calls a non-empty different string wrong, not a match', () => {
    expect(verdict('Marcus Aldervan', 'Marcus Aldervane')).toBe('wrong')
    expect(verdict('x', 'y')).toBe('wrong')
  })
  it('calls an empty or punctuation-only reading blank', () => {
    expect(verdict('', 'abc')).toBe('blank')
    expect(verdict(' - . ', 'abc')).toBe('blank')
  })
  it('never counts a missing expected string as a match', () => {
    expect(verdict('abc', undefined)).toBe('wrong')
    expect(verdict('abc', null)).toBe('wrong')
    expect(verdict('abc', '')).toBe('wrong')
    expect(verdict('abc', ' - ')).toBe('wrong')
  })
})

describe('summarise', () => {
  it('counts verdicts and takes the median time', () => {
    const s = summarise([
      { id: 'r001', verdict: 'match', ms: 10 },
      { id: 'r002', verdict: 'wrong', ms: 30 },
      { id: 'r003', verdict: 'blank', ms: 20 },
      { id: 'r004', verdict: 'match', ms: 40 },
    ])
    expect(s).toEqual({ total: 4, match: 2, wrong: 1, blank: 1, medianMs: 25 })
  })
  it('handles an empty list', () => {
    expect(summarise([])).toEqual({ total: 0, match: 0, wrong: 0, blank: 0, medianMs: 0 })
    expect(median([])).toBe(0)
  })
})
