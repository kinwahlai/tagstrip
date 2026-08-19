import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { buildSchemaExport } from './schemaExport'
import { SchemaImportValidationError, importSchemaExport, parseSchemaExport } from './schemaImport'

beforeEach(async () => {
  await db.labelSchemas.clear()
})

async function seedSchema() {
  const schemaId = 'schema-1'
  await db.labelSchemas.add({
    id: schemaId,
    name: 'Schema A',
    labels: [
      { id: 'label-1', name: 'name_field', color: '#ff0000', hotkey: '1' },
      { id: 'label-2', name: 'address_field', color: '#00ff00' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  return schemaId
}

describe('buildSchemaExport', () => {
  it('produces a self-describing export with just the schema, no documents', async () => {
    const schemaId = await seedSchema()
    const exported = await buildSchemaExport(schemaId)

    expect(exported.labelSchema.name).toBe('Schema A')
    expect(exported.labelSchema.labels).toEqual([
      { id: 'label-1', name: 'name_field', color: '#ff0000', hotkey: '1' },
      { id: 'label-2', name: 'address_field', color: '#00ff00' },
    ])
  })

  it('throws when the schema no longer exists', async () => {
    await expect(buildSchemaExport('missing')).rejects.toThrow('Schema not found.')
  })
})

describe('importSchemaExport', () => {
  it('creates a new schema with fresh ids for the schema and its labels', async () => {
    const schemaId = await seedSchema()
    const exported = await buildSchemaExport(schemaId)

    const newSchemaId = await importSchemaExport(exported)
    expect(newSchemaId).not.toBe(schemaId)

    const newSchema = await db.labelSchemas.get(newSchemaId)
    expect(newSchema?.name).toBe('Schema A')
    expect(newSchema?.labels).toHaveLength(2)
    expect(newSchema?.labels[0]).toMatchObject({
      name: 'name_field',
      color: '#ff0000',
      hotkey: '1',
    })
    expect(newSchema?.labels[0].id).not.toBe('label-1')

    const allSchemas = await db.labelSchemas.toArray()
    expect(allSchemas).toHaveLength(2)
  })
})

describe('parseSchemaExport', () => {
  it('rejects a file with no recognizable structure', () => {
    expect(() => parseSchemaExport('not an object')).toThrow(SchemaImportValidationError)
    expect(() => parseSchemaExport(null)).toThrow(SchemaImportValidationError)
  })

  it('rejects a JSON object missing required fields', () => {
    expect(() => parseSchemaExport({ foo: 'bar' })).toThrow(
      /doesn.t look like a TagStrip schema export/,
    )
  })

  it('rejects an unsupported version with a specific message', () => {
    expect(() =>
      parseSchemaExport({
        version: 99,
        labelSchema: { name: 'x', labels: [] },
      }),
    ).toThrow(/Unsupported schema export version/)
  })

  it('accepts a well-formed export', async () => {
    const schemaId = await seedSchema()
    const exported = await buildSchemaExport(schemaId)
    expect(() => parseSchemaExport(JSON.parse(JSON.stringify(exported)))).not.toThrow()
  })
})
