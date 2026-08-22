import { describe, expect, it } from 'vitest'
import { aggregate, docContentType, summarizeProject, summarizeSchema } from './stats'
import type { AggregateInput } from './stats'
import type { LabelSchema, Project } from '../db/types'

const EMPTY: AggregateInput = {
  labelKeys: [],
  annotationDocKeys: [],
  docKeys: [],
  pageKeys: [],
}

describe('docContentType', () => {
  it('reports the worst case, not the commonest', () => {
    // One scanned page in a long text document still means OCR somewhere in it.
    expect(docContentType(['text', 'text', 'text', 'scanned'])).toBe('scanned')
  })

  it('prefers unknown over text when nothing is scanned', () => {
    expect(docContentType(['text', 'unknown'])).toBe('unknown')
  })

  it('is text only when every page is', () => {
    expect(docContentType(['text', 'text'])).toBe('text')
  })

  it('calls a document with no pages unknown rather than guessing', () => {
    expect(docContentType([])).toBe('unknown')
  })
})

describe('aggregate', () => {
  it('counts regions per label and keeps the latest use', () => {
    const agg = aggregate({
      ...EMPTY,
      labelKeys: [
        ['surname', 100],
        ['surname', 300],
        ['surname', 200],
        ['dob', 50],
      ],
    })
    expect(agg.regionsByLabel.get('surname')).toBe(3)
    expect(agg.regionsByLabel.get('dob')).toBe(1)
    expect(agg.lastUsedByLabel.get('surname')).toBe(300)
    expect(agg.lastUsedByLabel.get('dob')).toBe(50)
  })

  it('groups documents by project', () => {
    const agg = aggregate({
      ...EMPTY,
      docKeys: [
        ['p1', 'd1'],
        ['p1', 'd2'],
        ['p2', 'd3'],
      ],
    })
    expect(agg.docIdsByProject.get('p1')).toEqual(['d1', 'd2'])
    expect(agg.docIdsByProject.get('p2')).toEqual(['d3'])
  })
})

describe('summarizeProject', () => {
  it('counts a document as annotated only once it has a region', () => {
    const agg = aggregate({
      ...EMPTY,
      docKeys: [
        ['p1', 'd1'],
        ['p1', 'd2'],
        ['p1', 'd3'],
      ],
      annotationDocKeys: ['d1', 'd1', 'd3'],
    })
    expect(summarizeProject('p1', agg)).toEqual({ docs: 3, annotated: 2, regions: 3 })
  })

  it('reports zeroes for a project with no documents rather than throwing', () => {
    expect(summarizeProject('nobody', aggregate(EMPTY))).toEqual({
      docs: 0,
      annotated: 0,
      regions: 0,
    })
  })
})

describe('summarizeSchema', () => {
  const schema = {
    id: 's1',
    name: 'KYC passport',
    labels: [
      { id: 'surname', name: 'surname', color: '#E6194B' },
      { id: 'dob', name: 'date_of_birth', color: '#4363D8' },
    ],
    createdAt: 0,
    updatedAt: 0,
  } as LabelSchema
  const projects = [
    { id: 'p1', name: 'KYC batch 1', schemaId: 's1' },
    { id: 'p2', name: 'Invoices', schemaId: 's2' },
    { id: 'p3', name: 'KYC batch 2', schemaId: 's1' },
  ] as Project[]

  it('sums its own labels and names every project using it', () => {
    const agg = aggregate({
      ...EMPTY,
      labelKeys: [
        ['surname', 1],
        ['surname', 2],
        ['dob', 3],
        ['unrelated', 4],
      ],
    })
    expect(summarizeSchema(schema, projects, agg)).toEqual({
      regions: 3,
      usedBy: ['KYC batch 1', 'KYC batch 2'],
    })
  })

  it('ignores regions left behind by a deleted label', () => {
    // Removing a label from a schema does not delete regions already drawn with
    // it, so counting by project would report more than the schema can explain.
    const agg = aggregate({ ...EMPTY, labelKeys: [['deleted_label', 1]] })
    expect(summarizeSchema(schema, projects, agg).regions).toBe(0)
  })
})
