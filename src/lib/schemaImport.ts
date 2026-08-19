import { db } from '../db/db'
import { createId } from './id'
import { SCHEMA_EXPORT_VERSION } from './schemaFormat'
import type { SchemaExportFile } from './schemaFormat'
import type { Label, LabelSchema } from '../db/types'

export class SchemaImportValidationError extends Error {}

function fail(message: string): never {
  throw new SchemaImportValidationError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Validates just enough structure to safely import, with a specific message
// per failure so a malformed file produces an actionable error rather than a
// generic "import failed" or a silent no-op.
export function parseSchemaExport(input: unknown): SchemaExportFile {
  if (!isRecord(input)) {
    fail('This file is not a valid TagStrip schema export — expected a JSON object.')
  }
  if (!isRecord(input.labelSchema) || typeof input.labelSchema.name !== 'string') {
    fail(
      'This file is missing a valid "labelSchema" — it doesn’t look like a TagStrip schema export.',
    )
  }
  const labels = input.labelSchema.labels
  if (!Array.isArray(labels)) {
    fail('This file’s "labelSchema.labels" is missing or not a list.')
  }
  labels.forEach((label, i) => {
    if (!isRecord(label) || typeof label.name !== 'string' || typeof label.color !== 'string') {
      fail(`Label at position ${i} in "labelSchema.labels" is missing a "name" or "color".`)
    }
  })

  if (input.version !== SCHEMA_EXPORT_VERSION) {
    fail(
      `Unsupported schema export version "${String(input.version)}" — this build of TagStrip reads version ${SCHEMA_EXPORT_VERSION}.`,
    )
  }

  return input as unknown as SchemaExportFile
}

export async function importSchemaExport(data: SchemaExportFile): Promise<string> {
  const now = Date.now()

  const labels: Label[] = data.labelSchema.labels.map((label) => ({
    id: createId(),
    name: label.name,
    color: label.color,
    hotkey: label.hotkey,
  }))

  const schema: LabelSchema = {
    id: createId(),
    name: data.labelSchema.name,
    labels,
    createdAt: now,
    updatedAt: now,
  }

  await db.labelSchemas.add(schema)
  return schema.id
}
