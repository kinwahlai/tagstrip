import { describe, expect, it } from 'vitest'
import { pageWindow } from './pageWindow'

describe('pageWindow', () => {
  it('returns no slots for an empty document', () => {
    expect(pageWindow(0, 0)).toEqual([])
  })

  it('returns every page for a one-page document', () => {
    expect(pageWindow(0, 1)).toEqual([0])
  })

  it('returns every page for a seven-page document', () => {
    expect(pageWindow(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('uses the leading-page branch for an eight-page document', () => {
    expect(pageWindow(0, 8)).toEqual([0, 1, 2, 3, 4, null, 7])
  })

  it('returns the leading-page example at the first page', () => {
    expect(pageWindow(0, 10)).toEqual([0, 1, 2, 3, 4, null, 9])
  })

  it('uses the leading-page branch through index 3', () => {
    expect(pageWindow(3, 10)).toEqual([0, 1, 2, 3, 4, null, 9])
  })

  it('uses the middle-page branch at index 4', () => {
    expect(pageWindow(4, 10)).toEqual([0, null, 3, 4, 5, null, 9])
  })

  it('uses the middle-page branch at count minus 5', () => {
    expect(pageWindow(5, 10)).toEqual([0, null, 4, 5, 6, null, 9])
  })

  it('uses the trailing-page branch at count minus 4', () => {
    expect(pageWindow(6, 10)).toEqual([0, null, 5, 6, 7, 8, 9])
  })

  it('uses the trailing-page branch through the last page', () => {
    expect(pageWindow(9, 10)).toEqual([0, null, 5, 6, 7, 8, 9])
  })
})
