import { describe, expect, it } from 'vitest'
import { clamp, pointToNormalized, rectFromPoints } from './geometry'

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
