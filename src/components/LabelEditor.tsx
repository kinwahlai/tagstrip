import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addLabel, removeLabel, SchemaValidationError, updateLabel } from '../db/labelSchemas'
import { ConfirmDialog } from './ConfirmDialog'
import { DEFAULT_LABEL_COLOR, LABEL_COLORS, suggestColor } from '../lib/labelColors'
import { spacesToUnderscores } from '../lib/labelName'
import { formatHotkeyRanges, HOTKEY_OPTIONS } from '../lib/hotkeys'
import { formatWhen } from '../lib/formatDate'
import { useWorkspaceStats } from '../lib/useWorkspaceStats'
import type { Label } from '../db/types'

interface LabelFormState {
  name: string
  color: string
  hotkey: string
}

const EMPTY_FORM: LabelFormState = { name: '', color: DEFAULT_LABEL_COLOR, hotkey: '' }
const HINT = 'color-mix(in srgb, var(--color-text) 68%, transparent)'

function hintStyle() {
  return { margin: '5px 0 0', fontSize: '11px', color: HINT } as const
}

// The add-label form is pinned above the table it feeds. It used to sit below,
// so it drifted further down the page with every label added — the point at
// which you most want to keep adding them (survey finding 5).
export function LabelEditor({ schemaId }: { schemaId: string }) {
  const schema = useLiveQuery(() => db.labelSchemas.get(schemaId), [schemaId])
  const [form, setForm] = useState<LabelFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Label | null>(null)
  const stats = useWorkspaceStats()

  if (schema === undefined) return null
  if (schema === null) return <p style={{ padding: 'var(--space-4)' }}>Schema not found.</p>

  const labelColors = schema.labels.map((l) => l.color)
  const inPalette = LABEL_COLORS.some((c) => c.hex.toUpperCase() === form.color.toUpperCase())
  const swatches = inPalette
    ? LABEL_COLORS
    : [...LABEL_COLORS, { name: 'Current color', hex: form.color }]
  const usedHotkeys = new Set(
    schema.labels
      .filter((l) => l.id !== editingId)
      .map((l) => l.hotkey)
      .filter((k): k is string => Boolean(k)),
  )
  const takenSummary = formatHotkeyRanges([...usedHotkeys])

  // useLiveQuery has not re-rendered with the label we just wrote, so `labelColors`
  // is one render stale — the color just consumed still looks free. Callers that
  // have just spent a color pass it in explicitly.
  function resetForm(alsoUsed?: string) {
    const used = alsoUsed ? [...labelColors, alsoUsed] : labelColors
    setForm({ ...EMPTY_FORM, color: suggestColor(used) })
    setEditingId(null)
    setError(null)
  }

  function startEdit(label: Label) {
    setEditingId(label.id)
    setForm({ name: label.name, color: label.color, hotkey: label.hotkey ?? '' })
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const input = { name: form.name, color: form.color, hotkey: form.hotkey || undefined }
      if (editingId) {
        await updateLabel(schemaId, editingId, input)
      } else {
        await addLabel(schemaId, input)
      }
      resetForm(input.color)
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        setError(err.message)
      } else {
        throw err
      }
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDelete) return
    await removeLabel(schemaId, pendingDelete.id)
    if (editingId === pendingDelete.id) resetForm()
    setPendingDelete(null)
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        style={{
          flex: 'none',
          padding: 'var(--space-4)',
          background: 'var(--color-surface)',
          borderBottom: '2px solid var(--color-divider)',
        }}
      >
        <h3 className="ts-eyebrow" style={{ margin: '0 0 var(--space-3)' }}>
          {editingId ? 'Edit label' : 'Add a label'}
        </h3>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: 'var(--space-4)',
          }}
        >
          <div className="field" style={{ width: 210 }}>
            <label htmlFor="label-name">Name</label>
            <input
              id="label-name"
              className="input mono"
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: spacesToUnderscores(e.target.value) }))
              }
              placeholder="e.g. date_of_birth"
              aria-describedby="label-name-hint"
            />
            <p className="mono" id="label-name-hint" style={hintStyle()}>
              Spaces become underscores
            </p>
          </div>

          <fieldset className="field" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <legend
              style={{
                display: 'block',
                padding: 0,
                fontSize: '12px',
                marginBottom: 5,
                color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              }}
            >
              Colour
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 28px)', gap: 6 }}>
              {swatches.map((c) => {
                const selected = c.hex.toUpperCase() === form.color.toUpperCase()
                return (
                  <label
                    key={c.hex}
                    title={c.name}
                    data-testid="color-option"
                    data-selected={selected}
                    style={{ position: 'relative', cursor: 'pointer' }}
                  >
                    <input
                      className="ts-swatch-radio"
                      type="radio"
                      name="label-color"
                      value={c.hex}
                      checked={selected}
                      onChange={() => setForm((f) => ({ ...f, color: c.hex }))}
                      style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      aria-hidden="true"
                      className="ts-swatch-box"
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 28,
                        height: 28,
                        boxSizing: 'border-box',
                        background: c.hex,
                        border: `2px solid ${
                          selected
                            ? 'var(--color-text)'
                            : 'color-mix(in srgb, #000 20%, transparent)'
                        }`,
                      }}
                    >
                      {selected && (
                        <svg viewBox="0 0 20 20" fill="none" style={{ width: 15, height: 15 }}>
                          <path
                            d="M5 10.5l3.5 3.5L15 7"
                            stroke="#fff"
                            strokeWidth="2.5"
                            strokeLinecap="square"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="sr-only">{c.name}</span>
                  </label>
                )
              })}
            </div>
            <p className="mono" style={hintStyle()}>
              Fixed palette. An imported off-palette hex is added as a 13th swatch.
            </p>
          </fieldset>

          <div className="field" style={{ width: 96 }}>
            <label htmlFor="label-hotkey">Hotkey</label>
            <select
              id="label-hotkey"
              className="input mono"
              value={form.hotkey}
              onChange={(e) => setForm((f) => ({ ...f, hotkey: e.target.value }))}
            >
              <option value="">None</option>
              {HOTKEY_OPTIONS.map((key) => (
                <option
                  key={key}
                  value={key}
                  disabled={usedHotkeys.has(key) && form.hotkey !== key}
                >
                  {key}
                </option>
              ))}
            </select>
            <p className="mono" style={hintStyle()}>
              {takenSummary ? `${takenSummary} taken` : 'None taken'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 21 }}>
            <button type="submit" className="btn btn-primary" style={{ minHeight: 36 }}>
              {editingId ? 'Save label' : 'Add label'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minHeight: 36 }}
                onClick={() => resetForm()}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        {error && (
          <p
            role="alert"
            style={{
              margin: 'var(--space-2) 0 0',
              fontSize: '12.5px',
              color: 'var(--color-accent-700)',
            }}
          >
            {error}
          </p>
        )}
      </form>

      <div className="ts-scroll" style={{ flex: 1, minHeight: 0, padding: '0 var(--space-4)' }}>
        {schema.labels.length === 0 ? (
          <p style={{ padding: 'var(--space-4) 0', fontSize: '12.5px', color: HINT }}>
            No labels yet. Add one above to define a field you'll annotate.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 52 }}>Key</th>
                <th>Name</th>
                <th style={{ width: 190 }}>Colour</th>
                <th style={{ width: 110 }}>Regions</th>
                <th style={{ width: 160 }}>Last used</th>
                <th style={{ width: 130 }}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {schema.labels.map((label) => {
                const paletteName = LABEL_COLORS.find(
                  (c) => c.hex.toUpperCase() === label.color.toUpperCase(),
                )?.name
                const regions = stats.regionsByLabel.get(label.id) ?? 0
                const lastUsed = stats.lastUsedByLabel.get(label.id)
                return (
                  <tr key={label.id}>
                    <td>{label.hotkey && <span className="ts-kbd">{label.hotkey}</span>}</td>
                    <td>
                      <span className="mono" style={{ fontSize: '13.5px', fontWeight: 600 }}>
                        {label.name}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span
                          data-testid="color-swatch"
                          className="ts-swatch"
                          style={{ background: label.color }}
                        />
                        <span className="mono" style={{ fontSize: '11.5px', color: HINT }}>
                          {paletteName ?? label.color.toUpperCase()}
                        </span>
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 13 }}>
                      {regions}
                    </td>
                    <td style={{ fontSize: '12.5px', color: HINT }}>
                      {lastUsed === undefined ? 'never' : formatWhen(lastUsed)}
                    </td>
                    <td>
                      <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => startEdit(label)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setPendingDelete(label)}
                        >
                          Delete
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete label"
          message={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
