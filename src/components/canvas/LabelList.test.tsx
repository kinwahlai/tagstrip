import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LabelList } from './LabelList'
import type { Label } from '../../db/types'

const labels: Label[] = [
  { id: 'name', name: 'Name', color: '#E6194B', hotkey: 'n' },
  { id: 'amount', name: 'Amount', color: '#3CB44B', hotkey: 'a' },
  { id: 'date', name: 'Date', color: '#4363D8' },
]

function renderList(list = labels, selectedLabelId: string | null = null) {
  const onSelectLabel = vi.fn()
  const view = render(
    <LabelList labels={list} selectedLabelId={selectedLabelId} onSelectLabel={onSelectLabel} />,
  )
  return { onSelectLabel, container: view.container }
}

describe('LabelList', () => {
  it('renders one button per label with its name and hotkey', () => {
    renderList()

    expect(screen.getAllByRole('button')).toHaveLength(labels.length)
    expect(screen.getByRole('button', { name: /Name/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Amount/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Date' })).toBeInTheDocument()
  })

  it('marks only the selected label as pressed', () => {
    renderList(labels, 'amount')

    expect(screen.getByRole('button', { name: /Name/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Amount/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Date' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects a label when clicked', () => {
    const { onSelectLabel } = renderList()

    fireEvent.click(screen.getByRole('button', { name: /Amount/ }))

    expect(onSelectLabel).toHaveBeenCalledWith('amount')
  })

  it('uses one column for nine labels and two columns for ten', () => {
    const nine = Array.from({ length: 9 }, (_, index) => ({
      id: `label-${index}`,
      name: `Label ${index}`,
      color: '#000000',
    }))
    const ten = [...nine, { id: 'label-9', name: 'Label 9', color: '#000000' }]

    const { container } = renderList(nine)
    expect(container.firstElementChild).toHaveAttribute('data-columns', '1')

    const tenView = renderList(ten)
    expect(tenView.container.firstElementChild).toHaveAttribute('data-columns', '2')
  })

  it("sets each button's title to its label name", () => {
    renderList()

    for (const label of labels) {
      expect(screen.getByRole('button', { name: new RegExp(label.name) })).toHaveAttribute(
        'title',
        label.name,
      )
    }
  })

  it('does not render a keyboard badge for a label without a hotkey', () => {
    renderList()

    expect(screen.getByRole('button', { name: 'Date' }).querySelector('.ts-kbd')).toBeNull()
  })
})
