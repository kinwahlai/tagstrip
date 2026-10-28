import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../../db/db'
import { RegionList } from './RegionList'
import type { Annotation, Label } from '../../db/types'

const label: Label = { id: 'la', name: 'total', color: '#E6194B' }

function annotation(text?: string): Annotation {
  return {
    id: 'a1',
    documentId: 'd1',
    pageIndex: 0,
    labelId: 'la',
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.1,
    text,
    createdAt: 0,
    updatedAt: 0,
  }
}

function renderList(a: Annotation) {
  const view = render(
    <RegionList
      annotations={[a]}
      labelsById={new Map([[label.id, label]])}
      selectedId={null}
      onSelect={() => {}}
      onDelete={() => {}}
      onSuggestText={async () => {}}
    />,
  )
  const rerender = (next: Annotation) =>
    view.rerender(
      <RegionList
        annotations={[next]}
        labelsById={new Map([[label.id, label]])}
        selectedId={null}
        onSelect={() => {}}
        onDelete={() => {}}
        onSuggestText={async () => {}}
      />,
    )
  return { rerender }
}

function field(): HTMLInputElement {
  return screen.getByLabelText('Transcription for total region') as HTMLInputElement
}

beforeEach(async () => {
  await db.annotations.clear()
  await db.annotations.add(annotation('hello'))
})

// The transcription field is written through to IndexedDB, so the stored value
// arrives back a keystroke or two behind what has been typed. A field driven
// straight off that echo rewrites itself under the caret, which the browser
// answers by dropping the caret at the end of the text — the reported symptom
// after Suggest text fills a region with something worth editing in the middle.
describe('RegionList transcription field', () => {
  it('shows a keystroke immediately, before the store echoes it back', () => {
    renderList(annotation('hello'))
    fireEvent.change(field(), { target: { value: 'heXllo' } })
    expect(field().value).toBe('heXllo')
  })

  it('keeps what has been typed when a lagging echo of an earlier keystroke lands', () => {
    const { rerender } = renderList(annotation('hello'))
    fireEvent.change(field(), { target: { value: 'heXllo' } })
    fireEvent.change(field(), { target: { value: 'heXYllo' } })
    // The store catches up one keystroke at a time; the first echo is stale.
    rerender(annotation('heXllo'))
    expect(field().value).toBe('heXYllo')
  })

  it('still adopts text that arrives from outside the field, as Suggest text does', () => {
    const { rerender } = renderList(annotation(''))
    rerender(annotation('TOTAL DUE 42.00'))
    expect(field().value).toBe('TOTAL DUE 42.00')
  })

  it('writes each keystroke through to the store', async () => {
    renderList(annotation('hello'))
    fireEvent.change(field(), { target: { value: 'heXllo' } })
    await waitFor(async () => {
      expect((await db.annotations.get('a1'))?.text).toBe('heXllo')
    })
  })
})

// Selecting a region (on the canvas or in the list) brings its transcription
// field forward so it can be typed into at once; Esc hands the keys back.
describe('RegionList selection focus', () => {
  function list(selectedId: string | null) {
    return (
      <RegionList
        annotations={[annotation('hello')]}
        labelsById={new Map([[label.id, label]])}
        selectedId={selectedId}
        onSelect={() => {}}
        onDelete={() => {}}
        onSuggestText={async () => {}}
      />
    )
  }

  it('focuses and highlights the selected region’s field', async () => {
    const view = render(list(null))
    expect(document.activeElement).not.toBe(field())
    expect(field().dataset.selected).toBeUndefined()

    view.rerender(list('a1'))

    await waitFor(() => expect(document.activeElement).toBe(field()))
    expect(field().dataset.selected).toBe('true')
  })

  it('leaves the field on Esc', async () => {
    render(list('a1'))
    await waitFor(() => expect(document.activeElement).toBe(field()))

    fireEvent.keyDown(field(), { key: 'Escape' })

    expect(document.activeElement).not.toBe(field())
  })
})
