// Twelve named hues, chosen to stay distinguishable from each other and to hold
// contrast when drawn as annotation boxes over white paper. They are what a
// schema's first twelve labels get; past that, colorForIndex generates more (see
// below). Imported schemas may still carry any hex — see LabelEditor, which
// surfaces an off-palette color as an extra swatch rather than silently
// reassigning it.
//
// Five hues are darkened from the original set because a region's name is drawn
// as white text on a chip filled with the label's own color, and on those five
// white fell short of 4.5:1 — Orange #F58231 2.59, Green #3CB44B 2.71, Magenta
// #F032E6 3.33, Teal #469990 3.38, Olive #808000 4.20. Ink text fails on eight
// of the twelve, so no single chip text color saves the set; the hues had to
// move. Darkening preserves the separation they were picked for. Labels already
// in IndexedDB keep whatever hex they were saved with and surface through the
// off-palette swatch. See src/lib/labelColors.test.ts for the contrast check.
export interface LabelColor {
  name: string
  hex: string
}

export const LABEL_COLORS: LabelColor[] = [
  { name: 'Red', hex: '#E6194B' },
  { name: 'Orange', hex: '#B35C13' },
  { name: 'Olive', hex: '#757500' },
  { name: 'Green', hex: '#2A8034' },
  { name: 'Teal', hex: '#3A7D75' },
  { name: 'Blue', hex: '#4363D8' },
  { name: 'Navy', hex: '#000075' },
  { name: 'Purple', hex: '#911EB4' },
  { name: 'Magenta', hex: '#C024B6' },
  { name: 'Brown', hex: '#9A6324' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Charcoal', hex: '#1F2937' },
]

export const DEFAULT_LABEL_COLOR = LABEL_COLORS[0].hex

/** WCAG contrast of white text on `hex`. The region tag is white-on-label-color,
 *  so this is the number every label color has to clear. */
export function contrastWithWhite(hex: string): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const r = channel(parseInt(hex.slice(1, 3), 16))
  const g = channel(parseInt(hex.slice(3, 5), 16))
  const b = channel(parseInt(hex.slice(5, 7), 16))
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05)
}

// --- Generated colors past the named twelve -------------------------------
//
// Twelve is roughly the ceiling for hues a person can tell apart at a glance,
// so the hand-tuned list was never going to be extended by hand to cover a
// document type with 20+ fields. But running out was worse than crowding: the
// old suggestColor handed every label past the twelfth the same red, which
// makes two fields indistinguishable rather than merely similar.
//
// Colors past the twelfth are generated in OKLCH. Hue advances by the golden
// angle so consecutive labels always land far apart on the wheel rather than
// drifting one shade at a time. Lightness is not fixed: perceptual lightness
// and WCAG luminance disagree by hue (yellow is far brighter than blue at the
// same OKLCH L), so instead of guessing an L that "usually" works, each hue
// walks its lightness down until white text actually clears 4.5:1. That makes
// the contrast guarantee a property of the algorithm rather than of a list
// someone remembered to re-check. See labelColors.test.ts.

const GOLDEN_ANGLE = 137.508
// Offset so the first generated hue does not land on top of one of the named
// twelve. 0 puts index 12 at red; 41 clears all twelve by a comfortable margin.
const HUE_OFFSET = 41

function srgbComponent(linear: number): number {
  const v = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

/** Björn Ottosson's OKLab → linear sRGB. Returns linear values, which may fall
 *  outside [0,1] when the requested chroma is outside the sRGB gamut. */
function oklchToLinearSrgb(L: number, C: number, hueDegrees: number): [number, number, number] {
  const h = (hueDegrees * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function toHex(rgb: [number, number, number]): string {
  return (
    '#' +
    rgb
      .map((c) => srgbComponent(c).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

/** The most saturated in-gamut color at this lightness and hue, so generated
 *  colors stay as vivid as the hand-picked ones rather than washing out. */
function inGamutHex(L: number, hue: number): string {
  for (let C = 0.18; C > 0.02; C -= 0.01) {
    const rgb = oklchToLinearSrgb(L, C, hue)
    if (rgb.every((c) => c >= -0.001 && c <= 1.001)) return toHex(rgb)
  }
  return toHex(oklchToLinearSrgb(L, 0.02, hue))
}

/** The color for the nth label in a schema: the named palette for the first
 *  twelve, then generated hues that never repeat and always carry white text. */
export function colorForIndex(index: number): string {
  const named = LABEL_COLORS[index]
  if (named) return named.hex

  const hue = (HUE_OFFSET + (index - LABEL_COLORS.length + 1) * GOLDEN_ANGLE) % 360
  for (let L = 0.72; L >= 0.2; L -= 0.01) {
    const hex = inGamutHex(L, hue)
    if (contrastWithWhite(hex) >= 4.5) return hex
  }
  return DEFAULT_LABEL_COLOR
}

/** Next unused color, so successive labels don't all default to red. Generation
 *  means this never runs out; the bound is only a guard against a caller that
 *  somehow passes an unbounded used-list. */
export function suggestColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toUpperCase()))
  for (let i = 0; i < 500; i++) {
    const hex = colorForIndex(i)
    if (!used.has(hex)) return hex
  }
  return DEFAULT_LABEL_COLOR
}
