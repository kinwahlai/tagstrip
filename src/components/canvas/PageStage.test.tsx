import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PageStage } from './PageStage'
import type { Annotation, Label, Page } from '../../db/types'
import type { NormalizedRect } from '../../lib/geometry'

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

function renderStage(
  overrides: {
    selectedLabelId?: string
    selectedAnnotationId?: string
    sourceMissing?: boolean
    onUpdateGeometry?: (id: string, before: NormalizedRect, after: NormalizedRect) => void
    onSelectAnnotation?: (id: string) => void
  } = {},
) {
  render(
    <PageStage
      page={page}
      imageUrl="blob:fake"
      zoom={1}
      annotations={annotations}
      labelsById={new Map(labels.map((l) => [l.id, l]))}
      selectedAnnotationId={overrides.selectedAnnotationId ?? null}
      selectedLabelId={overrides.selectedLabelId ?? null}
      sourceMissing={overrides.sourceMissing ?? false}
      onCreateAnnotation={() => {}}
      onSelectAnnotation={overrides.onSelectAnnotation ?? (() => {})}
      onDeselect={() => {}}
      onUpdateGeometry={overrides.onUpdateGeometry ?? (() => {})}
    />,
  )
}

function opacityOf(labelName: string): string {
  return screen.getByRole('button', { name: new RegExp(labelName) }).style.opacity
}

function regionButton(labelName: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(labelName) })
}

// The stage sizes its container to page.width/height * zoom (600x800 at zoom
// 1 here), but jsdom never actually runs layout, so getBoundingClientRect
// would otherwise report all zeros and every normalized coordinate would come
// out as 0. Mocking it to that same 600x800 box, anchored at the origin, is
// what lets clientX/clientY in these tests map onto normalized page
// coordinates the same way a real drag would.
function mockContainerRect() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 600,
    height: 800,
    right: 600,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => '',
  } as DOMRect)
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

// a1 is x:0.1 y:0.1 width:0.2 height:0.1 on a 600x800 page, i.e. a pixel box
// from (60,80) to (180,160).
describe('PageStage move', () => {
  beforeEach(mockContainerRect)
  afterEach(() => vi.restoreAllMocks())

  it('selects and moves an unselected region in the same gesture', () => {
    const onSelectAnnotation = vi.fn()
    const onUpdateGeometry = vi.fn()
    renderStage({ onSelectAnnotation, onUpdateGeometry })

    fireEvent.mouseDown(regionButton('field_a'), { button: 0, clientX: 120, clientY: 120 })
    expect(onSelectAnnotation).toHaveBeenCalledWith('a1')

    fireEvent.mouseMove(window, { clientX: 180, clientY: 120 }) // +60px = +0.1 normalized x
    fireEvent.mouseUp(window, { clientX: 180, clientY: 120 })

    expect(onUpdateGeometry).toHaveBeenCalledTimes(1)
    const [id, before, after] = onUpdateGeometry.mock.calls[0]
    expect(id).toBe('a1')
    expect(before).toEqual({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 })
    expect(after.x).toBeCloseTo(0.2)
    expect(after.y).toBeCloseTo(0.1)
    expect(after.width).toBeCloseTo(0.2)
    expect(after.height).toBeCloseTo(0.1)
  })

  it('does not write anything for a mousedown/mouseup with no movement', () => {
    const onUpdateGeometry = vi.fn()
    renderStage({ onUpdateGeometry })

    fireEvent.mouseDown(regionButton('field_a'), { button: 0, clientX: 120, clientY: 120 })
    fireEvent.mouseUp(window, { clientX: 120, clientY: 120 })

    expect(onUpdateGeometry).not.toHaveBeenCalled()
  })

  it('clamps against the page edges instead of letting the box cross them', () => {
    const onUpdateGeometry = vi.fn()
    renderStage({ onUpdateGeometry })

    // Drag a1 (60,80)-(180,160) far up and to the left — well past the page.
    fireEvent.mouseDown(regionButton('field_a'), { button: 0, clientX: 120, clientY: 120 })
    fireEvent.mouseMove(window, { clientX: -1000, clientY: -1000 })
    fireEvent.mouseUp(window, { clientX: -1000, clientY: -1000 })

    const [, , after] = onUpdateGeometry.mock.calls[0]
    expect(after.x).toBe(0)
    expect(after.y).toBe(0)
    expect(after.width).toBeCloseTo(0.2)
    expect(after.height).toBeCloseTo(0.1)
  })

  it('clamps against the opposite (bottom-right) edges too', () => {
    const onUpdateGeometry = vi.fn()
    renderStage({ onUpdateGeometry })

    fireEvent.mouseDown(regionButton('field_a'), { button: 0, clientX: 120, clientY: 120 })
    fireEvent.mouseMove(window, { clientX: 4000, clientY: 4000 })
    fireEvent.mouseUp(window, { clientX: 4000, clientY: 4000 })

    const [, , after] = onUpdateGeometry.mock.calls[0]
    expect(after.x).toBeCloseTo(1 - 0.2)
    expect(after.y).toBeCloseTo(1 - 0.1)
  })

  it('allows moving a region on a source-missing document', () => {
    const onUpdateGeometry = vi.fn()
    renderStage({ onUpdateGeometry, sourceMissing: true })

    fireEvent.mouseDown(regionButton('field_a'), { button: 0, clientX: 120, clientY: 120 })
    fireEvent.mouseMove(window, { clientX: 180, clientY: 120 })
    fireEvent.mouseUp(window, { clientX: 180, clientY: 120 })

    expect(onUpdateGeometry).toHaveBeenCalledTimes(1)
  })
})

