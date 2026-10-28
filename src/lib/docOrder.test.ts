import { describe, expect, it } from 'vitest'
import type { Doc } from '../db/types'
import { sortDocs } from './docOrder'

function doc(id: string, filename: string, createdAt = 0): Doc {
  return { id, projectId: 'p1', filename, pageCount: 1, sourceType: 'image', createdAt }
}

const names = (docs: Doc[]) => sortDocs(docs).map((d) => d.filename)

describe('sortDocs', () => {
  it('sorts filenames in natural order', () => {
    expect(names([doc('a', 'p10.png'), doc('b', 'p2.png'), doc('c', 'p1.png')])).toEqual([
      'p1.png',
      'p2.png',
      'p10.png',
    ])
  })

  it('ignores case', () => {
    expect(names([doc('a', 'b.png'), doc('b', 'A.png'), doc('c', 'a2.png')])).toEqual([
      'A.png',
      'a2.png',
      'b.png',
    ])
  })

  it('orders the same filename by import time, then id', () => {
    const sorted = sortDocs([
      doc('z', 'x.png', 2),
      doc('y', 'x.png', 1),
      doc('b', 'x.png', 1),
    ])
    expect(sorted.map((d) => d.id)).toEqual(['b', 'y', 'z'])
  })

  it('does not change its input', () => {
    const input = [doc('a', 'b.png'), doc('b', 'a.png')]
    sortDocs(input)
    expect(input.map((d) => d.id)).toEqual(['a', 'b'])
  })
})
