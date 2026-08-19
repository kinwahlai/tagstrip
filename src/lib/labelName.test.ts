import { describe, expect, it } from 'vitest'
import { spacesToUnderscores } from './labelName'

describe('spacesToUnderscores', () => {
  it('replaces a single space with an underscore', () => {
    expect(spacesToUnderscores('date of birth')).toBe('date_of_birth')
  })

  it('collapses a run of whitespace into one underscore', () => {
    expect(spacesToUnderscores('date  of\tbirth')).toBe('date_of_birth')
  })

  it('leaves names that already use underscores alone', () => {
    expect(spacesToUnderscores('date_of_birth')).toBe('date_of_birth')
  })

  it('keeps a trailing space as an underscore so typing mid-name is not blocked', () => {
    expect(spacesToUnderscores('date ')).toBe('date_')
  })

  it('returns an empty string unchanged', () => {
    expect(spacesToUnderscores('')).toBe('')
  })
})