describe('PageStage resize', () => {
  beforeEach(mockContainerRect)
  afterEach(() => vi.restoreAllMocks())

  function handles(): HTMLElement[] {
    return Array.from(document.querySelectorAll('.ts-handle'))
  }

  it('resizes from the se handle, anchoring the opposite (nw) corner', () => {
    const onUpdateGeometry = vi.fn()
    renderStage({ selectedAnnotationId: 'a1', onUpdateGeometry })

    // Handles render in nw, ne, sw, se order — see PageStage.tsx.
    const se = handles()[3]
    // se corner of a1 is at (180px, 160px).
    fireEvent.mouseDown(se, { button: 0, clientX: 180, clientY: 160 })
    fireEvent.mouseMove(window, { clientX: 240, clientY: 240 }) // (0.4, 0.3)
    fireEvent.mouseUp(window, { clientX: 240, clientY: 240 })

    expect(onUpdateGeometry).toHaveBeenCalledTimes(1)
    const [id, before, after] = onUpdateGeometry.mock.calls[0]
    expect(id).toBe('a1')
    expect(before).toEqual({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 })
    // nw anchor (0.1, 0.1) unchanged; se corner now at (0.4, 0.3).
    expect(after.x).toBeCloseTo(0.1)
    expect(after.y).toBeCloseTo(0.1)
    expect(after.width).toBeCloseTo(0.3)
    expect(after.height).toBeCloseTo(0.2)
  })

  it('flips the box when a corner is dragged past its opposite edge', () => {
    const onUpdateGeometry = vi.fn()
    renderStage({ selectedAnnotationId: 'a1', onUpdateGeometry })

    const se = handles()[3]
    fireEvent.mouseDown(se, { button: 0, clientX: 180, clientY: 160 })
    // Drag se up past the nw anchor at (0.1, 0.1) = (60px, 80px).
    fireEvent.mouseMove(window, { clientX: 0, clientY: 0 })
    fireEvent.mouseUp(window, { clientX: 0, clientY: 0 })

    const [, , after] = onUpdateGeometry.mock.calls[0]
    expect(after.width).toBeGreaterThan(0)
    expect(after.height).toBeGreaterThan(0)
    expect(after.x).toBeCloseTo(0)
    expect(after.y).toBeCloseTo(0)
  })

  it('clamps to the minimum size instead of collapsing when a handle is dragged onto its anchor', () => {
    const onUpdateGeometry = vi.fn()
    renderStage({ selectedAnnotationId: 'a1', onUpdateGeometry })

    const se = handles()[3]
    // Drag se all the way onto the nw anchor (60px, 80px) — would collapse to
    // zero without the MIN_BOX_SIZE clamp.
    fireEvent.mouseDown(se, { button: 0, clientX: 180, clientY: 160 })
    fireEvent.mouseMove(window, { clientX: 60, clientY: 80 })
    fireEvent.mouseUp(window, { clientX: 60, clientY: 80 })

    const [, , after] = onUpdateGeometry.mock.calls[0]
    expect(after.width).toBeGreaterThan(0)
    expect(after.height).toBeGreaterThan(0)
    expect(after.width).toBeCloseTo(0.004)
    expect(after.height).toBeCloseTo(0.004)
  })

  it('does not also start a move when a handle drag begins', () => {
    const onUpdateGeometry = vi.fn()
    renderStage({ selectedAnnotationId: 'a1', onUpdateGeometry })

    const se = handles()[3]
    fireEvent.mouseDown(se, { button: 0, clientX: 180, clientY: 160 })
    fireEvent.mouseMove(window, { clientX: 240, clientY: 240 })
    fireEvent.mouseUp(window, { clientX: 240, clientY: 240 })

    // If the region body's move handler had also fired, this would have run
    // twice (once as a resize, once as a move), and x/y would have shifted by
    // the drag delta instead of the nw corner staying anchored.
    expect(onUpdateGeometry).toHaveBeenCalledTimes(1)
    const [, , after] = onUpdateGeometry.mock.calls[0]
    expect(after.x).toBeCloseTo(0.1)
    expect(after.y).toBeCloseTo(0.1)
  })
})
