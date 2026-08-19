import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../db/db'
import { addLabel, createSchema } from '../db/labelSchemas'
import { HOTKEY_OPTIONS } from '../lib/hotkeys'
import { LABEL_COLORS } from '../lib/labelColors'
import { LabelEditor } from './LabelEditor'

let schemaId: string

beforeEach(async () => {
  await db.labelSchemas.clear()
  schemaId = await createSchema('Test schema')
})

async function renderEditor() {
  render(<LabelEditor schemaId={schemaId} />)
  await screen.findByLabelText('Name')
}

describe('LabelEditor color palette', () => {
  it('offers the palette as swatches instead of an OS color picker', async () => {
    await renderEditor()
    expect(document.querySelector('input[type="color"]')).toBeNull()
    expect(screen.getAllByTestId('color-option')).toHaveLength(LABEL_COLORS.length)
  })

  it('selects a color by clicking its swatch', async () => {
    await renderEditor()

    fireEvent.click(screen.getByRole('radio', { name: 'Teal' }))
    expect(screen.getByRole('radio', { name: 'Teal' })).toBeChecked()
  })

  it('saves the chosen palette color on the label', async () => {
    await renderEditor()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'invoice_total' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Purple' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }))

    await waitFor(async () => {
      const schema = await db.labelSchemas.get(schemaId)
      expect(schema?.labels[0]).toMatchObject({
        name: 'invoice_total',
        color: LABEL_COLORS.find((c) => c.name === 'Purple')!.hex,
      })
    })
  })

  it('gives successive labels different colors when the swatches are never touched', async () => {
    // Regression: resetForm read a one-render-stale color list, so the color just
    // consumed still looked free and labels 1 and 2 both came out red.
    await renderEditor()
    for (const name of ['one', 'two', 'three']) {
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
      fireEvent.click(screen.getByRole('button', { name: 'Add label' }))
      await waitFor(async () => {
        const schema = await db.labelSchemas.get(schemaId)
        expect(schema?.labels.some((l) => l.name === name)).toBe(true)
      })
    }
    const schema = await db.labelSchemas.get(schemaId)
    const colors = schema!.labels.map((l) => l.color)
    expect(new Set(colors).size).toBe(3)
  })

  it('shows an extra swatch for an imported color outside the palette', async () => {
    await addLabel(schemaId, { name: 'legacy', color: '#123456' })
    await renderEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(screen.getAllByTestId('color-option')).toHaveLength(LABEL_COLORS.length + 1)
    expect(screen.getByRole('radio', { name: 'Current color' })).toBeChecked()
  })
})

describe('LabelEditor name field', () => {
  it('converts spaces to underscores as you type', async () => {
    await renderEditor()

    const name = screen.getByLabelText('Name')
    fireEvent.change(name, { target: { value: 'date of birth' } })
    expect(name).toHaveValue('date_of_birth')
  })

  it('stores the underscored name', async () => {
    await renderEditor()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'place of issue' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }))

    await waitFor(async () => {
      const schema = await db.labelSchemas.get(schemaId)
      expect(schema?.labels[0].name).toBe('place_of_issue')
    })
  })
})

describe('LabelEditor hotkey picker', () => {
  it('offers 0 alongside 1-9', async () => {
    await renderEditor()
    const options = [...screen.getByLabelText('Hotkey').querySelectorAll('option')]
      .map((o) => o.value)
      .filter(Boolean)
    expect(options).toEqual(HOTKEY_OPTIONS)
    expect(options).toContain('0')
  })

  it('assigns 0 as a hotkey and persists it', async () => {
    await renderEditor()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'other' } })
    fireEvent.change(screen.getByLabelText('Hotkey'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }))

    await waitFor(async () => {
      const schema = await db.labelSchemas.get(schemaId)
      expect(schema?.labels[0].hotkey).toBe('0')
    })
  })
})
