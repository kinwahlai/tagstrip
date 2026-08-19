import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addLabel, removeLabel, SchemaValidationError, updateLabel } from '../db/labelSchemas'
import { ConfirmDialog } from './ConfirmDialog'
import { DEFAULT_LABEL_COLOR, LABEL_COLORS, suggestColor } from '../lib/labelColors'
import { spacesToUnderscores } from '../lib/labelName'
import { HOTKEY_OPTIONS } from '../lib/hotkeys'
import type { Label } from '../db/types'

interface LabelFormState {
  name: string
  color: string
  hotkey: string
}

const EMPTY_FORM: LabelFormState = { name: '', color: DEFAULT_LABEL_COLOR, hotkey: '' }

export function LabelEditor({ schemaId }: { schemaId: string }) {
  const schema = useLiveQuery(() => db.labelSchemas.get(schemaId), [schemaId])
  const [form, setForm] = useState<LabelFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Label | null>(null)

  if (schema === undefined) return null
  if (schema === null) return <p className="text-sm text-slate-500">Schema not found.</p>

  const labelColors = schema.labels.map((l) => l.color)
  const inPalette = LABEL_COLORS.some((c) => c.hex.toUpperCase() === form.color.toUpperCase())
  const swatches = inPalette
    ? LABEL_COLORS
    : [...LABEL_COLORS, { name: 'Current color', hex: form.color }]
  const usedHotkeys = new Set(
    schema.labels
      .filter((l) => l.id !== editingId)
      .map((l) => l.hotkey)
      .filter(Boolean),
  )

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
    <div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{schema.name}</h2>

      {schema.labels.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          No labels yet. Add one below.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {schema.labels.map((label) => (
            <li key={label.id} className="flex items-center gap-3 px-3 py-2">
              <span
                data-testid="color-swatch"
                className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: label.color }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                {label.name}
              </span>
              {label.hotkey && (
                <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {label.hotkey}
                </kbd>
              )}
              <button
                type="button"
                onClick={() => startEdit(label)}
                className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-950"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(label)}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="label-name"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Name
          </label>
          <input
            id="label-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: spacesToUnderscores(e.target.value) }))}
            placeholder="e.g. date_of_birth"
            aria-describedby="label-name-hint"
            className="mt-1 w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <p id="label-name-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Spaces become underscores
          </p>
        </div>
        <fieldset>
          <legend className="text-xs font-medium text-slate-600 dark:text-slate-300">Color</legend>
          <div className="mt-1 grid grid-cols-6 gap-1.5">
            {swatches.map((c) => {
              const selected = c.hex.toUpperCase() === form.color.toUpperCase()
              return (
                <label
                  key={c.hex}
                  title={c.name}
                  className="cursor-pointer"
                  data-testid="color-option"
                  data-selected={selected}
                >
                  <input
                    type="radio"
                    name="label-color"
                    value={c.hex}
                    checked={selected}
                    onChange={() => setForm((f) => ({ ...f, color: c.hex }))}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: c.hex }}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-black/20 ring-offset-1 peer-checked:ring-2 peer-checked:ring-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 dark:ring-offset-slate-900 dark:peer-checked:ring-slate-100"
                  >
                    {selected && (
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <path
                          d="M5 10.5l3.5 3.5L15 7"
                          stroke="white"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="sr-only">{c.name}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
        <div>
          <label
            htmlFor="label-hotkey"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Hotkey
          </label>
          <select
            id="label-hotkey"
            value={form.hotkey}
            onChange={(e) => setForm((f) => ({ ...f, hotkey: e.target.value }))}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">None</option>
            {HOTKEY_OPTIONS.map((key) => (
              <option key={key} value={key} disabled={usedHotkeys.has(key) && form.hotkey !== key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="whitespace-nowrap rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          {editingId ? 'Save label' : 'Add label'}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={() => resetForm()}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete label"
          message={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
