import type { Label, PdfTextItem } from '../db/types'

// TagStrip's native, self-describing export/import format. Includes the
// original document bytes (base64) so a fresh project imported from this file
// is immediately viewable in the annotation canvas, not just a metadata
// record — the JSON file is this tool's only backup/restore mechanism, since
// there's no server. Base64's ~33% size overhead is an accepted tradeoff here
// (unlike IndexedDB's own storage, see SPEC.md section 4's Blob-not-base64 note).
export const NATIVE_EXPORT_VERSION = 1

export interface NativeExportPage {
  pageIndex: number
  width: number
  height: number
  contentType: 'text' | 'scanned' | 'unknown'
  contentTypeOverridden?: boolean
  textLayer?: PdfTextItem[]
}

export interface NativeExportAnnotation {
  pageIndex: number
  labelId: string
  x: number
  y: number
  width: number
  height: number
  text?: string
  ocrSuggested?: boolean
}

export interface NativeExportDoc {
  filename: string
  sourceType: 'pdf' | 'image'
  pageCount: number
  notes?: string
  // Base64-encoded original file bytes: the source PDF for "pdf" docs, or the
  // single page's image for "image" docs. MIME type is fixed per sourceType
  // (application/pdf, or carried per-page below for images).
  sourceBase64: string
  sourceMimeType: string
  pages: NativeExportPage[]
  annotations: NativeExportAnnotation[]
}

export interface NativeExportFile {
  version: typeof NATIVE_EXPORT_VERSION
  exportedAt: number
  project: { name: string }
  labelSchema: { name: string; labels: Label[] }
  documents: NativeExportDoc[]
}
