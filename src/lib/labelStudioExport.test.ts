import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { buildLabelStudioExport, DEFAULT_LABEL_STUDIO_OPTIONS } from './labelStudioExport'

interface LsResultEntry {
  id: string
  type: string
  from_name: string
  original_width: number
  original_height: number
  value: { x: number; y: number; width: number; height: number; labels?: string[]; text?: string[] }
}

interface LsTask {
  annotations: [{ result: LsResultEntry[] }]
}

beforeEach(async () => {
  await db.labelSchemas.clear()
  await db.projects.clear()
  await db.docs.clear()
  await db.pages.clear()
  await db.annotations.clear()

  await db.labelSchemas.add({
    id: 'schema-1',
    name: 'Schema A',
    labels: [{ id: 'label-1', name: 'name_field', color: '#ff0000' }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  await db.projects.add({
    id: 'project-1',
    name: 'Project A',
    schemaId: 'schema-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  await db.docs.add({
    id: 'doc-1',
    projectId: 'project-1',
    filename: 'test.png',
    pageCount: 1,
    sourceType: 'image',
    createdAt: Date.now(),
  })
  await db.pages.add({
    id: 'page-1',
    documentId: 'doc-1',
    pageIndex: 0,
    image: new Blob(),
    width: 800,
    height: 600,
    contentType: 'scanned',
  })
  await db.annotations.add({
    id: 'ann-1',
    documentId: 'doc-1',
    pageIndex: 0,
    labelId: 'label-1',
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.4,
    text: 'John Doe',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
})

describe('buildLabelStudioExport', () => {
  it('produces paired bbox/label entries sharing an id, with percentage coordinates', async () => {
    const tasks = (await buildLabelStudioExport(
      'project-1',
      DEFAULT_LABEL_STUDIO_OPTIONS,
    )) as LsTask[]
    expect(tasks).toHaveLength(1)

    const result = tasks[0].annotations[0].result
    expect(result).toHaveLength(2) // bbox + label, no transcription (opted out by default)

    const [bbox, label] = result
    expect(bbox.id).toBe(label.id)
    expect(bbox.from_name).toBe('bbox')
    expect(bbox.type).toBe('rectangle')
    expect(label.from_name).toBe('label')
    expect(label.type).toBe('labels')
    expect(label.value.labels).toEqual(['name_field'])

    expect(bbox.value).toMatchObject({ x: 10, y: 20, width: 30, height: 40 })
    expect(bbox.original_width).toBe(800)
    expect(bbox.original_height).toBe(600)
  })

  it('only includes a transcription entry when explicitly enabled', async () => {
    const withoutTranscription = (await buildLabelStudioExport('project-1', {
      ...DEFAULT_LABEL_STUDIO_OPTIONS,
      includeTranscription: false,
    })) as LsTask[]
    expect(withoutTranscription[0].annotations[0].result).toHaveLength(2)

    const withTranscription = (await buildLabelStudioExport('project-1', {
      ...DEFAULT_LABEL_STUDIO_OPTIONS,
      includeTranscription: true,
    })) as LsTask[]
    const result = withTranscription[0].annotations[0].result
    expect(result).toHaveLength(3)
    const transcription = result.find((r) => r.type === 'textarea')
    expect(transcription).toBeDefined()
    expect(transcription?.from_name).toBe('transcription')
    expect(transcription?.value.text).toEqual(['John Doe'])
  })

  it('uses configured tag names for the rectangle and labels result entries', async () => {
    const tasks = (await buildLabelStudioExport('project-1', {
      ...DEFAULT_LABEL_STUDIO_OPTIONS,
      bboxTagName: 'my_bbox',
      labelTagName: 'my_label',
    })) as LsTask[]
    const [bbox, label] = tasks[0].annotations[0].result
    expect(bbox.from_name).toBe('my_bbox')
    expect(label.from_name).toBe('my_label')
  })
})
