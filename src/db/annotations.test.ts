import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  createAnnotation,
  deleteAnnotation,
  updateAnnotationGeometry,
  updateAnnotationText,
} from './annotations'

beforeEach(async () => {
  await db.annotations.clear()
})

describe('createAnnotation', () => {
  it('stores normalized geometry for a page', async () => {
    const id = await createAnnotation('doc-1', 0, 'label-1', {
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    })
    const annotation = await db.annotations.get(id)
    expect(annotation).toMatchObject({
      documentId: 'doc-1',
      pageIndex: 0,
      labelId: 'label-1',
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    })
  })
})

describe('updateAnnotationGeometry', () => {
  it('overwrites the box position and size', async () => {
    const id = await createAnnotation('doc-1', 0, 'label-1', {
      x: 0,
      y: 0,
      width: 0.1,
      height: 0.1,
    })
    await updateAnnotationGeometry(id, { x: 0.5, y: 0.5, width: 0.2, height: 0.2 })
    const annotation = await db.annotations.get(id)
    expect(annotation).toMatchObject({ x: 0.5, y: 0.5, width: 0.2, height: 0.2 })
  })
})

describe('updateAnnotationText', () => {
  it('sets the transcription and clears the OCR-suggested flag', async () => {
    const id = await createAnnotation('doc-1', 0, 'label-1', {
      x: 0,
      y: 0,
      width: 0.1,
      height: 0.1,
    })
    await db.annotations.update(id, { ocrSuggested: true })
    await updateAnnotationText(id, 'hello world')
    const annotation = await db.annotations.get(id)
    expect(annotation).toMatchObject({ text: 'hello world', ocrSuggested: false })
  })
})

describe('deleteAnnotation', () => {
  it('removes the annotation', async () => {
    const id = await createAnnotation('doc-1', 0, 'label-1', {
      x: 0,
      y: 0,
      width: 0.1,
      height: 0.1,
    })
    await deleteAnnotation(id)
    expect(await db.annotations.get(id)).toBeUndefined()
  })
})
