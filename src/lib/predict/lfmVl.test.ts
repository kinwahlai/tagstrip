import { describe, expect, it } from 'vitest'
import { parseFields } from './lfmVl'

describe('parseFields', () => {
  it('reads a plain array', () => {
    expect(
      parseFields('[{"label": "Place", "value": "Oslo", "bbox": [0.1, 0.2, 0.3, 0.4]}]'),
    ).toEqual([{ label: 'Place', value: 'Oslo', bbox: [0.1, 0.2, 0.3, 0.4] }])
  })
  it('strips code fences and surrounding prose', () => {
    const t = 'Here:\n```json\n[{"label":"A","value":"b","bbox":[0,0,1,1]}]\n```\nDone [x]'
    expect(parseFields(t)).toHaveLength(1)
  })
  it('drops malformed entries and keeps the rest', () => {
    const t =
      '[{"label":"A","value":"x","bbox":[0,0,1]},{"label":5,"bbox":[0,0,1,1]},' +
      '{"label":"B","value":"y","bbox":[0.1,0.1,0.2,0.2]},{"label":"C","bbox":["a",0,1,1]}]'
    expect(parseFields(t).map((f) => f.label)).toEqual(['B'])
  })
  it('keeps complete entries of a truncated array', () => {
    const t = '[{"label":"A","value":"x","bbox":[0,0,0.5,0.5]}, {"label":"B","value":"y","bb'
    expect(parseFields(t).map((f) => f.label)).toEqual(['A'])
  })
  it('clamps and orders coordinates; braces inside strings do not confuse it', () => {
    const [f] = parseFields('[{"label":"A","value":"a}{]","bbox":[1.5,0.4,-0.2,0.1]}]')
    expect(f.bbox).toEqual([0, 0.1, 1, 0.4])
    expect(f.value).toBe('a}{]')
  })
  it('returns nothing when there is no array', () => {
    expect(parseFields('no idea')).toEqual([])
    expect(parseFields('')).toEqual([])
  })
})
