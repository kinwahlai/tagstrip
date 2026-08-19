import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { textItemBoundingBox } from './pdfTextItemGeometry'
import type { PdfTextRunLike } from './pdfTextItemGeometry'
import type { PdfTextItem } from '../db/types'

// pdf.js's getTextContent() returns (TextItem | TextMarkedContent)[], but only
// TextItem is exported as a public type. Mirror the shape we actually use.
function isTextRunItem(item: object): item is PdfTextRunLike {
  return 'str' in item
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// Target resolution for rasterized pages: ~144 DPI (PDF points are 72/inch).
// Good enough to read fine print when annotating, without ballooning Blob sizes.
export const RENDER_SCALE = 2

export interface PdfPageMetadata {
  width: number
  height: number
  contentType: 'text' | 'scanned'
  textLayer?: PdfTextItem[]
}

export async function loadPdfDocument(source: Blob): Promise<PDFDocumentProxy> {
  const data = await source.arrayBuffer()
  return pdfjsLib.getDocument({ data }).promise
}

// Extracts per-page geometry and text-layer content without rasterizing the page,
// so upload stays cheap even for many-page documents (rendering happens lazily on
// first view — see renderPageToBlob).
export async function extractPageMetadata(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
): Promise<PdfPageMetadata> {
  const page = await pdfDoc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: RENDER_SCALE })
  const width = Math.round(viewport.width)
  const height = Math.round(viewport.height)

  const textContent = await page.getTextContent()
  const meaningfulItems = (textContent.items as unknown as PdfTextRunLike[]).filter(
    (item) => isTextRunItem(item) && item.str.trim().length > 0,
  )

  if (meaningfulItems.length === 0) {
    return { width, height, contentType: 'scanned' }
  }

  const textLayer: PdfTextItem[] = meaningfulItems.map((item) =>
    textItemBoundingBox(item, viewport.transform, width, height),
  )

  return { width, height, contentType: 'text', textLayer }
}

export async function renderPageToBlob(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: RENDER_SCALE })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)

  await page.render({ canvas, viewport }).promise

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Failed to encode rendered page as an image.')

  return { blob, width: canvas.width, height: canvas.height }
}
