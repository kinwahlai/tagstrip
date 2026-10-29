import { describe, expect, it } from 'vitest'
import { matchLines } from './matchLines'
import type { Line } from './matchLines'

// Distinct boxes per line so returning the wrong line (or the first one) is visible.
const lines: Line[] = [
  { text: 'REPUBLIC OF NOWHERE', box: [0.1, 0.05, 0.9, 0.1] },
  { text: 'Full name: Tomas Silva', box: [0.1, 0.2, 0.6, 0.25] },
  { text: '1975-04-22', box: [0.1, 0.4, 0.3, 0.45] },
  { text: '12 Harbour Road,', box: [0.1, 0.6, 0.5, 0.65] },
  { text: 'Springfield 40021', box: [0.1, 0.66, 0.5, 0.71] },
]

describe('matchLines', () => {
  it('returns the line that equals the value, ignoring case and punctuation', () => {
    expect(matchLines('1975-04-22', lines)).toEqual([0.1, 0.4, 0.3, 0.45])
    expect(matchLines('republic of nowhere', lines)).toEqual([0.1, 0.05, 0.9, 0.1])
  })

  it('returns the longer line that contains the value', () => {
    expect(matchLines('Tomas Silva', lines)).toEqual([0.1, 0.2, 0.6, 0.25])
  })

  it('accepts a near match within the edit threshold and rejects one beyond it', () => {
    // One wrong character in ten: ratio 0.1.
    expect(matchLines('1975-04-2Z', lines)).toEqual([0.1, 0.4, 0.3, 0.45])
    // Mostly different text: no line is close enough.
    expect(matchLines('1999-12-31 and more', lines)).toBeNull()
  })

  it('joins a value split over two adjacent lines into their union box', () => {
    expect(matchLines('12 Harbour Road, Springfield 40021', lines)).toEqual([0.1, 0.6, 0.5, 0.71])
  })

  it('does not join lines that are far apart', () => {
    const far: Line[] = [
      { text: 'Harbour Road', box: [0.1, 0.1, 0.5, 0.15] },
      { text: 'Springfield', box: [0.1, 0.8, 0.5, 0.85] },
    ]
    expect(matchLines('Harbour Road Springfield', far)).toBeNull()
  })

  it('returns null when nothing matches, and for an empty value or no lines', () => {
    expect(matchLines('Passport number', lines)).toBeNull()
    expect(matchLines('', lines)).toBeNull()
    expect(matchLines('Tomas Silva', [])).toBeNull()
  })
})
