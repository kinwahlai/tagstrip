import { describe, expect, it } from 'vitest'
import { formatHotkeyRanges, HOTKEY_OPTIONS, isHotkey, suggestHotkey } from './hotkeys'

describe('HOTKEY_OPTIONS', () => {
  it('offers a-z then the number row, so 20+ labels all fit', () => {
    expect(HOTKEY_OPTIONS).toHaveLength(36)
    expect(HOTKEY_OPTIONS.slice(0, 3)).toEqual(['a', 'b', 'c'])
    expect(HOTKEY_OPTIONS.slice(-11)).toEqual([
      'z',
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
    ])
  })
})

describe('isHotkey', () => {
  it('accepts every offered option, including 0', () => {
    for (const key of HOTKEY_OPTIONS) expect(isHotkey(key)).toBe(true)
  })

  it('rejects keys outside the option list', () => {
    for (const key of ['Enter', 'ArrowLeft', '', 'Shift', '10', 'A']) {
      expect(isHotkey(key)).toBe(false)
    }
  })
})

describe('suggestHotkey', () => {
  it('uses the first letter of the name', () => {
    expect(suggestHotkey('date_of_birth', [])).toBe('d')
  })

  it('falls to the initial of the next word when the first is taken', () => {
    expect(suggestHotkey('date_of_birth', ['d'])).toBe('o')
    expect(suggestHotkey('address_line_1', ['a'])).toBe('l')
  })

  it('falls to later letters of the name once every initial is taken', () => {
    expect(suggestHotkey('date_of_birth', ['d', 'o', 'b'])).toBe('a')
  })

  it('ignores case in the name', () => {
    expect(suggestHotkey('Total_Due', [])).toBe('t')
  })

  it('takes any free option when the name offers nothing', () => {
    expect(suggestHotkey('___', ['a', 'b'])).toBe('c')
  })

  it('uses a digit from the name when it is free', () => {
    expect(suggestHotkey('7', [])).toBe('7')
  })

  it('returns undefined once all 36 are taken', () => {
    expect(suggestHotkey('date_of_birth', HOTKEY_OPTIONS)).toBeUndefined()
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

  it('collapses a run of letters too', () => {
    expect(formatHotkeyRanges(['a', 'b', 'c'])).toBe('a–c')
  })

  it('keeps letters and digits as separate groups', () => {
    expect(formatHotkeyRanges(['a', '1'])).toBe('a, 1')
  })

  it('ignores keys outside the option list', () => {
    expect(formatHotkeyRanges(['1', 'A', '2'])).toBe('1–2')
  })
})
