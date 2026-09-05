import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../db/db'
import { ProjectDetail } from './ProjectDetail'
import type { Doc, Page } from '../db/types'

function doc(id: string, filename: string): Doc {
  return { id, projectId: 'p1', filename, pageCount: 1, sourceType: 'image', createdAt: 0 }
}

function page(documentId: string): Page {
  return {
    id: `${documentId}-0`,
    documentId,
    pageIndex: 0,
    image: new Blob(['x']),
    width: 600,
    height: 800,
    contentType: 'scanned',
  }
}

beforeEach(async () => {
  // The layout hook reads the viewport, and the page preview makes an object URL
  // for its blob; jsdom has neither.
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }))

  await db.projects.clear()
  await db.docs.clear()
  await db.pages.clear()
  await db.annotations.clear()
  await db.projects.add({ id: 'p1', name: 'Invoices', schemaId: 's1', createdAt: 0, updatedAt: 0 })
  await db.docs.bulkAdd([doc('d1', 'first.png'), doc('d2', 'second.png')])
  await db.pages.bulkAdd([page('d1'), page('d2')])
})

async function selectDoc(filename: string) {
  fireEvent.click(await screen.findByText(filename))
  return (await screen.findByLabelText('Notes')) as HTMLTextAreaElement
}

// Notes belong to one document. The field holds a draft in local state, so it has
// to be told when the document under it changes — otherwise the note typed on the
// first document stays on screen for every document picked after it.
describe('ProjectDetail document notes', () => {
  it('does not carry one document’s notes over to the next', async () => {
    render(<ProjectDetail projectId="p1" onOpenAnnotate={() => {}} />)

    const notes = await selectDoc('first.png')
    fireEvent.change(notes, { target: { value: 'blurry scan' } })
    fireEvent.blur(notes)
    await waitFor(async () => {
      expect((await db.docs.get('d1'))?.notes).toBe('blurry scan')
    })

    expect((await selectDoc('second.png')).value).toBe('')
    expect((await db.docs.get('d2'))?.notes).toBeUndefined()
  })

  it('shows each document’s own stored notes when selected', async () => {
    await db.docs.update('d2', { notes: 'second only' })
    render(<ProjectDetail projectId="p1" onOpenAnnotate={() => {}} />)

    expect((await selectDoc('first.png')).value).toBe('')
    expect((await selectDoc('second.png')).value).toBe('second only')
  })
})
