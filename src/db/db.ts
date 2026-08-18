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
  }
}

export const db = new TagStripDB()
