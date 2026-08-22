import { useState } from 'react'
import { formatBytes } from '../../lib/formatBytes'
import { useDiskUsage } from '../../lib/useWorkspaceStats'
import type { LabelSchema, Project } from '../../db/types'

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

interface RailProps {
  schemas: LabelSchema[]
  projects: Project[]
  schemaNameById: Map<string, string>
  atSchemas: boolean
  atProjects: boolean
  currentSchemaId: string | null
  currentProjectId: string | null
  onOpenSchemas: () => void
  onOpenProjects: () => void
  onOpenSchema: (schemaId: string) => void
  onOpenProject: (projectId: string) => void
}

function Chevron() {
  return (
    <svg
      className="ts-grouphd-c"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

// Schemas and projects sit in one rail as things you pick, not modes you switch
// into — so the old top-level Schemas/Projects tabs are gone. The group headers
// carry the count that made them look clickable, so they are the route to each
// overview; a rail *item* being current means neither header is.
export function Rail({
  schemas: allSchemas,
  projects: allProjects,
  schemaNameById,
  atSchemas,
  atProjects,
  currentSchemaId,
  currentProjectId,
  onOpenSchemas,
  onOpenProjects,
  onOpenSchema,
  onOpenProject,
}: RailProps) {
  const [find, setFind] = useState('')
  const diskBytes = useDiskUsage()

  const needle = find.trim().toLowerCase()
  const match = (name: string) => name.toLowerCase().includes(needle)
  const schemas = needle ? allSchemas.filter((s) => match(s.name)) : allSchemas
  const projects = needle ? allProjects.filter((p) => match(p.name)) : allProjects

  return (
    <nav
      aria-label="Schemas and projects"
      style={{
        flex: 'none',
        width: 'var(--ts-rail)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '2px solid var(--color-divider)',
      }}
    >
      <div
        style={{
          flex: 'none',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '2px solid var(--color-divider)',
        }}
      >
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="rail-find">Find</label>
          <input
            id="rail-find"
            className="input"
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="schema or project"
            style={{ fontSize: 13 }}
          />
        </div>
      </div>

      <div className="ts-scroll" style={{ flex: 1, minHeight: 0 }}>
        <h2
          style={{
            margin: 0,
            borderBottom: '1px solid var(--color-divider)',
            fontSize: 'inherit',
          }}
        >
          <button
            type="button"
            className="ts-grouphd"
            aria-current={atSchemas}
            onClick={onOpenSchemas}
          >
            <span>Label schemas</span>
            <span className="ts-grouphd-n">{allSchemas.length}</span>
            <Chevron />
          </button>
        </h2>
        {schemas.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 'var(--space-3) var(--space-4)',
              fontSize: '12.5px',
              color: 'color-mix(in srgb, var(--color-text) 62%, transparent)',
            }}
          >
            {needle
              ? `No label schema matches "${find.trim()}".`
              : "No label schemas yet. Create one to define the fields you'll annotate."}
          </p>
        ) : (
          schemas.map((schema) => (
            <button
              key={schema.id}
              type="button"
              className="ts-row-btn"
              aria-current={currentSchemaId === schema.id}
              onClick={() => onOpenSchema(schema.id)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                aria-hidden="true"
                style={{ flex: 'none', opacity: 0.6 }}
              >
                <path d="M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4" />
              </svg>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '13.5px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {schema.name}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: MUTED }}>
                  Schema · {schema.labels.length} label{schema.labels.length === 1 ? '' : 's'}
                </span>
              </span>
            </button>
          ))
        )}

        <h2
          style={{
            margin: 'var(--space-3) 0 0',
            borderTop: '2px solid var(--color-divider)',
            borderBottom: '1px solid var(--color-divider)',
            fontSize: 'inherit',
          }}
        >
          <button
            type="button"
            className="ts-grouphd"
            aria-current={atProjects}
            onClick={onOpenProjects}
          >
            <span>Projects</span>
            <span className="ts-grouphd-n">{allProjects.length}</span>
            <Chevron />
          </button>
        </h2>
        {projects.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 'var(--space-3) var(--space-4)',
              fontSize: '12.5px',
              color: 'color-mix(in srgb, var(--color-text) 62%, transparent)',
            }}
          >
            {needle
              ? `No project matches "${find.trim()}".`
              : 'No projects yet. Create one to start uploading documents.'}
          </p>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className="ts-row-btn"
              aria-current={currentProjectId === project.id}
              onClick={() => onOpenProject(project.id)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                aria-hidden="true"
                style={{ flex: 'none', opacity: 0.6 }}
              >
                <path d="M3 7h6l2 2h10v10H3z" />
              </svg>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {project.name}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: MUTED }}>
                  Project · {schemaNameById.get(project.schemaId) ?? 'unknown schema'}
                </span>
              </span>
            </button>
          ))
        )}
      </div>

      <div
        style={{
          flex: 'none',
          padding: 'var(--space-3) var(--space-4)',
          borderTop: '2px solid var(--color-divider)',
        }}
      >
        <span className="ts-eyebrow" style={{ display: 'block', marginBottom: 2 }}>
          Where this lives
        </span>
        <span
          className="mono"
          style={{
            fontSize: '11px',
            lineHeight: 1.5,
            display: 'block',
            color: 'color-mix(in srgb, var(--color-text) 68%, transparent)',
          }}
        >
          IndexedDB · this browser profile
          {diskBytes !== null && (
            <>
              <br />
              {formatBytes(diskBytes)} on your disk
            </>
          )}
        </span>
      </div>
    </nav>
  )
}
