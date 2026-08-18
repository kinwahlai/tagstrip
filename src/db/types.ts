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
  // Original PDF bytes, kept so unvisited pages can still be rasterized lazily
  // after a reload (not in SPEC.md's literal Doc shape, but required to make
  // the lazy-rendering requirement in section 6 survive a reload). Not set for
  // sourceType "image", where the page's own `image` Blob already is the source.
  sourceBlob?: Blob
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
  // Undefined until the page is first rendered. Pages are rasterized lazily
  // (see src/lib/pdf.ts) so uploading a many-page PDF doesn't rasterize every
  // page up front (SPEC.md section 6). Plain image uploads populate this
  // immediately since the source file already is the raster.
  image?: Blob
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
