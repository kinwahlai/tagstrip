import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { buildLabelStudioExport, DEFAULT_LABEL_STUDIO_OPTIONS } from './labelStudioExport'
import verified from './__fixtures__/labelStudioExport.verified.json'

// A golden file, and the reason it is worth one: this exact output was fed to
// Label Studio's own converter (`label-studio-converter`, their package) and it
// produced correct COCO, Pascal VOC, YOLO and JSON_MIN from it — coordinates
// checked by hand against the source geometry. See FORMATS.md for the command,
// so the check is reproducible rather than a claim.
//
// That verification cost a Python environment and their library, which is too
// much to put in CI for every commit. So it was done once, deliberately, and
// this test pins the output to the shape that passed. If the export changes,
// this fails and the verification has to be redone rather than assumed to still
// hold. The point is not that the bytes are sacred; it is that drifting away
// from a verified shape should be a decision, not an accident.
beforeEach(async () => {
  await db.labelSchemas.clear()
  await db.projects.clear()
  await db.docs.clear()
  await db.pages.clear()
  await db.annotations.clear()

  await db.labelSchemas.add({
    id: 's1',
    name: 'Proof of address',
    labels: [
      { id: 'l1', name: 'account_holder', color: '#E6194B', hotkey: '1' },
      { id: 'l2', name: 'postcode', color: '#2A8034', hotkey: '2' },
    ],
    createdAt: 1,
    updatedAt: 1,
  })
  await db.projects.add({ id: 'p1', name: 'Sample', schemaId: 's1', createdAt: 1, updatedAt: 1 })
  await db.docs.add({
    id: 'd1',
    projectId: 'p1',
    filename: 'statement.pdf',
    pageCount: 1,
    sourceType: 'pdf',
    createdAt: 1,
  })
  await db.pages.add({
    id: 'pg1',
    documentId: 'd1',
    pageIndex: 0,
    width: 595,
    height: 842,
    contentType: 'text',
  })
  await db.annotations.bulkAdd([
    {
      id: 'a1',
      documentId: 'd1',
      pageIndex: 0,
      labelId: 'l1',
      x: 0.09,
      y: 0.26,
      width: 0.3,
      height: 0.03,
      text: 'A. MORGAN',
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'a2',
      documentId: 'd1',
      pageIndex: 0,
      labelId: 'l2',
      x: 0.09,
      y: 0.41,
      width: 0.14,
      height: 0.03,
      text: 'M14 6QT',
      createdAt: 1,
      updatedAt: 1,
    },
  ])
})

describe('Label Studio export, against the verified fixture', () => {
  it('still produces the shape their converter accepted', async () => {
    const tasks = await buildLabelStudioExport('p1', {
      ...DEFAULT_LABEL_STUDIO_OPTIONS,
      includeTranscription: true,
    })
    expect(tasks).toEqual(verified)
  })
})
