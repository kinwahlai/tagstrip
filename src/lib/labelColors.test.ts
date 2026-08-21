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

// A region's name is drawn as white text on a chip filled with the label's own
// color (see PageStage), so every palette hue has to carry white at 4.5:1. Five
// hues were darkened to make that true; this keeps them that way.
function contrastWithWhite(hex: string): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const r = channel(parseInt(hex.slice(1, 3), 16))
  const g = channel(parseInt(hex.slice(3, 5), 16))
  const b = channel(parseInt(hex.slice(5, 7), 16))
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return 1.05 / (luminance + 0.05)
}

describe('palette contrast', () => {
  it('carries white region-tag text at 4.5:1 on every swatch', () => {
    for (const c of LABEL_COLORS) {
      expect({ name: c.name, ratio: contrastWithWhite(c.hex) >= 4.5 }).toEqual({
        name: c.name,
        ratio: true,
      })
    }
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
