import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { SchemasOverview } from './components/SchemasOverview'
import { SchemaDetail } from './components/SchemaDetail'
import { ProjectManager } from './components/ProjectManager'
import { ProjectView } from './components/ProjectView'
import { AnnotationCanvas } from './components/canvas/AnnotationCanvas'
import { AppShell } from './components/shell/AppShell'

type View =
  | { tab: 'schemas' }
  | { tab: 'schema'; schemaId: string }
  | { tab: 'projects' }
  | { tab: 'project'; projectId: string }
  | { tab: 'annotate'; projectId: string; docId: string }

function App() {
  const [view, setView] = useState<View>({ tab: 'schemas' })

  const schemas = useLiveQuery(() => db.labelSchemas.orderBy('updatedAt').reverse().toArray(), [])
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])
  const annotatedDoc = useLiveQuery(
    () => (view.tab === 'annotate' ? db.docs.get(view.docId) : undefined),
    [view],
  )

  if (schemas === undefined || projects === undefined) return null

  const schemaNameById = new Map(schemas.map((s) => [s.id, s.name]))
  const currentSchemaId = view.tab === 'schema' ? view.schemaId : null
  const currentProjectId = view.tab === 'project' || view.tab === 'annotate' ? view.projectId : null
  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null
  // Screens that still carry their pre-redesign styling scroll as a page inside
  // the surface. Redesigned screens are full-height columns that pin their own
  // header and scroll only their table, so the surface itself must not scroll.
  // R3 retires the last of these.
  const legacyStyling = view.tab === 'projects' || view.tab === 'project'

  // The name appears once, in the breadcrumb; the work surface's own headers name
  // the section instead. It used to be repeated as an h1 or h2 on three screens.
  const crumb: [string, string] = {
    schemas: ['All work', 'Label schemas'] as [string, string],
    schema: ['Label schema', schemaNameById.get(currentSchemaId ?? '') ?? ''] as [string, string],
    projects: ['All work', 'Projects'] as [string, string],
    project: ['Project', currentProject?.name ?? ''] as [string, string],
    annotate: [currentProject?.name ?? 'Project', annotatedDoc?.filename ?? ''] as [string, string],
  }[view.tab]

  return (
    <AppShell
      crumbTop={crumb[0]}
      crumbMain={crumb[1]}
      onCrumbBack={
        view.tab === 'annotate'
          ? () => setView({ tab: 'project', projectId: view.projectId })
          : undefined
      }
      surfaceScrolls={legacyStyling}
      schemas={schemas}
      projects={projects}
      schemaNameById={schemaNameById}
      atSchemas={view.tab === 'schemas'}
      atProjects={view.tab === 'projects'}
      currentSchemaId={currentSchemaId}
      currentProjectId={currentProjectId}
      onOpenSchemas={() => setView({ tab: 'schemas' })}
      onOpenProjects={() => setView({ tab: 'projects' })}
      onOpenSchema={(schemaId) => setView({ tab: 'schema', schemaId })}
      onOpenProject={(projectId) => setView({ tab: 'project', projectId })}
    >
      {view.tab === 'schemas' && (
        <SchemasOverview onOpenSchema={(schemaId) => setView({ tab: 'schema', schemaId })} />
      )}
      {view.tab === 'schema' && (
        <SchemaDetail schemaId={view.schemaId} onDeleted={() => setView({ tab: 'schemas' })} />
      )}
      {view.tab === 'annotate' && (
        <AnnotationCanvas
          docId={view.docId}
          onBack={() => setView({ tab: 'project', projectId: view.projectId })}
        />
      )}
      {legacyStyling && (
        <div style={{ padding: 'var(--space-6)' }}>
          {view.tab === 'projects' && (
            <ProjectManager onOpenProject={(projectId) => setView({ tab: 'project', projectId })} />
          )}
          {view.tab === 'project' && (
            <ProjectView
              projectId={view.projectId}
              onBack={() => setView({ tab: 'projects' })}
              onOpenAnnotate={(docId) =>
                setView({ tab: 'annotate', projectId: view.projectId, docId })
              }
            />
          )}
        </div>
      )}
    </AppShell>
  )
}

export default App
