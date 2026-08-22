import type { LabelSchema, Page, Project } from '../db/types'

// Every figure the tables show is derived here, once, from index keys rather
// than records — see the v2 index comment in db/db.ts for why loading the rows
// is not an option. The pure functions take plain arrays so they can be tested
// without a database; useWorkspaceStats does the Dexie half.

export interface Aggregates {
  regionsByLabel: Map<string, number>
  lastUsedByLabel: Map<string, number>
  regionsByDoc: Map<string, number>
  docIdsByProject: Map<string, string[]>
  contentTypeByDoc: Map<string, Page['contentType']>
}

export interface AggregateInput {
  /** [labelId, updatedAt] — one entry per annotation, ascending. */
  labelKeys: [string, number][]
  /** documentId — one entry per annotation. */
  annotationDocKeys: string[]
  /** [projectId, docId] — one entry per document. */
  docKeys: [string, string][]
  /** [documentId, contentType] — one entry per page. */
  pageKeys: [string, Page['contentType']][]
}

// A document's content type is not stored: contentType lives on the PAGE, so a
// multi-page document has no single stored answer. The tag exists to say which
// route "Suggest text" will take, so it reports the worst case rather than the
// commonest one — one scanned page in a forty-page PDF still means you will hit
// OCR in that document, and a tag reading "text" would have hidden it.
const CONTENT_TYPE_PRECEDENCE: Page['contentType'][] = ['scanned', 'unknown', 'text']

export function docContentType(pageTypes: Page['contentType'][]): Page['contentType'] {
  if (pageTypes.length === 0) return 'unknown'
  return CONTENT_TYPE_PRECEDENCE.find((t) => pageTypes.includes(t)) ?? 'unknown'
}

export function aggregate(input: AggregateInput): Aggregates {
  const regionsByLabel = new Map<string, number>()
  const lastUsedByLabel = new Map<string, number>()
  for (const [labelId, updatedAt] of input.labelKeys) {
    regionsByLabel.set(labelId, (regionsByLabel.get(labelId) ?? 0) + 1)
    const seen = lastUsedByLabel.get(labelId)
    if (seen === undefined || updatedAt > seen) lastUsedByLabel.set(labelId, updatedAt)
  }

  const regionsByDoc = new Map<string, number>()
  for (const docId of input.annotationDocKeys) {
    regionsByDoc.set(docId, (regionsByDoc.get(docId) ?? 0) + 1)
  }

  const docIdsByProject = new Map<string, string[]>()
  for (const [projectId, docId] of input.docKeys) {
    const list = docIdsByProject.get(projectId)
    if (list) list.push(docId)
    else docIdsByProject.set(projectId, [docId])
  }

  const pageTypesByDoc = new Map<string, Page['contentType'][]>()
  for (const [docId, contentType] of input.pageKeys) {
    const list = pageTypesByDoc.get(docId)
    if (list) list.push(contentType)
    else pageTypesByDoc.set(docId, [contentType])
  }
  const contentTypeByDoc = new Map<string, Page['contentType']>()
  for (const [docId, types] of pageTypesByDoc) {
    contentTypeByDoc.set(docId, docContentType(types))
  }

  return { regionsByLabel, lastUsedByLabel, regionsByDoc, docIdsByProject, contentTypeByDoc }
}

export interface ProjectSummary {
  docs: number
  annotated: number
  regions: number
}

export function summarizeProject(projectId: string, agg: Aggregates): ProjectSummary {
  const docIds = agg.docIdsByProject.get(projectId) ?? []
  let annotated = 0
  let regions = 0
  for (const docId of docIds) {
    const n = agg.regionsByDoc.get(docId) ?? 0
    if (n > 0) annotated++
    regions += n
  }
  return { docs: docIds.length, annotated, regions }
}

export interface SchemaSummary {
  regions: number
  usedBy: string[]
}

export function summarizeSchema(
  schema: LabelSchema,
  projects: Project[],
  agg: Aggregates,
): SchemaSummary {
  // Regions belong to labels, and labels belong to the schema, so a schema's
  // region count is its own labels' counts — not the sum over its projects.
  // Those differ once a label is deleted while its regions survive on a page.
  let regions = 0
  for (const label of schema.labels) {
    regions += agg.regionsByLabel.get(label.id) ?? 0
  }
  const usedBy = projects.filter((p) => p.schemaId === schema.id).map((p) => p.name)
  return { regions, usedBy }
}
