import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { createAnnotation, deleteAnnotation } from '../../db/annotations'
import { Toolbar } from './Toolbar'
import { PageStageLoader } from './PageStageLoader'
import { RegionList } from './RegionList'
import type { NormalizedRect } from '../../lib/geometry'

interface AnnotationCanvasProps {
  docId: string
  onBack: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
}

export function AnnotationCanvas({ docId, onBack }: AnnotationCanvasProps) {
  const doc = useLiveQuery(() => db.docs.get(docId), [docId])
  const project = useLiveQuery(
    () => (doc ? db.projects.get(doc.projectId) : undefined),
    [doc?.projectId],
  )
  const schema = useLiveQuery(
    () => (project ? db.labelSchemas.get(project.schemaId) : undefined),
    [project?.schemaId],
  )
  const pages = useLiveQuery(
    () => db.pages.where('documentId').equals(docId).sortBy('pageIndex'),
    [docId],
  )

  const [pageIndex, setPageIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)

  const currentPage = pages?.[pageIndex]

  const annotations = useLiveQuery(
    () => db.annotations.where('[documentId+pageIndex]').equals([docId, pageIndex]).toArray(),
    [docId, pageIndex],
  )

  function goToPage(next: number) {
    if (!pages) return
    setPageIndex(Math.max(0, Math.min(pages.length - 1, next)))
    setSelectedAnnotationId(null)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return

      if (/^[1-9]$/.test(e.key) && schema) {
        const label = schema.labels.find((l) => l.hotkey === e.key)
        if (label) setSelectedLabelId(label.id)
        return
      }
      if (e.key === 'ArrowLeft') {
        goToPage(pageIndex - 1)
        return
      }
      if (e.key === 'ArrowRight') {
        goToPage(pageIndex + 1)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotationId) {
        e.preventDefault()
        deleteAnnotation(selectedAnnotationId)
        setSelectedAnnotationId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, pages, pageIndex, selectedAnnotationId])

  if (doc === undefined || project === undefined || schema === undefined || pages === undefined) {
    return null
  }
  if (!doc || !project || !schema) {
    return <p className="p-6 text-sm text-slate-500">Document not found.</p>
  }

  const labelsById = new Map(schema.labels.map((l) => [l.id, l]))
  const activeLabelId = selectedLabelId ?? schema.labels[0]?.id ?? null

  return (
    <div className="flex h-[calc(100vh-65px)] flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-indigo-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-indigo-400"
        >
          ← {doc.filename}
        </button>
      </div>

      <Toolbar
        labels={schema.labels}
        selectedLabelId={activeLabelId}
        onSelectLabel={setSelectedLabelId}
        zoom={zoom}
        onZoomChange={setZoom}
        pageIndex={pageIndex}
        pageCount={pages.length}
        onPageChange={goToPage}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {!currentPage ? (
            <p className="p-6 text-sm text-slate-500">This document has no pages.</p>
          ) : (
            <PageStageLoader
              key={currentPage.id}
              page={currentPage}
              zoom={zoom}
              annotations={annotations ?? []}
              labelsById={labelsById}
              selectedAnnotationId={selectedAnnotationId}
              selectedLabelId={activeLabelId}
              onSelectAnnotation={setSelectedAnnotationId}
              onDeselect={() => setSelectedAnnotationId(null)}
              onCreateAnnotation={(rect: NormalizedRect) => {
                if (!activeLabelId) return
                createAnnotation(docId, pageIndex, activeLabelId, rect).then(
                  setSelectedAnnotationId,
                )
              }}
            />
          )}
        </div>

        <aside className="w-72 shrink-0 overflow-auto border-l border-slate-200 dark:border-slate-800">
          <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Regions on this page
          </h2>
          <RegionList
            annotations={annotations ?? []}
            labelsById={labelsById}
            selectedId={selectedAnnotationId}
            onSelect={setSelectedAnnotationId}
          />
        </aside>
      </div>
    </div>
  )
}
