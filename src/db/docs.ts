import type { PDFDocumentProxy } from 'pdfjs-dist'
import { db } from './db'
import { createId } from '../lib/id'
import { getImageDimensions } from '../lib/image'
import type { Doc, Page } from './types'

// pdfjs-dist (plus its worker) is a large dependency; importing it lazily
// keeps it out of the initial bundle for people who never touch a PDF.
const pdfLib = () => import('../lib/pdf')

// Avoids re-parsing the source PDF on every lazily-rendered page within a
// session; cleared per-document on delete so a re-upload can't reuse a stale
// entry under a fresh document id (ids are unique per upload, so this is
// mostly defensive).
const pdfDocumentCache = new Map<string, Promise<PDFDocumentProxy>>()

async function getCachedPdfDocument(doc: Doc): Promise<PDFDocumentProxy> {
  if (!doc.sourceBlob) throw new Error('Source PDF is not available for this document.')

  let cached = pdfDocumentCache.get(doc.id)
  if (!cached) {
    cached = pdfLib().then(({ loadPdfDocument }) => loadPdfDocument(doc.sourceBlob!))
    pdfDocumentCache.set(doc.id, cached)
  }
  return cached
}

export async function addPdfDocument(
  projectId: string,
  file: File,
  onProgress?: (pagesProcessed: number, pageCount: number) => void,
): Promise<string> {
  const { extractPageMetadata, loadPdfDocument } = await pdfLib()
  const pdfDoc = await loadPdfDocument(file)
  const pageCount = pdfDoc.numPages
  const docId = createId()

  const doc: Doc = {
    id: docId,
    projectId,
    filename: file.name,
    pageCount,
    sourceType: 'pdf',
    createdAt: Date.now(),
    sourceBlob: file,
  }

  const pages: Page[] = []
  for (let i = 1; i <= pageCount; i++) {
    const metadata = await extractPageMetadata(pdfDoc, i)
    pages.push({
      id: createId(),
      documentId: docId,
      pageIndex: i - 1,
      width: metadata.width,
      height: metadata.height,
      contentType: metadata.contentType,
      textLayer: metadata.textLayer,
    })
    onProgress?.(i, pageCount)
  }

  await db.transaction('rw', db.docs, db.pages, async () => {
    await db.docs.add(doc)
    await db.pages.bulkAdd(pages)
  })

  return docId
}

export async function addImageDocument(projectId: string, file: File): Promise<string> {
  const { width, height } = await getImageDimensions(file)
  const docId = createId()

  const doc: Doc = {
    id: docId,
    projectId,
    filename: file.name,
    pageCount: 1,
    sourceType: 'image',
    createdAt: Date.now(),
  }

  const page: Page = {
    id: createId(),
    documentId: docId,
    pageIndex: 0,
    image: file,
    width,
    height,
    contentType: 'scanned',
  }

  await db.transaction('rw', db.docs, db.pages, async () => {
    await db.docs.add(doc)
    await db.pages.add(page)
  })

  return docId
}

export async function updateDocNotes(docId: string, notes: string): Promise<void> {
  await db.docs.update(docId, { notes })
}

export async function setPageContentType(
  pageId: string,
  contentType: Page['contentType'],
): Promise<void> {
  await db.pages.update(pageId, { contentType, contentTypeOverridden: true })
}

export async function deleteDoc(docId: string): Promise<void> {
  await db.transaction('rw', db.docs, db.pages, db.annotations, async () => {
    await db.annotations.where('documentId').equals(docId).delete()
    await db.pages.where('documentId').equals(docId).delete()
    await db.docs.delete(docId)
  })
  pdfDocumentCache.delete(docId)
}

// Renders and caches a PDF page's raster image the first time it's viewed —
// pages are rasterized lazily (SPEC.md section 6), not all up front on upload.
// Re-derives from the document's stored source PDF, so this works even after
// a full page reload discarded any in-memory PDFDocumentProxy.
export async function ensurePageRendered(page: Page): Promise<Page> {
  if (page.image) return page

  const doc = await db.docs.get(page.documentId)
  if (!doc) throw new Error('Document not found.')

  const { renderPageToBlob } = await pdfLib()
  const pdfDoc = await getCachedPdfDocument(doc)
  const { blob, width, height } = await renderPageToBlob(pdfDoc, page.pageIndex + 1)
  await db.pages.update(page.id, { image: blob, width, height })
  return { ...page, image: blob, width, height }
}
