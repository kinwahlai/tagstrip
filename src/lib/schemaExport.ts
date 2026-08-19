import { db } from '../db/db'
import { downloadJson } from './serialize'
import { SCHEMA_EXPORT_VERSION } from './schemaFormat'
import type { SchemaExportFile } from './schemaFormat'

export async function buildSchemaExport(schemaId: string): Promise<SchemaExportFile> {
  const schema = await db.labelSchemas.get(schemaId)
  if (!schema) throw new Error('Schema not found.')

  return {
    version: SCHEMA_EXPORT_VERSION,
    exportedAt: Date.now(),
    labelSchema: { name: schema.name, labels: schema.labels },
  }
}

export async function exportSchemaToFile(schemaId: string): Promise<void> {
  const data = await buildSchemaExport(schemaId)
  const filename = `${data.labelSchema.name.replace(/[^a-z0-9-_]+/gi, '_')}-tagstrip-schema.json`
  downloadJson(filename, data)
}
