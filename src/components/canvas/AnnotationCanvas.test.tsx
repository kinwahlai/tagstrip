import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../../db/db'
import { AnnotationCanvas } from './AnnotationCanvas'
import type { Doc, LabelSchema, Page, Project } from '../../db/types'

const schema: LabelSchema = {
  id: 's1',
  name: 'Invoice fields',
  labels: [{ id: 'l1', name: 'total', color: '#E6194B', hotkey: 't' }],
  createdAt: 0,
  updatedAt: 0,
}

const project: Project = { id: 'p1', name: 'Invoices', schemaId: 's1', createdAt: 0, updatedAt: 0 }

function doc(): Doc {
  return {
    id: 'd1',
    projectId: 'p1',
    filename: 'invoice.png',
    pageCount: 1,
    sourceType: 'image',
    createdAt: 0,
  }
}

function page(): Page {
  return {
    id: 'd1-0',
    documentId: 'd1',
    pageIndex: 0,
    image: new Blob(['x']),
    width: 600,
    height: 800,
    contentType: 'text',
  }
}

beforeEach(async () => {
  // The page preview makes an object URL for its blob; jsdom has neither.
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
  )

  await db.labelSchemas.clear()
  await db.projects.clear()
  await db.docs.clear()
  await db.pages.clear()
  await db.annotations.clear()
  await db.labelSchemas.add(schema)
  await db.projects.add(project)
  await db.docs.add(doc())
  await db.pages.add(page())
})

const onContentTypeChange = vi.fn()
const onPrevDoc = vi.fn()
const onNextDoc = vi.fn()

function renderCanvas({ hasPrevDoc = false, hasNextDoc = false } = {}) {
  onContentTypeChange.mockClear()
  onPrevDoc.mockClear()
  onNextDoc.mockClear()
  render(
    <AnnotationCanvas
      docId="d1"
      onBack={() => {}}
      projectName="Invoices"
      docs={[doc()]}
      overlayOpen={false}
      onCloseOverlay={() => {}}
      onSelectDoc={() => {}}
      onContentTypeChange={onContentTypeChange}
      hasPrevDoc={hasPrevDoc}
      hasNextDoc={hasNextDoc}
      onPrevDoc={onPrevDoc}
      onNextDoc={onNextDoc}
    />,
  )
}

// The tag lives in the header beside the filename, which this component does
// not render, so the page's content type has to be handed up.
describe('AnnotationCanvas content type', () => {
  it('reports the current page’s content type, and clears it on unmount', async () => {
    renderCanvas()
    await screen.findByTestId('zoom-readout')

    await waitFor(() => expect(onContentTypeChange).toHaveBeenLastCalledWith('text'))
    cleanup()
    expect(onContentTypeChange).toHaveBeenLastCalledWith(null)
  })
})

describe('AnnotationCanvas inspector', () => {
  it('keeps labels and regions in separate inspector sections', async () => {
    renderCanvas()
    await screen.findByTestId('zoom-readout')

    const labels = screen.getByRole('group', { name: 'Labels' })
    const regionsHeading = screen.getByRole('heading', { name: /^Regions on this page/ })
    const labelsSection = labels.closest('.ts-inspector-labels') as HTMLElement | null
    const regionsSection = regionsHeading.closest('.ts-inspector-regions') as HTMLElement | null

    expect(labelsSection).not.toBeNull()
    expect(regionsSection).not.toBeNull()
    expect(labelsSection).not.toContainElement(regionsSection)
    expect(regionsSection).not.toContainElement(labelsSection)
  })
})

// Ctrl/Cmd + wheel is the only way to zoom by wheel — a plain scroll has to
// keep scrolling the page area exactly as before, or every ordinary scroll
// over the canvas would start zooming it instead.
describe('AnnotationCanvas wheel zoom', () => {
  it('leaves zoom untouched on a plain wheel scroll', async () => {
    renderCanvas()
    expect(await screen.findByTestId('zoom-readout')).toHaveTextContent('100%')

    fireEvent.wheel(screen.getByTestId('canvas-scroll-area'), {
      deltaY: -500,
      clientX: 100,
      clientY: 100,
    })

    expect(screen.getByTestId('zoom-readout')).toHaveTextContent('100%')
  })

  it('zooms about the pointer when the Ctrl modifier is held', async () => {
    renderCanvas()
    expect(await screen.findByTestId('zoom-readout')).toHaveTextContent('100%')

    fireEvent.wheel(screen.getByTestId('canvas-scroll-area'), {
      deltaY: -500,
      ctrlKey: true,
      clientX: 100,
      clientY: 100,
    })

    expect(screen.getByTestId('zoom-readout')).not.toHaveTextContent('100%')
  })

  it('zooms on a Cmd (metaKey) + wheel just the same as Ctrl', async () => {
    renderCanvas()
    expect(await screen.findByTestId('zoom-readout')).toHaveTextContent('100%')

    fireEvent.wheel(screen.getByTestId('canvas-scroll-area'), {
      deltaY: -500,
      metaKey: true,
      clientX: 100,
      clientY: 100,
    })

    expect(screen.getByTestId('zoom-readout')).not.toHaveTextContent('100%')
  })
})

// ] and [ step through the project's documents without leaving the canvas.
// Letters and digits are label hotkeys, so the brackets are what is free.
describe('AnnotationCanvas document keys', () => {
  it('opens the next and previous document on ] and [', async () => {
    renderCanvas({ hasPrevDoc: true, hasNextDoc: true })
    await screen.findByTestId('zoom-readout')

    fireEvent.keyDown(window, { key: ']' })
    fireEvent.keyDown(window, { key: '[' })

    expect(onNextDoc).toHaveBeenCalledTimes(1)
    expect(onPrevDoc).toHaveBeenCalledTimes(1)
  })

  it('does nothing past either end', async () => {
    renderCanvas()
    await screen.findByTestId('zoom-readout')

    fireEvent.keyDown(window, { key: ']' })
    fireEvent.keyDown(window, { key: '[' })

    expect(onNextDoc).not.toHaveBeenCalled()
    expect(onPrevDoc).not.toHaveBeenCalled()
  })
})

describe('AnnotationCanvas region order', () => {
  it('lists regions in schema label order, whatever their ids', async () => {
    await db.labelSchemas.put({
      ...schema,
      labels: [
        { id: 'l1', name: 'total', color: '#E6194B' },
        { id: 'l2', name: 'date', color: '#3CB44B' },
      ],
    })
    const base = {
      documentId: 'd1',
      pageIndex: 0,
      x: 0,
      y: 0,
      width: 0.1,
      height: 0.1,
      updatedAt: 0,
    }
    // ids chosen so primary-key order is the reverse of schema order
    await db.annotations.bulkAdd([
      { ...base, id: 'a', labelId: 'l2', createdAt: 0 },
      { ...base, id: 'b', labelId: 'l1', createdAt: 1 },
    ])
    renderCanvas()

    await waitFor(() =>
      expect(
        screen.getAllByLabelText(/^Transcription for/).map((el) => el.getAttribute('aria-label')),
      ).toEqual(['Transcription for total region', 'Transcription for date region']),
    )
  })
})
