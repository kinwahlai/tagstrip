import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { buildNativeExport } from './nativeExport'
import { ImportValidationError, importNativeExport, parseNativeExport } from './nativeImport'

beforeEach(async () => {
  await db.labelSchemas.clear()
  await db.projects.clear()
  await db.docs.clear()
  await db.pages.clear()
  await db.annotations.clear()
})

async function seedProject() {
  const schemaId = 'schema-1'
  await db.labelSchemas.add({
    id: schemaId,
    name: 'Schema A',
    labels: [{ id: 'label-1', name: 'name_field', color: '#ff0000', hotkey: '1' }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  const projectId = 'project-1'
  await db.projects.add({
    id: projectId,
    name: 'Project A',
    schemaId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  const docId = 'doc-1'
  await db.docs.add({
    id: docId,
    projectId,
    filename: 'test.png',
    pageCount: 1,
    sourceType: 'image',
    notes: 'a note',
    createdAt: Date.now(),
  })
  await db.pages.add({
    id: 'page-1',
    documentId: docId,
    pageIndex: 0,
    image: new Blob(['fake-image-bytes'], { type: 'image/png' }),
    width: 800,
    height: 600,
    contentType: 'scanned',
  })
  await db.annotations.add({
    id: 'ann-1',
    documentId: docId,
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
  return projectId
}

describe('buildNativeExport', () => {
  it('produces a self-describing export with schema, annotations, and text', async () => {
    const projectId = await seedProject()
    const exported = await buildNativeExport(projectId)

    expect(exported.project.name).toBe('Project A')
    expect(exported.labelSchema.labels).toEqual([
      { id: 'label-1', name: 'name_field', color: '#ff0000', hotkey: '1' },
    ])
    expect(exported.documents).toHaveLength(1)
    expect(exported.documents[0].annotations).toEqual([
      {
        pageIndex: 0,
        labelId: 'label-1',
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
        text: 'John Doe',
        ocrSuggested: undefined,
      },
    ])
    expect(exported.documents[0].sourceBase64.length).toBeGreaterThan(0)
  })
})

describe('importNativeExport', () => {
  it('recreates a project with correctly positioned annotations', async () => {
    const projectId = await seedProject()
    const exported = await buildNativeExport(projectId)

    const newProjectId = await importNativeExport(exported)
    expect(newProjectId).not.toBe(projectId)

    const newProject = await db.projects.get(newProjectId)
    expect(newProject?.name).toBe('Project A')

    const newDocs = await db.docs.where('projectId').equals(newProjectId).toArray()
    expect(newDocs).toHaveLength(1)

    const newAnnotations = await db.annotations.where('documentId').equals(newDocs[0].id).toArray()
    expect(newAnnotations).toHaveLength(1)
    expect(newAnnotations[0]).toMatchObject({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
      text: 'John Doe',
    })

    const newSchema = await db.labelSchemas.get(newProject!.schemaId)
    expect(newSchema?.labels[0].name).toBe('name_field')
    expect(newAnnotations[0].labelId).toBe(newSchema!.labels[0].id)
  })
})

describe('parseNativeExport', () => {
  it('rejects a file with no recognizable structure', () => {
    expect(() => parseNativeExport('not an object')).toThrow(ImportValidationError)
    expect(() => parseNativeExport(null)).toThrow(ImportValidationError)
  })

  it('rejects a JSON object missing required TagStrip fields', () => {
    expect(() => parseNativeExport({ foo: 'bar' })).toThrow(/doesn.t look like a TagStrip export/)
  })

  it('rejects an unsupported version with a specific message', () => {
    expect(() =>
      parseNativeExport({
        version: 99,
        project: { name: 'x' },
        labelSchema: { name: 'x', labels: [] },
        documents: [],
      }),
    ).toThrow(/Unsupported export version/)
  })

  it('accepts a well-formed export', async () => {
    const projectId = await seedProject()
    const exported = await buildNativeExport(projectId)
    expect(() => parseNativeExport(JSON.parse(JSON.stringify(exported)))).not.toThrow()
  })
})
