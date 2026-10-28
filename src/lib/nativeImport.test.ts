import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { NATIVE_EXPORT_VERSION } from './nativeFormat'
import type { NativeExportFile } from './nativeFormat'
import { ImportValidationError, importNativeExport, parseNativeExport } from './nativeImport'

beforeEach(async () => {
  await db.labelSchemas.clear()
  await db.projects.clear()
  await db.docs.clear()
  await db.pages.clear()
  await db.annotations.clear()
})

function validExport(): NativeExportFile {
  return {
    version: NATIVE_EXPORT_VERSION,
    exportedAt: 1,
    project: { name: 'Imported project' },
    labelSchema: {
      name: 'Imported schema',
      labels: [{ id: 'label-old', name: 'name', color: '#ff0000', hotkey: '1' }],
    },
    documents: [
      {
        filename: 'document.png',
        sourceType: 'image',
        pageCount: 1,
        notes: 'Keep this note',
        sourceBase64: 'aGVsbG8=',
        sourceMimeType: 'image/png',
        pages: [
          {
            pageIndex: 0,
            width: 800,
            height: 600,
            contentType: 'scanned',
            contentTypeOverridden: true,
          },
        ],
        annotations: [
          {
            pageIndex: 0,
            labelId: 'label-old',
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.4,
            text: 'Jane Doe',
            ocrSuggested: true,
          },
        ],
      },
    ],
  }
}

describe('parseNativeExport', () => {
  it('rejects values that are not JSON objects', () => {
    expect(() => parseNativeExport('not an object')).toThrow(ImportValidationError)
    expect(() => parseNativeExport(null)).toThrow(/expected a JSON object/)
  })

  it('rejects an invalid project', () => {
    expect(() => parseNativeExport({ ...validExport(), project: { name: 42 } })).toThrow(
      /project.name/,
    )
  })

  it('rejects an invalid label schema', () => {
    expect(() => parseNativeExport({ ...validExport(), labelSchema: { name: 42 } })).toThrow(
      /labelSchema/,
    )
  })

  it('rejects missing or non-list labels', () => {
    expect(() =>
      parseNativeExport({ ...validExport(), labelSchema: { name: 'schema', labels: 'none' } }),
    ).toThrow(/labelSchema.labels/)
  })

  it('rejects labels missing an id or name', () => {
    expect(() =>
      parseNativeExport({
        ...validExport(),
        labelSchema: { name: 'schema', labels: [{ id: 'label-only' }] },
      }),
    ).toThrow(/position 0.*id.*name/)
  })

  it('rejects missing or non-list documents', () => {
    expect(() => parseNativeExport({ ...validExport(), documents: 'none' })).toThrow(
      /documents.*list/,
    )
  })

  it('rejects a document that is not an object', () => {
    expect(() => parseNativeExport({ ...validExport(), documents: [null] })).toThrow(
      /Document at position 0 is not a valid object/,
    )
  })

  it('rejects a document missing its filename', () => {
    const document = validExport().documents[0]
    expect(() =>
      parseNativeExport({ ...validExport(), documents: [{ ...document, filename: 42 }] }),
    ).toThrow(/missing "filename"/)
  })

  it('rejects a document with an invalid source type', () => {
    const document = validExport().documents[0]
    expect(() =>
      parseNativeExport({ ...validExport(), documents: [{ ...document, sourceType: 'text' }] }),
    ).toThrow(/invalid "sourceType"/)
  })

  it('rejects a document whose source data is present but empty', () => {
    const document = validExport().documents[0]
    expect(() =>
      parseNativeExport({ ...validExport(), documents: [{ ...document, sourceBase64: '' }] }),
    ).toThrow(/corrupt source file data/)
  })

  it('rejects a document missing its pages list', () => {
    const document = validExport().documents[0]
    expect(() =>
      parseNativeExport({ ...validExport(), documents: [{ ...document, pages: 'none' }] }),
    ).toThrow(/missing its "pages" list/)
  })

  it('rejects a document missing its annotations list', () => {
    const document = validExport().documents[0]
    expect(() =>
      parseNativeExport({ ...validExport(), documents: [{ ...document, annotations: 'none' }] }),
    ).toThrow(/missing its "annotations" list/)
  })

  it('rejects an unsupported export version', () => {
    expect(() => parseNativeExport({ ...validExport(), version: 99 })).toThrow(
      /Unsupported export version/,
    )
  })

  it('accepts a well-formed export unchanged', () => {
    const exported = validExport()
    expect(parseNativeExport(exported)).toBe(exported)
  })
})

describe('importNativeExport', () => {
  it('persists imported records with remapped ids and decoded image data', async () => {
    const exported = validExport()
    const projectId = await importNativeExport(exported)

    const project = await db.projects.get(projectId)
    expect(project).toMatchObject({ name: 'Imported project' })

    const schema = await db.labelSchemas.get(project!.schemaId)
    expect(schema).toMatchObject({ name: 'Imported schema' })
    expect(schema!.labels[0].id).not.toBe('label-old')

    const docs = await db.docs.where('projectId').equals(projectId).toArray()
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ filename: 'document.png', notes: 'Keep this note' })

    const pages = await db.pages.where('documentId').equals(docs[0].id).toArray()
    expect(pages).toHaveLength(1)
    expect(pages[0].image).toBeDefined()

    const annotations = await db.annotations.where('documentId').equals(docs[0].id).toArray()
    expect(annotations).toHaveLength(1)
    expect(annotations[0]).toMatchObject({ text: 'Jane Doe', ocrSuggested: true })
    expect(annotations[0].labelId).toBe(schema!.labels[0].id)
  })

  it('skips annotations that reference labels absent from the schema', async () => {
    const exported = validExport()
    exported.documents[0].annotations.push({
      pageIndex: 0,
      labelId: 'missing-label',
      x: 0,
      y: 0,
      width: 0.1,
      height: 0.1,
    })

    const projectId = await importNativeExport(exported)
    const document = await db.docs.where('projectId').equals(projectId).first()
    const annotations = await db.annotations.where('documentId').equals(document!.id).toArray()

    expect(annotations).toHaveLength(1)
    expect(annotations[0].text).toBe('Jane Doe')
  })

  it('keeps the source on the document for a pdf and leaves its pages imageless', async () => {
    const exported = validExport()
    Object.assign(exported.documents[0], {
      filename: 'document.pdf',
      sourceType: 'pdf',
      sourceMimeType: 'application/pdf',
    })

    const projectId = await importNativeExport(exported)
    const document = await db.docs.where('projectId').equals(projectId).first()
    const pages = await db.pages.where('documentId').equals(document!.id).toArray()

    expect(document!.sourceBlob).toBeDefined()
    expect(pages[0].image).toBeUndefined()
  })

  it("keeps the export's document order in import time", async () => {
    const exported = validExport()
    const order = ['h', 'c', 'a', 'f', 'b', 'g', 'e', 'd']
    exported.documents = order.map((name) => ({ ...exported.documents[0], filename: `${name}.png` }))

    for (let run = 0; run < 3; run++) {
      const projectId = await importNativeExport(exported)
      const docs = await db.docs.where('projectId').equals(projectId).sortBy('createdAt')
      expect(docs.map((d) => d.filename[0])).toEqual(order)
    }
  })
})
