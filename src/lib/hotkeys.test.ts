import { describe, expect, it } from 'vitest'
import { HOTKEY_OPTIONS, isHotkey } from './hotkeys'

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
