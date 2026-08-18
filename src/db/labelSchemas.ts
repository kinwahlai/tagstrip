import { db } from './db'
import { createId } from '../lib/id'
import type { Label, LabelSchema } from './types'

export class SchemaValidationError extends Error {
  code: 'EMPTY_NAME' | 'DUPLICATE_LABEL_NAME' | 'DUPLICATE_HOTKEY' | 'SCHEMA_IN_USE'

  constructor(code: SchemaValidationError['code'], message: string) {
    super(message)
    this.code = code
  }
}

function normalize(name: string): string {
  return name.trim().toLowerCase()
}

export async function createSchema(name: string): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) throw new SchemaValidationError('EMPTY_NAME', 'Schema name cannot be empty.')

  const now = Date.now()
  const schema: LabelSchema = {
    id: createId(),
    name: trimmed,
    labels: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.labelSchemas.add(schema)
  return schema.id
}

export async function renameSchema(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new SchemaValidationError('EMPTY_NAME', 'Schema name cannot be empty.')

  await db.labelSchemas.update(id, { name: trimmed, updatedAt: Date.now() })
}

export async function deleteSchema(id: string): Promise<void> {
  const projectsUsingSchema = await db.projects.where('schemaId').equals(id).count()
  if (projectsUsingSchema > 0) {
    throw new SchemaValidationError(
      'SCHEMA_IN_USE',
      `This schema is used by ${projectsUsingSchema} project${projectsUsingSchema === 1 ? '' : 's'}. Delete or reassign ${projectsUsingSchema === 1 ? 'that project' : 'those projects'} first.`,
    )
  }
  await db.labelSchemas.delete(id)
}

export interface LabelInput {
  name: string
  color: string
  hotkey?: string
}

function validateLabel(
  existingLabels: Label[],
  input: LabelInput,
  skipLabelId?: string,
): { name: string; hotkey?: string } {
  const name = input.name.trim()
  if (!name) throw new SchemaValidationError('EMPTY_NAME', 'Label name cannot be empty.')

  const duplicateName = existingLabels.some(
    (l) => l.id !== skipLabelId && normalize(l.name) === normalize(name),
  )
  if (duplicateName) {
    throw new SchemaValidationError(
      'DUPLICATE_LABEL_NAME',
      `A label named "${name}" already exists in this schema.`,
    )
  }

  const hotkey = input.hotkey?.trim() || undefined
  if (hotkey) {
    const duplicateHotkey = existingLabels.some((l) => l.id !== skipLabelId && l.hotkey === hotkey)
    if (duplicateHotkey) {
      throw new SchemaValidationError(
        'DUPLICATE_HOTKEY',
        `Hotkey "${hotkey}" is already assigned to another label in this schema.`,
      )
    }
  }

  return { name, hotkey }
}

export async function addLabel(schemaId: string, input: LabelInput): Promise<void> {
  await db.transaction('rw', db.labelSchemas, async () => {
    const schema = await db.labelSchemas.get(schemaId)
    if (!schema) throw new Error('Schema not found.')

    const { name, hotkey } = validateLabel(schema.labels, input)
    const label: Label = { id: createId(), name, color: input.color, hotkey }

    await db.labelSchemas.update(schemaId, {
      labels: [...schema.labels, label],
      updatedAt: Date.now(),
    })
  })
}

export async function updateLabel(
  schemaId: string,
  labelId: string,
  input: LabelInput,
): Promise<void> {
  await db.transaction('rw', db.labelSchemas, async () => {
    const schema = await db.labelSchemas.get(schemaId)
    if (!schema) throw new Error('Schema not found.')

    const { name, hotkey } = validateLabel(schema.labels, input, labelId)
    const labels = schema.labels.map((l) =>
      l.id === labelId ? { ...l, name, color: input.color, hotkey } : l,
    )

    await db.labelSchemas.update(schemaId, { labels, updatedAt: Date.now() })
  })
}

export async function removeLabel(schemaId: string, labelId: string): Promise<void> {
  await db.transaction('rw', db.labelSchemas, async () => {
    const schema = await db.labelSchemas.get(schemaId)
    if (!schema) throw new Error('Schema not found.')

    const labels = schema.labels.filter((l) => l.id !== labelId)
    await db.labelSchemas.update(schemaId, { labels, updatedAt: Date.now() })
  })
}
