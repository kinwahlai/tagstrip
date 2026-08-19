import { describe, expect, it } from 'vitest'
import { buildOcrLanguage } from './languages'

describe('buildOcrLanguage', () => {
  it('combines every non-Chinese language with exactly the chosen Chinese script', () => {
    const simplified = buildOcrLanguage('chi_sim')
    expect(simplified.split('+')).toEqual(
      expect.arrayContaining(['eng', 'chi_sim', 'msa', 'tam', 'tha', 'vie']),
    )
    expect(simplified).not.toContain('chi_tra')

    const traditional = buildOcrLanguage('chi_tra')
    expect(traditional).toContain('chi_tra')
    expect(traditional).not.toContain('chi_sim')
  })
})
