import { db } from './db'
import { createId } from '../lib/id'
import type { Annotation } from './types'

export interface AnnotationGeometry {
  x: number
  y: number
  width: number
  height: number
}

export async function createAnnotation(
  documentId: string,
  pageIndex: number,
  labelId: string,
  geometry: AnnotationGeometry,
): Promise<string> {
  const now = Date.now()
  const annotation: Annotation = {
    id: createId(),
    documentId,
    pageIndex,
    labelId,
    ...geometry,
    createdAt: now,
    updatedAt: now,
  }
  await db.annotations.add(annotation)
  return annotation.id
}

export async function updateAnnotationGeometry(
  id: string,
  geometry: AnnotationGeometry,
): Promise<void> {
  await db.annotations.update(id, { ...geometry, updatedAt: Date.now() })
}

export async function updateAnnotationText(id: string, text: string): Promise<void> {
  await db.annotations.update(id, { text, ocrSuggested: false, updatedAt: Date.now() })
}

export async function deleteAnnotation(id: string): Promise<void> {
  await db.annotations.delete(id)
}
