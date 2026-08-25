import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../db/db'
import { addLabel, createSchema } from '../db/labelSchemas'
import { HOTKEY_OPTIONS } from '../lib/hotkeys'
import { colorForIndex, LABEL_COLORS } from '../lib/labelColors'
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

async function addNamed(name: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Add label' }))
  await waitFor(async () => {
    const schema = await db.labelSchemas.get(schemaId)
    expect(schema?.labels.some((l) => l.name === name)).toBe(true)
  })
}

async function startEditingFirstLabel() {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0])
  await screen.findByRole('button', { name: 'Save label' })
}

describe('LabelEditor add form', () => {
  it('asks only for a name', async () => {
    await renderEditor()
    expect(screen.queryAllByTestId('color-option')).toHaveLength(0)
    expect(screen.queryByLabelText('Hotkey')).toBeNull()
    expect(document.querySelector('input[type="color"]')).toBeNull()
  })

  it('assigns a colour and a mnemonic hotkey without being asked', async () => {
    await renderEditor()
    await addNamed('date_of_birth')

    const schema = await db.labelSchemas.get(schemaId)
    expect(schema?.labels[0]).toMatchObject({
      name: 'date_of_birth',
      color: colorForIndex(0),
      hotkey: 'd',
    })
  })

  it('gives successive labels distinct colours and distinct hotkeys', async () => {
    await renderEditor()
    for (const name of ['one', 'two', 'three']) await addNamed(name)

    const schema = await db.labelSchemas.get(schemaId)
    const labels = schema!.labels
    expect(new Set(labels.map((l) => l.color)).size).toBe(3)
    expect(labels.map((l) => l.hotkey)).toEqual(['o', 't', 'h'])
  })
})

describe('LabelEditor edit form', () => {
  it('offers the palette as swatches and a colour wheel for anything else', async () => {
    await addLabel(schemaId, { name: 'legacy', color: LABEL_COLORS[0].hex })
    await renderEditor()
    await startEditingFirstLabel()

    expect(screen.getAllByTestId('color-option')).toHaveLength(LABEL_COLORS.length)
    expect(screen.getByLabelText('Custom colour')).toHaveAttribute('type', 'color')
  })

  it('saves a palette colour chosen by swatch', async () => {
    await addLabel(schemaId, { name: 'invoice_total', color: LABEL_COLORS[0].hex })
    await renderEditor()
    await startEditingFirstLabel()

    fireEvent.click(screen.getByRole('radio', { name: 'Purple' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save label' }))

    await waitFor(async () => {
      const schema = await db.labelSchemas.get(schemaId)
      expect(schema?.labels[0].color).toBe(LABEL_COLORS.find((c) => c.name === 'Purple')!.hex)
    })
  })

  it('saves an off-palette colour chosen with the wheel', async () => {
    await addLabel(schemaId, { name: 'invoice_total', color: LABEL_COLORS[0].hex })
    await renderEditor()
    await startEditingFirstLabel()

    fireEvent.change(screen.getByLabelText('Custom colour'), { target: { value: '#123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save label' }))

    await waitFor(async () => {
      const schema = await db.labelSchemas.get(schemaId)
      expect(schema?.labels[0].color).toBe('#123456')
    })
  })

  it('warns when a wheel colour is too light for white tag text', async () => {
    await addLabel(schemaId, { name: 'invoice_total', color: LABEL_COLORS[0].hex })
    await renderEditor()
    await startEditingFirstLabel()

    expect(screen.queryByTestId('contrast-warning')).toBeNull()
    fireEvent.change(screen.getByLabelText('Custom colour'), { target: { value: '#ffff00' } })
    expect(screen.getByTestId('contrast-warning')).toBeInTheDocument()
  })

  it('shows an extra swatch for an imported colour outside the palette', async () => {
    await addLabel(schemaId, { name: 'legacy', color: '#123456' })
    await renderEditor()
    await startEditingFirstLabel()

    expect(screen.getAllByTestId('color-option')).toHaveLength(LABEL_COLORS.length + 1)
    expect(screen.getByRole('radio', { name: 'Current color' })).toBeChecked()
  })

  it('offers every hotkey option, letters and digits alike', async () => {
    await addLabel(schemaId, { name: 'legacy', color: LABEL_COLORS[0].hex })
    await renderEditor()
    await startEditingFirstLabel()

    const options = [...screen.getByLabelText('Hotkey').querySelectorAll('option')]
      .map((o) => o.value)
      .filter(Boolean)
    expect(options).toEqual(HOTKEY_OPTIONS)
  })

  it('changes an auto-assigned hotkey and persists it', async () => {
    await renderEditor()
    await addNamed('other')
    await startEditingFirstLabel()

    fireEvent.change(screen.getByLabelText('Hotkey'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save label' }))

    await waitFor(async () => {
      const schema = await db.labelSchemas.get(schemaId)
      expect(schema?.labels[0].hotkey).toBe('0')
    })
  })

  it('clears a hotkey back to none', async () => {
    await renderEditor()
    await addNamed('other')
    await startEditingFirstLabel()

    fireEvent.change(screen.getByLabelText('Hotkey'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save label' }))

    await waitFor(async () => {
      const schema = await db.labelSchemas.get(schemaId)
      expect(schema?.labels[0].hotkey).toBeUndefined()
    })
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
    await addNamed('place_of_issue')

    const schema = await db.labelSchemas.get(schemaId)
    expect(schema?.labels[0].name).toBe('place_of_issue')
  })
})
