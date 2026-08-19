import type { Label } from '../db/types'

// TagStrip's standalone label-schema export format — a self-describing,
// document-free JSON containing just the labels themselves. Separate from
// nativeFormat.ts's project export (which embeds a schema alongside a whole
// project's documents/annotations): sharing a schema with a team shouldn't
// require exporting every document just to carry the label list along.
export const SCHEMA_EXPORT_VERSION = 1

export interface SchemaExportFile {
  version: typeof SCHEMA_EXPORT_VERSION
  exportedAt: number
  labelSchema: { name: string; labels: Label[] }
}
