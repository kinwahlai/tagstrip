import { db } from './db'
import { createId } from '../lib/id'
import type { Project } from './types'

export async function createProject(name: string, schemaId: string): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Project name cannot be empty.')

  const now = Date.now()
  const project: Project = {
    id: createId(),
    name: trimmed,
    schemaId,
    createdAt: now,
    updatedAt: now,
  }
  await db.projects.add(project)
  return project.id
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.docs, db.pages, db.annotations, async () => {
    const docIds = (await db.docs.where('projectId').equals(id).primaryKeys()) as string[]
    await db.annotations.where('documentId').anyOf(docIds).delete()
    await db.pages.where('documentId').anyOf(docIds).delete()
    await db.docs.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
}
