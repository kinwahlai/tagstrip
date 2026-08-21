// A fixed palette replaces the OS color picker, which was fiddly to drive and
// let users pick colors that vanish against a white scanned page. These twelve
// hues are chosen to stay distinguishable from each other and to hold contrast
// when drawn as annotation boxes over white paper. Imported schemas may still
// carry any hex — see LabelEditor, which surfaces an off-palette color as an
// extra swatch rather than silently reassigning it.
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

/** Next unused palette color, so successive labels don't all default to red. */
export function suggestColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toUpperCase()))
  return LABEL_COLORS.find((c) => !used.has(c.hex))?.hex ?? DEFAULT_LABEL_COLOR
}
