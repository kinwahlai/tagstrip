/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const cssPath = process.env.FONT_FALLBACK_CSS_PATH ?? 'src/styles/ts-modernist.css'
const css = readFileSync(cssPath, 'utf8')
const fontFaceBlocks = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => body)

const fallbackMetrics = [
  ['400', '96.9%', '90.61%', '21.67%', '0%'],
  ['600', '97.3%', '90.27%', '21.59%', '0%'],
  ['700', '97.5%', '90.06%', '21.54%', '0%'],
  ['800', '102.4%', '85.73%', '20.51%', '0%'],
]

function findFontFaceBlocks(fontFamily: string, weight: string) {
  return fontFaceBlocks.filter(
    (body) =>
      body.includes(`font-family: '${fontFamily}';`) && body.includes(`font-weight: ${weight};`),
  )
}

describe('Archivo fallback font metrics', () => {
  it.each(fallbackMetrics)(
    'defines matched fallback metrics for weight %s',
    (weight, sizeAdjust, ascent, descent, lineGap) => {
      const blocks = findFontFaceBlocks('Archivo Fallback', weight)
      expect(blocks).toHaveLength(1)

      const [block] = blocks
      expect(block).toContain(`size-adjust: ${sizeAdjust};`)
      expect(block).toContain(`ascent-override: ${ascent};`)
      expect(block).toContain(`descent-override: ${descent};`)
      expect(block).toContain(`line-gap-override: ${lineGap};`)
    },
  )

  it.each(['400', '600', '700', '800'])('keeps Archivo weight %s on swap', (weight) => {
    const blocks = findFontFaceBlocks('Archivo', weight)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toContain('font-display: swap;')
  })

  it('uses Archivo Fallback directly after Archivo in both type stacks', () => {
    expect(css).toMatch(/--font-heading:\s*'Archivo',\s*'Archivo Fallback',/)
    expect(css).toMatch(/--font-body:\s*'Archivo',\s*'Archivo Fallback',/)
  })
})
