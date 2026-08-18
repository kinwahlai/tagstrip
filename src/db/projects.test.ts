import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createSchema } from './labelSchemas'
import { createProject, deleteProject } from './projects'

beforeEach(async () => {
  await db.labelSchemas.clear()
  await db.projects.clear()
  await db.docs.clear()
  await db.pages.clear()
  await db.annotations.clear()
})

describe('createProject', () => {
  it('creates a project attached to a schema', async () => {
    const schemaId = await createSchema('Schema A')
    const projectId = await createProject('Project A', schemaId)
    const project = await db.projects.get(projectId)
    expect(project).toMatchObject({ name: 'Project A', schemaId })
  })

  it('rejects an empty name', async () => {
    const schemaId = await createSchema('Schema A')
    await expect(createProject('  ', schemaId)).rejects.toThrow()
  })
})

describe('deleteProject', () => {
  it('cascades to the project docs, pages, and annotations', async () => {
    const schemaId = await createSchema('Schema A')
    const projectId = await createProject('Project A', schemaId)

    const docId = 'doc-1'
    await db.docs.add({
      id: docId,
      projectId,
      filename: 'test.png',
      pageCount: 1,
      sourceType: 'image',
      createdAt: Date.now(),
    })
    const pageId = 'page-1'
    await db.pages.add({
      id: pageId,
      documentId: docId,
      pageIndex: 0,
      image: new Blob(),
      width: 100,
      height: 100,
      contentType: 'scanned',
    })
    await db.annotations.add({
      id: 'ann-1',
      documentId: docId,
      pageIndex: 0,
      labelId: 'label-1',
      x: 0,
      y: 0,
      width: 0.1,
      height: 0.1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    await deleteProject(projectId)

    expect(await db.projects.get(projectId)).toBeUndefined()
    expect(await db.docs.get(docId)).toBeUndefined()
    expect(await db.pages.get(pageId)).toBeUndefined()
    expect(await db.annotations.get('ann-1')).toBeUndefined()
  })
})
