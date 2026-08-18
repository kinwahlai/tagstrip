export interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Converts a pointer's viewport (clientX/clientY) coordinates into a position
// normalized to [0, 1] relative to `container`, clamping so a drag that ends
// outside the element's bounds still resolves to a valid point on its edge.
export function pointToNormalized(
  clientX: number,
  clientY: number,
  container: DOMRect,
): { x: number; y: number } {
  const x = container.width === 0 ? 0 : (clientX - container.left) / container.width
  const y = container.height === 0 ? 0 : (clientY - container.top) / container.height
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) }
}

export function rectFromPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
): NormalizedRect {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  return { x, y, width, height }
}

// A drawn box smaller than this (in normalized units, on either axis) is
// treated as an accidental click rather than an intentional annotation.
export const MIN_BOX_SIZE = 0.004
