import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addLabel, removeLabel, SchemaValidationError, updateLabel } from '../db/labelSchemas'
import { ConfirmDialog } from './ConfirmDialog'
import type { Label } from '../db/types'

const DEFAULT_COLOR = '#6366f1'
const HOTKEY_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

interface LabelFormState {
  name: string
  color: string
  hotkey: string
}

const EMPTY_FORM: LabelFormState = { name: '', color: DEFAULT_COLOR, hotkey: '' }

export function LabelEditor({ schemaId }: { schemaId: string }) {
  const schema = useLiveQuery(() => db.labelSchemas.get(schemaId), [schemaId])
  const [form, setForm] = useState<LabelFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Label | null>(null)

  if (schema === undefined) return null
  if (schema === null) return <p className="text-sm text-slate-500">Schema not found.</p>

  const usedHotkeys = new Set(
    schema.labels
      .filter((l) => l.id !== editingId)
      .map((l) => l.hotkey)
      .filter(Boolean),
  )

  function resetForm() {
    setForm(EMPTY_FORM)
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
      resetForm()
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
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. date_of_birth"
            className="mt-1 w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="label-color"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Color
          </label>
          <input
            id="label-color"
            type="color"
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="mt-1 h-9 w-16 cursor-pointer rounded-md border border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-600"
          />
        </div>
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
            onClick={resetForm}
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
