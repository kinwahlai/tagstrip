import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageStage } from './PageStage'
import type { Annotation, Label, Page } from '../../db/types'

const page: Page = {
  id: 'p1',
  documentId: 'd1',
  pageIndex: 0,
  width: 600,
  height: 800,
  contentType: 'text',
}

const labels: Label[] = [
  { id: 'la', name: 'field_a', color: '#E6194B' },
  { id: 'lb', name: 'field_b', color: '#4363D8' },
]

function annotation(id: string, labelId: string, y: number): Annotation {
  return {
    id,
    documentId: 'd1',
    pageIndex: 0,
    labelId,
    x: 0.1,
    y,
    width: 0.2,
    height: 0.1,
    createdAt: 0,
    updatedAt: 0,
  }
}

const annotations = [annotation('a1', 'la', 0.1), annotation('a2', 'lb', 0.5)]

function renderStage(overrides: { selectedLabelId?: string; selectedAnnotationId?: string } = {}) {
  render(
    <PageStage
      page={page}
      imageUrl="blob:fake"
      zoom={1}
      annotations={annotations}
      labelsById={new Map(labels.map((l) => [l.id, l]))}
      selectedAnnotationId={overrides.selectedAnnotationId ?? null}
      selectedLabelId={overrides.selectedLabelId ?? null}
      onCreateAnnotation={() => {}}
      onSelectAnnotation={() => {}}
      onDeselect={() => {}}
    />,
  )
}

function opacityOf(labelName: string): string {
  return screen.getByRole('button', { name: new RegExp(labelName) }).style.opacity
}

// A schema with 20+ fields has 20+ colours on the page at once, which is past
// the point where anyone can tell them apart. Dimming the labels you are not
// working on means you only ever discriminate one colour at a time.
describe('PageStage label focus', () => {
  it('leaves every region at full strength when no label is selected', () => {
    renderStage()
    expect(opacityOf('field_a')).toBe('')
    expect(opacityOf('field_b')).toBe('')
  })

  it('dims regions belonging to other labels once a label is selected', () => {
    renderStage({ selectedLabelId: 'la' })
    expect(opacityOf('field_a')).toBe('')
    // An unset opacity reads as '' and Number('') is 0, so assert it was set.
    expect(opacityOf('field_b')).not.toBe('')
    expect(Number(opacityOf('field_b'))).toBeGreaterThan(0)
    expect(Number(opacityOf('field_b'))).toBeLessThan(1)
  })

  it('never dims the region you have selected, whatever its label', () => {
    renderStage({ selectedLabelId: 'la', selectedAnnotationId: 'a2' })
    expect(opacityOf('field_b')).toBe('')
  })
})
