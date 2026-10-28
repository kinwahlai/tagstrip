import { describe, expect, it } from 'vitest'
import { sortRegionsBySchema } from './regionOrder'
import type { Annotation, Label } from '../db/types'

const labels: Label[] = ['a', 'b', 'c'].map((id) => ({ id, name: id, color: '#000' }))

function region(id: string, labelId: string, createdAt: number): Annotation {
  return {
    id,
    documentId: 'd',
    pageIndex: 0,
    labelId,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    createdAt,
    updatedAt: 0,
  }
}

describe('sortRegionsBySchema', () => {
  it('orders by schema label order, then by draw time, unknown labels last', () => {
    const regions = [
      region('z1', 'c', 1),
      region('z2', 'gone', 0),
      region('z3', 'a', 5),
      region('z4', 'b', 2),
      region('z5', 'a', 3),
    ]
    expect(sortRegionsBySchema(regions, labels).map((r) => r.id)).toEqual([
      'z5',
      'z3',
      'z4',
      'z1',
      'z2',
    ])
  })

  it('does not mutate its input', () => {
    const regions = [region('z1', 'b', 0), region('z2', 'a', 0)]
    sortRegionsBySchema(regions, labels)
    expect(regions.map((r) => r.id)).toEqual(['z1', 'z2'])
  })
})
