// Single source of truth for label hotkeys. The picker in LabelEditor and the
// keydown handler in AnnotationCanvas both read from here — they previously
// duplicated the digit range, so a hotkey could be assignable but dead.
// 0 sits last to match the number row (1..9 then 0).
export const HOTKEY_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

export function isHotkey(key: string): boolean {
  return HOTKEY_OPTIONS.includes(key)
}
