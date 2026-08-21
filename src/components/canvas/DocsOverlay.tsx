import type { Doc } from '../../db/types'

interface DocsOverlayProps {
  projectName: string
  docs: Doc[]
  currentDocId: string
  onSelectDoc: (docId: string) => void
  onClose: () => void
  onBackToProject: () => void
}

const HINT = 'color-mix(in srgb, var(--color-text) 65%, transparent)'

// An overlay rather than a push: reflowing the canvas to make room would change
// the zoom-to-fit and lose your scroll position mid-document, which is exactly
// what you do not want when you are part-way through annotating a page.
export function DocsOverlay({
  projectName,
  docs,
  currentDocId,
  onSelectDoc,
  onClose,
  onBackToProject,
}: DocsOverlayProps) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        display: 'flex',
        background: 'color-mix(in srgb, #000 42%, transparent)',
      }}
    >
      <div
        role="dialog"
        aria-label="Documents in this project"
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 'none',
          width: 'var(--ts-rail)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg)',
          borderRight: '2px solid var(--color-divider)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '2px solid var(--color-divider)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="ts-eyebrow" style={{ display: 'block' }}>
              {projectName}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: 'color-mix(in srgb, var(--color-text) 62%, transparent)',
              }}
            >
              {docs.length} document{docs.length === 1 ? '' : 's'}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label="Close"
            onClick={onClose}
            style={{ padding: '3px 7px' }}
          >
            ✕
          </button>
        </div>

        <div className="ts-scroll" style={{ flex: 1, minHeight: 0 }}>
          {docs.map((doc, i) => (
            <button
              key={doc.id}
              type="button"
              className="ts-row-btn"
              aria-current={doc.id === currentDocId}
              onClick={() => onSelectDoc(doc.id)}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderBottom: '1px solid var(--color-divider)',
                alignItems: 'flex-start',
              }}
            >
              <span
                className="mono"
                style={{
                  flex: 'none',
                  width: 22,
                  fontSize: 11,
                  paddingTop: 2,
                  color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  className="mono"
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {doc.filename}
                </span>
                <span
                  className="mono"
                  style={{
                    display: 'block',
                    marginTop: 3,
                    fontSize: '10.5px',
                    color: 'color-mix(in srgb, var(--color-text) 58%, transparent)',
                  }}
                >
                  {doc.sourceType === 'image'
                    ? 'image'
                    : `${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'}`}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div
          style={{
            flex: 'none',
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '2px solid var(--color-divider)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-block"
            style={{ margin: 0 }}
            onClick={onBackToProject}
          >
            ← Back to project
          </button>
          <p
            className="mono"
            style={{ margin: 'var(--space-2) 0 0', fontSize: 11, lineHeight: 1.5, color: HINT }}
          >
            Picking a document closes this and keeps you on the canvas. Esc leaves for the project.
          </p>
        </div>
      </div>
    </div>
  )
}
