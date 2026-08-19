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
): Promise<Annotation> {
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
  return annotation
}

// Re-inserts a previously-deleted annotation with its original id and
// timestamps intact — used to undo a delete (or redo a create) without
// losing identity across further undo/redo cycles.
export async function restoreAnnotation(annotation: Annotation): Promise<void> {
  await db.annotations.add(annotation)
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

// Applies a "Suggest text" result. Unlike updateAnnotationText (a manual
// hand-edit, which always clears ocrSuggested), this preserves whatever
// ocrSuggested value the suggestion pipeline determined — true for an OCR
// guess awaiting review, false for an exact text-layer extraction.
export async function applySuggestedText(
  id: string,
  text: string,
  ocrSuggested: boolean,
): Promise<void> {
  await db.annotations.update(id, { text, ocrSuggested, updatedAt: Date.now() })
}

export async function deleteAnnotation(id: string): Promise<void> {
  await db.annotations.delete(id)
}
