import { describe, expect, it } from 'vitest'
import { textItemBoundingBox } from './pdfTextItemGeometry'

describe('textItemBoundingBox', () => {
  it('does not double-scale by font size (regression: was inflating boxes ~fontSize×)', () => {
    // A 12pt run "Hello" at PDF-space origin (72, 700) on a US Letter page
    // (612x792pt), rendered at RENDER_SCALE=2 (viewport 1224x1584px).
    // viewport.transform for scale=2, no rotation, on a 792pt-tall page:
    // maps (x, y) -> (2x, 1584 - 2y).
    const item = { str: 'Hello', transform: [12, 0, 0, 12, 72, 700], width: 40, height: 12 }
    const viewportTransform = [2, 0, 0, -2, 0, 1584]

    const rect = textItemBoundingBox(item, viewportTransform, 1224, 1584)

    // Expected in pixel space: x in [144, 224] (width 80px = 40pt * scale 2),
    // y in [160, 184] (height 24px = 12pt * scale 2) — NOT inflated by the
    // ~12x font-size factor a double-scaling bug would introduce.
    expect(rect.x).toBeCloseTo(144 / 1224, 5)
    expect(rect.y).toBeCloseTo(160 / 1584, 5)
    expect(rect.width).toBeCloseTo(80 / 1224, 5)
    expect(rect.height).toBeCloseTo(24 / 1584, 5)
    expect(rect.str).toBe('Hello')
  })

  it('scales purely with viewport scale, independent of font size', () => {
    // Same position/size as above but a much larger 48pt font — the box's
    // pixel size should still only reflect item.width/height (already in
    // page-space units) times the viewport scale, not the font's own scale.
    const item = { str: 'Big', transform: [48, 0, 0, 48, 72, 700], width: 40, height: 12 }
    const viewportTransform = [2, 0, 0, -2, 0, 1584]

    const rect = textItemBoundingBox(item, viewportTransform, 1224, 1584)

    expect(rect.width).toBeCloseTo(80 / 1224, 5)
    expect(rect.height).toBeCloseTo(24 / 1584, 5)
  })
})
