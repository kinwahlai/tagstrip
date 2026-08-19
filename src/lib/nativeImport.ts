import { db } from '../db/db'
import { createId } from './id'
import { base64ToBlob } from './serialize'
import { NATIVE_EXPORT_VERSION } from './nativeFormat'
import type { NativeExportFile } from './nativeFormat'
import type { Annotation, Doc, Label, LabelSchema, Page, Project } from '../db/types'

export class ImportValidationError extends Error {}

function fail(message: string): never {
  throw new ImportValidationError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Validates just enough structure to safely import, with a specific message
// per failure so a malformed file produces an actionable error rather than a
// generic "import failed" or a silent no-op.
export function parseNativeExport(input: unknown): NativeExportFile {
  if (!isRecord(input)) {
    fail('This file is not a valid TagStrip export — expected a JSON object.')
  }
  if (!isRecord(input.project) || typeof input.project.name !== 'string') {
    fail('This file is missing a valid "project.name" — it doesn’t look like a TagStrip export.')
  }
  if (!isRecord(input.labelSchema) || typeof input.labelSchema.name !== 'string') {
    fail('This file is missing a valid "labelSchema" — it doesn’t look like a TagStrip export.')
  }
  const labels = input.labelSchema.labels
  if (!Array.isArray(labels)) {
    fail('This file’s "labelSchema.labels" is missing or not a list.')
  }
  labels.forEach((label, i) => {
    if (!isRecord(label) || typeof label.id !== 'string' || typeof label.name !== 'string') {
      fail(`Label at position ${i} in "labelSchema.labels" is missing an "id" or "name".`)
    }
  })

  const documents = input.documents
  if (!Array.isArray(documents)) {
    fail('This file’s "documents" field is missing or not a list.')
  }
  documents.forEach((doc, i) => {
    if (!isRecord(doc)) fail(`Document at position ${i} is not a valid object.`)
    else {
      if (typeof doc.filename !== 'string') fail(`Document at position ${i} is missing "filename".`)
      if (doc.sourceType !== 'pdf' && doc.sourceType !== 'image') {
        fail(
          `Document "${String(doc.filename)}" has an invalid "sourceType" (expected pdf or image).`,
        )
      }
      if (typeof doc.sourceBase64 !== 'string' || doc.sourceBase64.length === 0) {
        fail(`Document "${String(doc.filename)}" is missing its source file data.`)
      }
      if (!Array.isArray(doc.pages)) {
        fail(`Document "${String(doc.filename)}" is missing its "pages" list.`)
      }
      if (!Array.isArray(doc.annotations)) {
        fail(`Document "${String(doc.filename)}" is missing its "annotations" list.`)
      }
    }
  })

  if (input.version !== NATIVE_EXPORT_VERSION) {
    fail(
      `Unsupported export version "${String(input.version)}" — this build of TagStrip reads version ${NATIVE_EXPORT_VERSION}.`,
    )
  }

  return input as unknown as NativeExportFile
}

export async function importNativeExport(data: NativeExportFile): Promise<string> {
  const now = Date.now()

  const labelIdMap = new Map<string, string>()
  const newLabels: Label[] = data.labelSchema.labels.map((label) => {
    const newId = createId()
    labelIdMap.set(label.id, newId)
    return { id: newId, name: label.name, color: label.color, hotkey: label.hotkey }
  })

  const schema: LabelSchema = {
    id: createId(),
    name: data.labelSchema.name,
    labels: newLabels,
    createdAt: now,
    updatedAt: now,
  }

  const project: Project = {
    id: createId(),
    name: data.project.name,
    schemaId: schema.id,
    createdAt: now,
    updatedAt: now,
  }

  const docs: Doc[] = []
  const pages: Page[] = []
  const annotations: Annotation[] = []

  for (const exportedDoc of data.documents) {
    const docId = createId()
    const sourceBlob = base64ToBlob(exportedDoc.sourceBase64, exportedDoc.sourceMimeType)

    docs.push({
      id: docId,
      projectId: project.id,
      filename: exportedDoc.filename,
      pageCount: exportedDoc.pageCount,
      sourceType: exportedDoc.sourceType,
      notes: exportedDoc.notes,
      createdAt: now,
      sourceBlob: exportedDoc.sourceType === 'pdf' ? sourceBlob : undefined,
    })

    for (const exportedPage of exportedDoc.pages) {
      pages.push({
        id: createId(),
        documentId: docId,
        pageIndex: exportedPage.pageIndex,
        image: exportedDoc.sourceType === 'image' ? sourceBlob : undefined,
        width: exportedPage.width,
        height: exportedPage.height,
        contentType: exportedPage.contentType,
        contentTypeOverridden: exportedPage.contentTypeOverridden,
        textLayer: exportedPage.textLayer,
      })
    }

    for (const exportedAnnotation of exportedDoc.annotations) {
      const labelId = labelIdMap.get(exportedAnnotation.labelId)
      if (!labelId) continue // annotation referenced a label no longer in the schema; skip it
      annotations.push({
        id: createId(),
        documentId: docId,
        pageIndex: exportedAnnotation.pageIndex,
        labelId,
        x: exportedAnnotation.x,
        y: exportedAnnotation.y,
        width: exportedAnnotation.width,
        height: exportedAnnotation.height,
        text: exportedAnnotation.text,
        ocrSuggested: exportedAnnotation.ocrSuggested,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  await db.transaction(
    'rw',
    db.labelSchemas,
    db.projects,
    db.docs,
    db.pages,
    db.annotations,
    async () => {
      await db.labelSchemas.add(schema)
      await db.projects.add(project)
      await db.docs.bulkAdd(docs)
      await db.pages.bulkAdd(pages)
      await db.annotations.bulkAdd(annotations)
    },
  )

  return project.id
}
