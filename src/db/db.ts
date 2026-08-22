import Dexie, { type EntityTable } from 'dexie'
import type { Annotation, Doc, LabelSchema, Page, Project } from './types'

export class TagStripDB extends Dexie {
  labelSchemas!: EntityTable<LabelSchema, 'id'>
  projects!: EntityTable<Project, 'id'>
  docs!: EntityTable<Doc, 'id'>
  pages!: EntityTable<Page, 'id'>
  annotations!: EntityTable<Annotation, 'id'>

  constructor() {
    super('tagstrip')
    this.version(1).stores({
      labelSchemas: 'id, name, updatedAt',
      projects: 'id, name, schemaId, updatedAt',
      docs: 'id, projectId, createdAt',
      pages: 'id, documentId, [documentId+pageIndex]',
      annotations: 'id, documentId, pageIndex, labelId, [documentId+pageIndex]',
    })

    // v2 adds three compound indexes purely so the summary counts can be read
    // from the indexes instead of the records. That distinction matters here:
    // a Doc carries the original PDF bytes and a Page carries its rasterised
    // image, so counting by loading rows would pull every uploaded document and
    // every rendered page into memory to produce a handful of integers.
    //   [projectId+id]          — documents per project, and which ones
    //   [labelId+updatedAt]     — regions per label, and when each was last used
    //   [documentId+contentType] — each page's content type, without its image
    this.version(2).stores({
      docs: 'id, projectId, createdAt, [projectId+id]',
      pages: 'id, documentId, [documentId+pageIndex], [documentId+contentType]',
      annotations:
        'id, documentId, pageIndex, labelId, [documentId+pageIndex], [labelId+updatedAt]',
    })
  }
}

export const db = new TagStripDB()
