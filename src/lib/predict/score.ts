// Scoring for field prediction (TS-12 M1). A prediction is judged twice against the human's
// region: the box by intersection over union, the value by the OCR scorer's normalisation plus
// two equivalences (same calendar date; names in either order).
// scripts/predict-reference.py ports this file; keep the two in step (same test vectors).
import { median, normalise } from '../ocrEval/score'
import type { Verdict } from '../ocrEval/score'

export type Box = [number, number, number, number] // x1, y1, x2, y2, normalised 0..1
export type BoxVerdict = 'hit' | 'miss'

export interface FieldBox {
  label: string
  value: string
  bbox: Box
}

export const IOU_HIT = 0.5

// Intersection over the union of both boxes (not over the predicted box alone).
export function iou(a: Box, b: Box): number {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0])
  const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1])
  if (w <= 0 || h <= 0) return 0
  const inter = w * h
  const area = (r: Box) => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1])
  const union = area(a) + area(b) - inter
  return union > 0 ? inter / union : 0
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

function monthNumber(word: string): number | null {
  const w = word.toLowerCase().replace(/\.$/, '')
  if (w.length < 3) return null
  if (w === 'sept') return 9
  const i = MONTHS.findIndex((m) => m === w || (w.length === 3 && m.startsWith(w)))
  return i >= 0 ? i + 1 : null
}

function validDate(y: number, m: number, d: number): string | null {
  if (!(y >= 1000 && y <= 9999) || m < 1 || m > 12 || d < 1) return null
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  if (d > days) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Parses ISO (2024-03-07), 2024年3月7日, D/M/Y (also - or .), "7 March 2024" and "March 7, 2024" into
// "YYYY-MM-DD", or null when the text is not exactly one of those forms.
export function parseDate(text: string): string | null {
  const s = text.trim().replace(/\s+/g, ' ')
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m) return validDate(+m[1], +m[2], +m[3])
  m = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(s)
  if (m) return validDate(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (m) return validDate(+m[3], +m[2], +m[1])
  m = /^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]{3,9}\.?),? (\d{4})$/.exec(s)
  if (m) {
    const mo = monthNumber(m[2])
    return mo ? validDate(+m[3], mo, +m[1]) : null
  }
  m = /^([A-Za-z]{3,9}\.?) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/.exec(s)
  if (m) {
    const mo = monthNumber(m[1])
    return mo ? validDate(+m[3], mo, +m[2]) : null
  }
  return null
}

function nameTokens(s: string): string {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t !== '')
    .sort()
    .join(' ')
}

export function sameLabel(a: string, b: string): boolean {
  return normalise(a) === normalise(b)
}

// 'blank' when nothing readable was predicted; 'match' when the normalised strings are equal,
// or both are the same calendar date, or (labels containing "name") the same words in any order.
export function valueVerdict(got: string, expected: string, label: string): Verdict {
  const g = normalise(got)
  if (g === '') return 'blank'
  const e = normalise(expected)
  if (e === '') return 'wrong'
  if (g === e) return 'match'
  const gd = parseDate(got)
  if (gd !== null && gd === parseDate(expected)) return 'match'
  if (label.toLowerCase().includes('name') && nameTokens(got) === nameTokens(expected)) {
    return 'match'
  }
  return 'wrong'
}

export interface FieldResult {
  id: string
  box: BoxVerdict
  iou: number
  value: Verdict
}

// Among the predicted entries with the truth's label, takes the one with the highest IoU; the
// value verdict comes from that same entry. No entry with the label: miss, IoU 0, blank.
export function scoreField(truth: FieldBox, predicted: FieldBox[], id: string): FieldResult {
  let best: FieldBox | null = null
  let bestIou = -1
  for (const p of predicted) {
    if (!sameLabel(p.label, truth.label)) continue
    const v = iou(p.bbox, truth.bbox)
    if (v > bestIou) {
      best = p
      bestIou = v
    }
  }
  if (!best) return { id, box: 'miss', iou: 0, value: 'blank' }
  return {
    id,
    box: bestIou >= IOU_HIT ? 'hit' : 'miss',
    iou: bestIou,
    value: valueVerdict(best.value, truth.value, truth.label),
  }
}

export interface PredictSummary {
  total: number
  boxHits: number
  match: number
  wrong: number
  blank: number
  medianMs: number
}

export function summarise(fields: FieldResult[], pageMs: number[]): PredictSummary {
  const count = (v: Verdict) => fields.filter((f) => f.value === v).length
  return {
    total: fields.length,
    boxHits: fields.filter((f) => f.box === 'hit').length,
    match: count('match'),
    wrong: count('wrong'),
    blank: count('blank'),
    medianMs: median(pageMs),
  }
}
