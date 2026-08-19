import { describe, expect, it } from 'vitest'
import { DEFAULT_LABEL_COLOR, LABEL_COLORS, suggestColor } from './labelColors'

describe('LABEL_COLORS', () => {
  it('are all uppercase 6-digit hex', () => {
    for (const c of LABEL_COLORS) expect(c.hex).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('contains no duplicate colors or names', () => {
    expect(new Set(LABEL_COLORS.map((c) => c.hex)).size).toBe(LABEL_COLORS.length)
    expect(new Set(LABEL_COLORS.map((c) => c.name)).size).toBe(LABEL_COLORS.length)
  })
})

describe('suggestColor', () => {
  it('returns the first color when nothing is used', () => {
    expect(suggestColor([])).toBe(DEFAULT_LABEL_COLOR)
  })

  it('skips colors already taken', () => {
    expect(suggestColor([LABEL_COLORS[0].hex])).toBe(LABEL_COLORS[1].hex)
  })

  it('ignores case when matching used colors', () => {
    expect(suggestColor([LABEL_COLORS[0].hex.toLowerCase()])).toBe(LABEL_COLORS[1].hex)
  })

  it('falls back to the default once every color is used', () => {
    expect(suggestColor(LABEL_COLORS.map((c) => c.hex))).toBe(DEFAULT_LABEL_COLOR)
  })
})
