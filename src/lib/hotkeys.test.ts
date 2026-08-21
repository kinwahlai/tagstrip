import { describe, expect, it } from 'vitest'
import { formatHotkeyRanges, HOTKEY_OPTIONS, isHotkey } from './hotkeys'

describe('HOTKEY_OPTIONS', () => {
  it('offers 1-9 then 0, matching the number row', () => {
    expect(HOTKEY_OPTIONS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'])
  })
})

describe('isHotkey', () => {
  it('accepts every offered option, including 0', () => {
    for (const key of HOTKEY_OPTIONS) expect(isHotkey(key)).toBe(true)
  })

  it('rejects non-digit keys', () => {
    for (const key of ['a', 'Enter', 'ArrowLeft', '', 'Shift', '10']) {
      expect(isHotkey(key)).toBe(false)
    }
  })
})

describe('formatHotkeyRanges', () => {
  it('is empty when nothing is assigned', () => {
    expect(formatHotkeyRanges([])).toBe('')
  })

  it('collapses a run into a range', () => {
    expect(formatHotkeyRanges(['1', '2', '3', '4', '5', '6'])).toBe('1–6')
  })

  it('keeps a lone key on its own and joins the groups', () => {
    expect(formatHotkeyRanges(['1', '2', '3', '4', '7'])).toBe('1–4, 7')
  })

  it('treats 0 as following 9, matching the number row', () => {
    expect(formatHotkeyRanges(['8', '9', '0'])).toBe('8–0')
  })

  it('ignores keys outside the option list', () => {
    expect(formatHotkeyRanges(['1', 'q', '2'])).toBe('1–2')
  })
})
