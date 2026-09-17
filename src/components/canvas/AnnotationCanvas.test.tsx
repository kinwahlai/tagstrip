import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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

function renderCanvas() {
  render(
    <AnnotationCanvas
      docId="d1"
      onBack={() => {}}
      projectName="Invoices"
      docs={[doc()]}
      overlayOpen={false}
      onCloseOverlay={() => {}}
      onSelectDoc={() => {}}
    />,
  )
}

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
