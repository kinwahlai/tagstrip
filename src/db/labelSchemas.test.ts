import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addLabel,
  createSchema,
  deleteSchema,
  removeLabel,
  SchemaValidationError,
} from './labelSchemas'

beforeEach(async () => {
  await db.labelSchemas.clear()
  await db.projects.clear()
})

describe('createSchema', () => {
  it('creates a schema with no labels', async () => {
    const id = await createSchema('KYC Documents v1')
    const schema = await db.labelSchemas.get(id)
    expect(schema).toMatchObject({ name: 'KYC Documents v1', labels: [] })
  })

  it('rejects an empty name', async () => {
    await expect(createSchema('   ')).rejects.toThrow(SchemaValidationError)
  })
})

describe('addLabel', () => {
  it('adds a label to a schema', async () => {
    const schemaId = await createSchema('Schema A')
    await addLabel(schemaId, { name: 'date_of_birth', color: '#ff0000', hotkey: '1' })
    const schema = await db.labelSchemas.get(schemaId)
    expect(schema?.labels).toHaveLength(1)
    expect(schema?.labels[0]).toMatchObject({
      name: 'date_of_birth',
      color: '#ff0000',
      hotkey: '1',
    })
  })

  it('rejects a duplicate label name in the same schema', async () => {
    const schemaId = await createSchema('Schema A')
    await addLabel(schemaId, { name: 'name', color: '#ff0000' })
    await expect(addLabel(schemaId, { name: 'Name', color: '#00ff00' })).rejects.toThrow(
      SchemaValidationError,
    )
  })

  it('does not lose an update when two labels are added concurrently', async () => {
    const schemaId = await createSchema('Race Schema')
    await Promise.all([
      addLabel(schemaId, { name: 'label_a', color: '#ff0000' }),
      addLabel(schemaId, { name: 'label_b', color: '#00ff00' }),
    ])
    const schema = await db.labelSchemas.get(schemaId)
    expect(schema?.labels.map((l) => l.name).sort()).toEqual(['label_a', 'label_b'])
  })
})

describe('removeLabel', () => {
  it('removes a label from a schema', async () => {
    const schemaId = await createSchema('Schema A')
    await addLabel(schemaId, { name: 'name', color: '#ff0000' })
    const schema = await db.labelSchemas.get(schemaId)
    const labelId = schema!.labels[0].id

    await removeLabel(schemaId, labelId)
    const updated = await db.labelSchemas.get(schemaId)
    expect(updated?.labels).toHaveLength(0)
  })
})

describe('deleteSchema', () => {
  it('deletes a schema not referenced by any project', async () => {
    const schemaId = await createSchema('Schema A')
    await deleteSchema(schemaId)
    expect(await db.labelSchemas.get(schemaId)).toBeUndefined()
  })

  it('blocks deleting a schema referenced by a project', async () => {
    const schemaId = await createSchema('Schema A')
    await db.projects.add({
      id: 'p1',
      name: 'Project A',
      schemaId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await expect(deleteSchema(schemaId)).rejects.toThrow(SchemaValidationError)
    expect(await db.labelSchemas.get(schemaId)).toBeDefined()
  })
})
