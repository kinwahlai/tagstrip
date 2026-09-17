import { db } from '../db/db'
import { blobToBase64, downloadJson } from './serialize'
import { NATIVE_EXPORT_VERSION } from './nativeFormat'
import type { NativeExportDoc, NativeExportFile } from './nativeFormat'

export interface NativeExportOptions {
  includeSource: boolean
}

// The restore-everything choice, made explicit rather than assumed — see
// SPEC.md section 10. Included by default because that is today's behaviour
// and the only round-trip path back to a viewable document; the export
// dialog is what makes leaving it on (or turning it off) a decision rather
// than a silent default.
export const DEFAULT_NATIVE_EXPORT_OPTIONS: NativeExportOptions = { includeSource: true }

export async function buildNativeExport(
  projectId: string,
  options: NativeExportOptions,
): Promise<NativeExportFile> {
  const project = await db.projects.get(projectId)
  if (!project) throw new Error('Project not found.')

  const schema = await db.labelSchemas.get(project.schemaId)
  if (!schema) throw new Error('This project’s label schema is missing.')

  const docs = await db.docs.where('projectId').equals(projectId).sortBy('createdAt')

  const documents: NativeExportDoc[] = []
  for (const doc of docs) {
    const pages = await db.pages.where('documentId').equals(doc.id).sortBy('pageIndex')
    const annotations = await db.annotations.where('documentId').equals(doc.id).sortBy('pageIndex')

    // Left unset (not set to undefined — see NativeExportDoc) when the caller
    // asked to leave the source out. In that case a missing blob is not an
    // error: the whole point of includeSource: false is to produce a file
    // that doesn't need one.
    let sourceBase64: string | undefined
    let sourceMimeType: string | undefined
    if (options.includeSource) {
      if (doc.sourceType === 'pdf') {
        if (!doc.sourceBlob) throw new Error(`"${doc.filename}" has no source PDF to export.`)
        sourceBase64 = await blobToBase64(doc.sourceBlob)
        sourceMimeType = 'application/pdf'
      } else {
        const page = pages[0]
        if (!page?.image) throw new Error(`"${doc.filename}" has no source image to export.`)
        sourceBase64 = await blobToBase64(page.image)
        sourceMimeType = page.image.type || 'image/png'
      }
    }

    documents.push({
      filename: doc.filename,
      sourceType: doc.sourceType,
      pageCount: doc.pageCount,
      notes: doc.notes,
      ...(sourceBase64 !== undefined && sourceMimeType !== undefined
        ? { sourceBase64, sourceMimeType }
        : {}),
      pages: pages.map((p) => ({
        pageIndex: p.pageIndex,
        width: p.width,
        height: p.height,
        contentType: p.contentType,
        contentTypeOverridden: p.contentTypeOverridden,
        textLayer: p.textLayer,
      })),
      annotations: annotations.map((a) => ({
        pageIndex: a.pageIndex,
        labelId: a.labelId,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        text: a.text,
        ocrSuggested: a.ocrSuggested,
      })),
    })
  }

  return {
    version: NATIVE_EXPORT_VERSION,
    exportedAt: Date.now(),
    project: { name: project.name },
    labelSchema: { name: schema.name, labels: schema.labels },
    documents,
  }
}

export async function exportProjectToFile(
  projectId: string,
  options: NativeExportOptions,
): Promise<void> {
  const data = await buildNativeExport(projectId, options)
  const suffix = options.includeSource ? 'tagstrip-export' : 'tagstrip-annotations-only'
  const filename = `${data.project.name.replace(/[^a-z0-9-_]+/gi, '_')}-${suffix}.json`
  downloadJson(filename, data)
}
