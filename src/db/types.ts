// Data model per SPEC.md section 4. Normalized (0-1) coordinates are used for all
// geometry so annotations survive zoom/resize/export cleanly.

export interface Label {
  id: string
  name: string
  color: string // hex
  hotkey?: string // "1".."9"
}

export interface LabelSchema {
  id: string
  name: string
  labels: Label[]
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  schemaId: string
  createdAt: number
  updatedAt: number
}

export interface Doc {
  id: string
  projectId: string
  filename: string
  pageCount: number
  sourceType: 'pdf' | 'image'
  notes?: string
  createdAt: number
}

export interface PdfTextItem {
  str: string
  x: number
  y: number
  width: number
  height: number // normalized 0-1, same space as annotations
}

export interface Page {
  id: string
  documentId: string
  pageIndex: number
  image: Blob
  width: number
  height: number
  contentType: 'text' | 'scanned' | 'unknown'
  contentTypeOverridden?: boolean
  textLayer?: PdfTextItem[]
}

export interface Annotation {
  id: string
  documentId: string
  pageIndex: number
  labelId: string
  x: number
  y: number
  width: number
  height: number
  text?: string
  ocrSuggested?: boolean
  createdAt: number
  updatedAt: number
}
