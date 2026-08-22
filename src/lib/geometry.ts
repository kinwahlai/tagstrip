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

// A region's name tag sits above its box, which is right until there is
// something there. Two ways that goes wrong: a box near the top of the page has
// its tag clipped off the edge, and on a tightly-set document — an invoice, a
// statement, an address block — the tag lands on the line above, which is often
// another region's content. Both were visible in the first screenshot taken of
// the sample document: three stacked address lines, each tag covering the line
// above it.
//
// So the tag flips inside the box, top-aligned, when placing it above would
// collide. Inside is the worse position in isolation — it covers the top of the
// text being transcribed — so it is only taken when the alternative is
// definitely covering something else.
//
// A tag is a fixed pixel height while a box scales with zoom, so below roughly
// 100% a single-line box is shorter than its own tag. Rather than let the tag out
// of the box at that size — which only moves the collision — it switches to a
// tighter cut that fits. Below roughly 13px of box height even that overflows a
// little, since there is no smaller version of 10px text; a box that short is a
// sliver, and the regions inspector carries the label in full regardless.
export const TAG_HEIGHT_PX = 20
// A tighter cut of the same tag, for a box too short to hold the full one. The
// height is won back from vertical padding, not from the type — the name is set
// at the same 10px either way.
//
// An earlier version shrank the text to 8px and defended it on the grounds that a
// box is only this short at a zoom where the document is unreadable anyway. That
// was false, and the verifier disproved it by drawing an ordinary 16px box around
// one line of the address block at 100% zoom: this function compares box height
// against a pixel constant and never looks at zoom at all, so a precisely drawn
// single-line box triggers it at any zoom. Which is what careful annotation looks
// like, not an edge case. Since it can appear over a perfectly readable page, it
// has to stay readable itself — hence the padding rather than the type.
export const TAG_COMPACT_HEIGHT_PX = 13

export type TagPlacement = 'above' | 'inside' | 'inside-compact'

/**
 * Where a region's tag goes without covering another region.
 *
 * `pageHeightPx` is the page's rendered height, needed because a tag is a fixed
 * pixel height while everything else here is normalized 0-1 — so placement
 * genuinely changes with zoom and has to be recomputed, not decided once.
 *
 * Order of preference:
 *   above          — room on the page and nothing there. The common case.
 *   inside         — above would collide, and the box can hold a full tag.
 *   inside-compact — the box cannot hold a full tag, so use the small one.
 *
 * The invariant the third state buys is the point of it: a region's tag never
 * leaves its own box unless it is safe to. Two earlier attempts here allowed the
 * tag out of the box when nothing fitted, and both just moved the collision —
 * first spilling past the bottom edge onto the content below, then landing back
 * on top of the neighbour above.
 */
export function tagPlacement(
  box: NormalizedRect,
  others: NormalizedRect[],
  pageHeightPx: number,
): TagPlacement {
  if (pageHeightPx <= 0) return 'above'
  const tagHeight = TAG_HEIGHT_PX / pageHeightPx

  // The band the tag would occupy above the box. Width is taken as the box's
  // own, which is wider than the text for a short name and narrower for a long
  // one — the cheap approximation is deliberate, since the alternative is
  // measuring text for every region on every zoom change.
  const clearAbove =
    box.y - tagHeight >= 0 &&
    !others.some(
      (other) =>
        box.x < other.x + other.width &&
        box.x + box.width > other.x &&
        box.y - tagHeight < other.y + other.height &&
        box.y > other.y,
    )
  if (clearAbove) return 'above'

  return box.height >= tagHeight ? 'inside' : 'inside-compact'
}
