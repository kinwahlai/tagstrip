// Single source of truth for label hotkeys. The picker in LabelEditor and the
// keydown handler in AnnotationCanvas both read from here — they previously
// duplicated the digit range, so a hotkey could be assignable but dead.
// 0 sits last to match the number row (1..9 then 0).
export const HOTKEY_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

export function isHotkey(key: string): boolean {
  return HOTKEY_OPTIONS.includes(key)
}

/** "1–6", "1–4, 7" — the compact summary the schema tables and the hotkey hint
 *  both show. Ranges follow HOTKEY_OPTIONS order (1..9 then 0), not digit order,
 *  so 9 and 0 read as adjacent the way they are on the number row. */
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
        ? `${HOTKEY_OPTIONS[indices[start]]}\u2013${HOTKEY_OPTIONS[indices[i]]}`
        : HOTKEY_OPTIONS[indices[start]],
    )
  }
  return parts.join(', ')
}
