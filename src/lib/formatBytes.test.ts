import { describe, expect, it } from 'vitest'
import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('leaves small values in bytes', () => {
    expect(formatBytes(0)).toBe('0 bytes')
    expect(formatBytes(999)).toBe('999 bytes')
  })

  it('steps up a unit at a time', () => {
    expect(formatBytes(1000)).toBe('1 KB')
    expect(formatBytes(1_500_000)).toBe('1.5 MB')
    expect(formatBytes(812_000_000)).toBe('812 MB')
    expect(formatBytes(2_400_000_000)).toBe('2.4 GB')
  })

  it('drops the decimal once three digits carry the precision', () => {
    expect(formatBytes(123_400_000)).toBe('123 MB')
  })

  it('refuses to invent a figure it does not have', () => {
    expect(formatBytes(Number.NaN)).toBe('—')
    expect(formatBytes(-1)).toBe('—')
  })
})
