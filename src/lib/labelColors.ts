// A fixed palette replaces the OS color picker, which was fiddly to drive and
// let users pick colors that vanish against a white scanned page. These twelve
// hues are chosen to stay distinguishable from each other and to hold contrast
// when drawn as annotation boxes over white paper. Imported schemas may still
// carry any hex — see LabelEditor, which surfaces an off-palette color as an
// extra swatch rather than silently reassigning it.
export interface LabelColor {
  name: string
  hex: string
}

export const LABEL_COLORS: LabelColor[] = [
  { name: 'Red', hex: '#E6194B' },
  { name: 'Orange', hex: '#F58231' },
  { name: 'Olive', hex: '#808000' },
  { name: 'Green', hex: '#3CB44B' },
  { name: 'Teal', hex: '#469990' },
  { name: 'Blue', hex: '#4363D8' },
  { name: 'Navy', hex: '#000075' },
  { name: 'Purple', hex: '#911EB4' },
  { name: 'Magenta', hex: '#F032E6' },
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
