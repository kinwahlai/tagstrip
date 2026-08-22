import { describe, expect, it } from 'vitest'
import { clamp, pointToNormalized, rectFromPoints, tagPlacement } from './geometry'

describe('clamp', () => {
  it('clamps values within the given range', () => {
    expect(clamp(-1, 0, 1)).toBe(0)
    expect(clamp(2, 0, 1)).toBe(1)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })
})

describe('pointToNormalized', () => {
  const container = { left: 100, top: 50, width: 200, height: 100 } as DOMRect

  it('normalizes a point inside the container', () => {
    expect(pointToNormalized(200, 100, container)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('clamps a point outside the container bounds (drag released off-edge)', () => {
    expect(pointToNormalized(-500, -500, container)).toEqual({ x: 0, y: 0 })
    expect(pointToNormalized(9000, 9000, container)).toEqual({ x: 1, y: 1 })
  })
})

describe('rectFromPoints', () => {
  it('normalizes start/end into a top-left-anchored rect regardless of drag direction', () => {
    const rect = rectFromPoints({ x: 0.6, y: 0.7 }, { x: 0.2, y: 0.3 })
    expect(rect.x).toBeCloseTo(0.2)
    expect(rect.y).toBeCloseTo(0.3)
    expect(rect.width).toBeCloseTo(0.4)
    expect(rect.height).toBeCloseTo(0.4)
  })
})

describe('tagPlacement', () => {
  // 1000px tall page, so a 20px tag is 0.02 normalized — keeps the numbers
  // below readable as "2% of the page".
  const PAGE_H = 1000
  const box = (y: number, height = 0.03, x = 0.1, width = 0.3) => ({ x, y, width, height })

  it('sits above when there is room and nothing there', () => {
    expect(tagPlacement(box(0.5), [], PAGE_H)).toBe('above')
  })

  it('flips inside when the box is against the top of the page', () => {
    // 0.03 of a 1000px page is 30px, comfortably taller than the 20px tag.
    expect(tagPlacement(box(0.01), [], PAGE_H)).toBe('inside')
  })

  it('sits above when clear of the page top by exactly the tag height', () => {
    expect(tagPlacement(box(0.02), [], PAGE_H)).toBe('above')
  })

  it('flips inside when the tag would cover the region above', () => {
    // Stacked address lines: the box above ends right where this tag would go.
    const above = box(0.44)
    expect(tagPlacement(box(0.48), [above], PAGE_H)).toBe('inside')
  })

  it('stays above when the region above is far enough up', () => {
    expect(tagPlacement(box(0.5), [box(0.2)], PAGE_H)).toBe('above')
  })

  it('ignores a region that overlaps vertically but not horizontally', () => {
    // The second column of a statement — same rows, different side of the page.
    const otherColumn = { x: 0.6, y: 0.44, width: 0.3, height: 0.03 }
    expect(tagPlacement(box(0.48), [otherColumn], PAGE_H)).toBe('above')
  })

  it('depends on zoom, because the tag is a fixed pixel height', () => {
    const above = { x: 0.1, y: 0.4, width: 0.3, height: 0.03 }
    // Tall enough to host the tag at either zoom, so fit is not what decides.
    const subject = box(0.45, 0.12)
    // Zoomed out, 20px is a larger share of the page, so the tag reaches the
    // box above; zoomed in, the same gap is roomy.
    expect(tagPlacement(subject, [above], 250)).toBe('inside')
    expect(tagPlacement(subject, [above], 4000)).toBe('above')
  })

  // Two earlier versions let the tag out of the box when nothing fitted, and
  // both only moved the collision: the first spilled past the bottom edge onto
  // the content below, the second landed back on top of the neighbour above.
  // Both were caught by the verifier at 50% zoom on stacked address lines. The
  // tag now shrinks instead of escaping.
  it('uses the compact tag when the box is too short to hold the full one', () => {
    const above = { x: 0.1, y: 0.4, width: 0.3, height: 0.03 }
    // tag is 20/250 = 0.08 of the page; the box is 0.03.
    expect(tagPlacement(box(0.45, 0.03), [above], 250)).toBe('inside-compact')
  })

  it('never returns above when above collides, whatever the box height', () => {
    // The regression that mattered: the old tiebreak read page-edge room and
    // ignored that the collision was with a neighbour, so it sent the tag back
    // on top of it.
    const above = { x: 0.1, y: 0.4, width: 0.3, height: 0.03 }
    for (const height of [0.005, 0.03, 0.079, 0.08, 0.2]) {
      expect(tagPlacement(box(0.45, height), [above], 250)).not.toBe('above')
    }
  })

  it('takes the full tag inside as soon as the box can hold it', () => {
    const above = { x: 0.1, y: 0.4, width: 0.3, height: 0.03 }
    expect(tagPlacement(box(0.45, 0.079), [above], 250)).toBe('inside-compact')
    expect(tagPlacement(box(0.45, 0.08), [above], 250)).toBe('inside')
  })

  it('keeps a short box at the page top inside rather than off the page', () => {
    expect(tagPlacement(box(0.001, 0.03), [], 250)).toBe('inside-compact')
  })

  it('falls back to above rather than dividing by a zero page height', () => {
    expect(tagPlacement(box(0.5), [], 0)).toBe('above')
  })
})
