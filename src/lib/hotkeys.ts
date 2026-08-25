// Single source of truth for label hotkeys. The picker in LabelEditor and the
// keydown handler in AnnotationCanvas both read from here — they previously
// duplicated the digit range, so a hotkey could be assignable but dead.
//
// The range used to be the number row alone, which capped a schema at ten
// keyed labels; a complex document type runs to twenty or more fields, so every
// label past the tenth was mouse-only. Letters come first and digits keep the
// number row's order (1..9 then 0) at the end. Letters are also what makes the
// key memorable: suggestHotkey derives one from the label's own name, so
// date_of_birth is `d` rather than whichever digit happened to be free.
export const HOTKEY_OPTIONS = [
  ...'abcdefghijklmnopqrstuvwxyz',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
]

export function isHotkey(key: string): boolean {
  return HOTKEY_OPTIONS.includes(key)
}

/** A mnemonic key for `name`, preferring its word initials, then its remaining
 *  letters, then whatever is left. Undefined once all 36 options are taken. */
export function suggestHotkey(name: string, taken: Iterable<string>): string | undefined {
  const used = new Set(taken)
  const lower = name.toLowerCase()
  const initials = lower
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
  const candidates = [...initials, ...lower, ...HOTKEY_OPTIONS]
  return candidates.find((key) => isHotkey(key) && !used.has(key))
}

/** "1–6", "a–d, 1" — the compact summary the schema tables and the hotkey hint
 *  both show. Ranges follow HOTKEY_OPTIONS order (a..z then 1..9, 0), not
 *  alphabetical or digit order, so 9 and 0 read as adjacent the way they are on
 *  the number row, and the last letter never runs into the first digit. */
export function formatHotkeyRanges(keys: string[]): string {
  const indices = keys
    .map((key) => HOTKEY_OPTIONS.indexOf(key))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < indices.length; i++) {
    const start = i
    while (i + 1 < indices.length && indices[i + 1] === indices[i] + 1) i++
    parts.push(
      i - start >= 1
        ? `${HOTKEY_OPTIONS[indices[start]]}–${HOTKEY_OPTIONS[indices[i]]}`
        : HOTKEY_OPTIONS[indices[start]],
    )
  }
  return parts.join(', ')
}
