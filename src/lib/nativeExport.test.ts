import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { buildNativeExport, DEFAULT_NATIVE_EXPORT_OPTIONS } from './nativeExport'
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
    const exported = await buildNativeExport(projectId, DEFAULT_NATIVE_EXPORT_OPTIONS)

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
    // includeSource: true (today's default) still embeds the source, exactly
    // as before options existed.
    expect(exported.documents[0].sourceBase64?.length).toBeGreaterThan(0)
    expect(exported.documents[0].sourceMimeType).toBe('image/png')
  })

  it('omits sourceBase64 and sourceMimeType entirely when includeSource is false', async () => {
    const projectId = await seedProject()
    const exported = await buildNativeExport(projectId, { includeSource: false })

    expect(exported.documents).toHaveLength(1)
    expect('sourceBase64' in exported.documents[0]).toBe(false)
    expect('sourceMimeType' in exported.documents[0]).toBe(false)
    // Still carries everything an annotations-only hand-off promises.
    expect(exported.documents[0].notes).toBe('a note')
    expect(exported.documents[0].pages).toHaveLength(1)
    expect(exported.documents[0].annotations).toHaveLength(1)
  })

  it('does not throw for a missing blob when includeSource is false', async () => {
    // A doc with no page image at all — buildNativeExport must not try to
    // read a blob it was told to leave out.
    const projectId = await seedProject()
    await db.pages.update('page-1', { image: undefined })
    await expect(
      buildNativeExport(projectId, { includeSource: false }),
    ).resolves.not.toThrow()
  })
})

describe('importNativeExport', () => {
  it('recreates a project with correctly positioned annotations', async () => {
    const projectId = await seedProject()
    const exported = await buildNativeExport(projectId, DEFAULT_NATIVE_EXPORT_OPTIONS)

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

  it('marks a source-less document sourceMissing, with no blob and no page image', async () => {
    const projectId = await seedProject()
    const exported = await buildNativeExport(projectId, { includeSource: false })

    const newProjectId = await importNativeExport(exported)
    const newDocs = await db.docs.where('projectId').equals(newProjectId).toArray()
    expect(newDocs).toHaveLength(1)
    expect(newDocs[0].sourceMissing).toBe(true)
    expect(newDocs[0].sourceBlob).toBeUndefined()

    const newPages = await db.pages.where('documentId').equals(newDocs[0].id).toArray()
    expect(newPages).toHaveLength(1)
    expect(newPages[0].image).toBeUndefined()

    // Everything that doesn't need pixels still comes back.
    const newAnnotations = await db.annotations.where('documentId').equals(newDocs[0].id).toArray()
    expect(newAnnotations).toHaveLength(1)
    expect(newAnnotations[0].text).toBe('John Doe')
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
    const exported = await buildNativeExport(projectId, DEFAULT_NATIVE_EXPORT_OPTIONS)
    expect(() => parseNativeExport(JSON.parse(JSON.stringify(exported)))).not.toThrow()
  })

  it('accepts a well-formed annotations-only export, with sourceBase64 absent', async () => {
    const projectId = await seedProject()
    const exported = await buildNativeExport(projectId, { includeSource: false })
    expect(() => parseNativeExport(JSON.parse(JSON.stringify(exported)))).not.toThrow()
  })

  it('rejects a present-but-empty sourceBase64, distinctly from an absent one', async () => {
    const projectId = await seedProject()
    const exported = await buildNativeExport(projectId, { includeSource: false })
    const corrupted = JSON.parse(JSON.stringify(exported))
    corrupted.documents[0].sourceBase64 = ''

    expect(() => parseNativeExport(corrupted)).toThrow(ImportValidationError)
    expect(() => parseNativeExport(corrupted)).toThrow(/corrupt source file data/)
  })

  it('rejects a non-string sourceBase64', async () => {
    const projectId = await seedProject()
    const exported = await buildNativeExport(projectId, { includeSource: false })
    const corrupted = JSON.parse(JSON.stringify(exported))
    corrupted.documents[0].sourceBase64 = 12345

    expect(() => parseNativeExport(corrupted)).toThrow(/corrupt source file data/)
  })
})
