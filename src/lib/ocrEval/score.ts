// Scoring for the OCR comparison harness. An engine's text is judged against the human
// transcription, never against another engine's output.
export type Verdict = 'match' | 'wrong' | 'blank'

// Lowercase, then drop everything that is not a letter or a digit (Unicode-aware).
export function normalise(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

// 'blank' when the engine produced nothing readable, 'match' when the normalised strings are
// equal and non-empty, else 'wrong'. A missing or empty expected string can never be a match.
export function verdict(got: string, expected: string | undefined | null): Verdict {
  const g = normalise(got)
  if (g === '') return 'blank'
  if (expected == null) return 'wrong'
  const e = normalise(expected)
  return e !== '' && g === e ? 'match' : 'wrong'
}

export interface RegionResult {
  id: string
  verdict: Verdict
  ms: number
}

export interface Summary {
  total: number
  match: number
  wrong: number
  blank: number
  medianMs: number
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function summarise(results: RegionResult[]): Summary {
  const count = (v: Verdict) => results.filter((r) => r.verdict === v).length
  return {
    total: results.length,
    match: count('match'),
    wrong: count('wrong'),
    blank: count('blank'),
    medianMs: median(results.map((r) => r.ms)),
  }
}
