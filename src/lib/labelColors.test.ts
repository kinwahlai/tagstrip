import { describe, expect, it } from 'vitest'
import {
  colorForIndex,
  contrastWithWhite,
  DEFAULT_LABEL_COLOR,
  LABEL_COLORS,
  suggestColor,
} from './labelColors'

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
// color (see PageStage), so every hue has to carry white at 4.5:1. Five of the
// named hues were darkened to make that true; this keeps them that way, and
// holds the generated hues beyond them to the same bar.

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

  it('keeps going past the named palette instead of repeating red', () => {
    const used = LABEL_COLORS.map((c) => c.hex)
    const next = suggestColor(used)
    expect(next).not.toBe(DEFAULT_LABEL_COLOR)
    expect(used).not.toContain(next)
    expect(next).toBe(colorForIndex(LABEL_COLORS.length))
  })

  it('fills a 30-label schema with 30 distinct colors', () => {
    const used: string[] = []
    for (let i = 0; i < 30; i++) used.push(suggestColor(used))
    expect(new Set(used).size).toBe(30)
  })
})

// Twelve hand-tuned hues ran out on a document type with 20+ fields, and the
// old suggestColor answered that by handing every label past the twelfth the
// same red. Colors are generated past that point instead.
describe('colorForIndex', () => {
  it('returns the named palette for the first twelve', () => {
    for (const [i, c] of LABEL_COLORS.entries()) expect(colorForIndex(i)).toBe(c.hex)
  })

  it('generates uppercase 6-digit hex beyond the named palette', () => {
    for (let i = 12; i < 60; i++) expect(colorForIndex(i)).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('never repeats a color across the first 60', () => {
    const all = Array.from({ length: 60 }, (_, i) => colorForIndex(i))
    expect(new Set(all).size).toBe(60)
  })

  it('carries white region-tag text at 4.5:1 on every generated color', () => {
    for (let i = 12; i < 60; i++) {
      expect({ i, ok: contrastWithWhite(colorForIndex(i)) >= 4.5 }).toEqual({ i, ok: true })
    }
  })

  it('is deterministic', () => {
    expect(colorForIndex(37)).toBe(colorForIndex(37))
  })
})
