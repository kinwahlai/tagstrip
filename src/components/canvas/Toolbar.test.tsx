import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Toolbar } from './Toolbar'

function renderToolbar(pageIndex = 0, pageCount = 10) {
  const onPageChange = vi.fn()
  render(
    <Toolbar
      zoom={1}
      onZoomChange={() => {}}
      onFitZoom={() => {}}
      minZoom={0.5}
      pageIndex={pageIndex}
      pageCount={pageCount}
      onPageChange={onPageChange}
      canUndo={false}
      canRedo={false}
      onUndo={() => {}}
      onRedo={() => {}}
    />,
  )
  return { onPageChange }
}

function pageButtons() {
  return screen.getAllByRole('button', { name: /^Page \d+$/ })
}

describe('Toolbar page navigation', () => {
  it('changes to the selected page when a page number is clicked', () => {
    const { onPageChange } = renderToolbar(0, 10)

    fireEvent.click(screen.getByRole('button', { name: 'Page 5' }))

    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it('marks only the current page button as current', () => {
    renderToolbar(4, 10)

    expect(screen.getByRole('button', { name: 'Page 5' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Page 6' })).not.toHaveAttribute('aria-current')
  })

  it('renders every page without a gap for a three-page document', () => {
    renderToolbar(1, 3)

    expect(pageButtons()).toHaveLength(3)
    expect(screen.queryAllByText('…')).toHaveLength(0)
  })

  it('renders the middle page window and two gaps for a twenty-page document', () => {
    renderToolbar(9, 20)

    expect(pageButtons().map((button) => button.textContent)).toEqual(['1', '9', '10', '11', '20'])
    expect(screen.queryAllByText('…')).toHaveLength(2)
  })

  it('gives every slot, gaps included, the same width sized to the widest page number', () => {
    renderToolbar(9, 120)

    const slots = [...pageButtons(), ...screen.getAllByText('…')]
    expect(slots).toHaveLength(7)
    expect(new Set(slots.map((slot) => slot.style.width))).toEqual(new Set(['calc(3ch + 12px)']))
  })

  it('keeps labels out of the toolbar and controls on one row', () => {
    renderToolbar()

    expect(screen.queryByRole('group', { name: 'Labels' })).not.toBeInTheDocument()
    const controls = screen.getByRole('group', { name: 'Pages' }).parentElement!
    expect(controls).toContainElement(screen.getByRole('button', { name: 'Undo' }))
    expect(controls).toContainElement(screen.getByRole('button', { name: 'Zoom in' }))
  })

  it('draws undo and redo as icon-only buttons that still carry their names', () => {
    renderToolbar()

    for (const name of ['Undo', 'Redo']) {
      const button = screen.getByRole('button', { name })
      expect(button.querySelector('svg')).not.toBeNull()
      expect(button.textContent).toBe('')
      expect(button.title).toContain(name)
    }
  })

  it('disables Previous on the first page and Next on the last page', () => {
    renderToolbar(0, 3)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled()

    cleanup()
    renderToolbar(2, 3)
    expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })
})

describe('Toolbar next document', () => {
  function renderWithDocs(hasNextDoc: boolean) {
    const onNextDoc = vi.fn()
    render(
      <Toolbar
        zoom={1}
        onZoomChange={() => {}}
        onFitZoom={() => {}}
        minZoom={0.5}
        pageIndex={0}
        pageCount={2}
        onPageChange={() => {}}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        hasNextDoc={hasNextDoc}
        onNextDoc={onNextDoc}
      />,
    )
    return { onNextDoc }
  }

  it('opens the next document from the toolbar', () => {
    const { onNextDoc } = renderWithDocs(true)
    fireEvent.click(screen.getByRole('button', { name: /Next doc/ }))
    expect(onNextDoc).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('is disabled on the last document', () => {
    renderWithDocs(false)
    expect(screen.getByRole('button', { name: /Next doc/ })).toHaveProperty('disabled', true)
    cleanup()
  })
})
