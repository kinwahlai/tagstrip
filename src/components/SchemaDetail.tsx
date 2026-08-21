import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { deleteSchema, renameSchema, SchemaValidationError } from '../db/labelSchemas'
import { exportSchemaToFile } from '../lib/schemaExport'
import { ConfirmDialog } from './ConfirmDialog'
import { RenameDialog } from './RenameDialog'
import { LabelEditor } from './LabelEditor'
import { SurfaceHeader } from './shell/SurfaceHeader'

interface SchemaDetailProps {
  schemaId: string
  onDeleted: () => void
}

// The surface header names the *section* — "Labels · 6" — not the schema. The
// schema's name is in the breadcrumb, once (survey finding 1).
export function SchemaDetail({ schemaId, onDeleted }: SchemaDetailProps) {
  const schema = useLiveQuery(() => db.labelSchemas.get(schemaId), [schemaId])
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (schema === undefined) return null
  if (schema === null) return <p style={{ padding: 'var(--space-4)' }}>Schema not found.</p>

  async function handleRename(name: string) {
    setError(null)
    try {
      await renameSchema(schemaId, name)
      setRenaming(false)
    } catch (err) {
      if (err instanceof SchemaValidationError) setError(err.message)
      else throw err
    }
  }

  async function handleDelete() {
    setError(null)
    setConfirmingDelete(false)
    try {
      await deleteSchema(schemaId)
      onDeleted()
    } catch (err) {
      if (err instanceof SchemaValidationError) setError(err.message)
      else throw err
    }
  }

  return (
    <>
      <SurfaceHeader
        title={`Labels · ${schema.labels.length}`}
        error={error}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportSchemaToFile(schemaId)}
            >
              Export
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setRenaming(true)}>
              Rename
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </button>
          </>
        }
      />

      <LabelEditor schemaId={schemaId} />

      {renaming && (
        <RenameDialog
          title="Rename schema"
          label="Schema name"
          initialValue={schema.name}
          error={error}
          onSubmit={handleRename}
          onCancel={() => {
            setRenaming(false)
            setError(null)
          }}
        />
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title="Delete schema"
          message={`Delete "${schema.name}" and all its labels? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  )
}
