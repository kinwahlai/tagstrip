import { describe, expect, it } from 'vitest'
import { formatWhen } from './formatDate'

const now = new Date(2026, 7, 21, 15, 30).getTime() // 21 Aug 2026, 15:30

describe('formatWhen', () => {
  it('names today by the hour', () => {
    expect(formatWhen(new Date(2026, 7, 21, 14, 2).getTime(), now)).toBe('today, 14:02')
  })

  it('calls the previous calendar day yesterday, not 24 hours ago', () => {
    // 23.5 hours earlier, but a different calendar day — this is the case a
    // naive elapsed-time check gets wrong.
    expect(formatWhen(new Date(2026, 7, 20, 16, 0).getTime(), now)).toBe('yesterday, 16:00')
  })

  it('drops to a date within the same year', () => {
    expect(formatWhen(new Date(2026, 7, 18, 16, 45).getTime(), now)).toBe('18 Aug, 16:45')
  })

  it('adds the year once it is a different one', () => {
    expect(formatWhen(new Date(2025, 11, 3, 9, 5).getTime(), now)).toBe('3 Dec 2025, 09:05')
  })
})
