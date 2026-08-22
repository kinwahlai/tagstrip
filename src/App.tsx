import { useState } from 'react'
import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { FirstRun } from './components/FirstRun'
import { SchemasOverview } from './components/SchemasOverview'
import { SchemaDetail } from './components/SchemaDetail'
import { ProjectsOverview } from './components/ProjectsOverview'
import { ProjectDetail } from './components/ProjectDetail'
import { AnnotationCanvas } from './components/canvas/AnnotationCanvas'
import { AppShell } from './components/shell/AppShell'
import { Rail } from './components/shell/Rail'
import { MiniRail } from './components/shell/MiniRail'
import { RailOverlay } from './components/shell/RailOverlay'
import { useBreakpoint } from './lib/useBreakpoint'

type View =
  | { tab: 'about' }
  | { tab: 'schemas' }
  | { tab: 'schema'; schemaId: string }
  | { tab: 'projects' }
  | { tab: 'project'; projectId: string }
  | { tab: 'annotate'; projectId: string; docId: string }

function App() {
  const [view, setView] = useState<View>({ tab: 'schemas' })
  const [docsOverlayOpen, setDocsOverlayOpen] = useState(false)
  const [navOverlayOpen, setNavOverlayOpen] = useState(false)
  const breakpoint = useBreakpoint()

  const schemas = useLiveQuery(() => db.labelSchemas.orderBy('updatedAt').reverse().toArray(), [])
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), [])
  // Only queried while annotating: the mini rail steps through the batch and the
  // overlay lists it, both without leaving the canvas.
  const annotateDocs = useLiveQuery(
    () =>
      view.tab === 'annotate'
        ? db.docs.where('projectId').equals(view.projectId).sortBy('createdAt')
        : [],
    [view],
  )

  // Navigating always closes the document overlay. Leaving it open behind you
  // means it reappears over whatever you open next; doing this on the navigation
  // itself, rather than in an effect reacting to the view, avoids a second render
  // pass just to tidy up.
  function goTo(next: View) {
    setDocsOverlayOpen(false)
    setNavOverlayOpen(false)
    setView(next)
  }

  if (schemas === undefined || projects === undefined) return null

  // First run is a property of the data, not a route: with nothing stored there
  // is no schema or project for any other screen to show. A project cannot
  // outlive its schema — deleting one is refused while a project uses it — so no
  // schemas means no projects either.
  const isFirstRun = schemas.length === 0 && projects.length === 0

  const schemaNameById = new Map(schemas.map((s) => [s.id, s.name]))
  const currentSchemaId = view.tab === 'schema' ? view.schemaId : null
  const currentProjectId = view.tab === 'project' || view.tab === 'annotate' ? view.projectId : null
  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null

  const docs = annotateDocs ?? []
  const docIndex = view.tab === 'annotate' ? docs.findIndex((d) => d.id === view.docId) : -1
  const currentDoc = docIndex >= 0 ? docs[docIndex] : null

  function openDocAt(index: number) {
    const doc = docs[index]
    if (doc && view.tab === 'annotate') {
      goTo({ tab: 'annotate', projectId: view.projectId, docId: doc.id })
    }
  }

  // The name appears once, in the breadcrumb; the work surface's own headers name
  // the section instead. It used to be repeated as an h1 or h2 on three screens.
  const crumb: [string, string] = {
    about: ['TagStrip', 'Nothing leaves your browser'] as [string, string],
    schemas: ['All work', 'Label schemas'] as [string, string],
    schema: ['Label schema', schemaNameById.get(currentSchemaId ?? '') ?? ''] as [string, string],
    projects: ['All work', 'Projects'] as [string, string],
    project: ['Project', currentProject?.name ?? ''] as [string, string],
    annotate: [currentProject?.name ?? 'Project', currentDoc?.filename ?? ''] as [string, string],
  }[view.tab]
  const [crumbTop, crumbMain] = isFirstRun ? ['TagStrip', 'Nothing stored yet'] : crumb

  const railInFlow = breakpoint !== 'narrow'
  const fullRail = (
    <Rail
      schemas={schemas}
      projects={projects}
      schemaNameById={schemaNameById}
      atSchemas={view.tab === 'schemas'}
      atProjects={view.tab === 'projects'}
      currentSchemaId={currentSchemaId}
      currentProjectId={currentProjectId}
      onOpenSchemas={() => goTo({ tab: 'schemas' })}
      onOpenProjects={() => goTo({ tab: 'projects' })}
      onOpenSchema={(schemaId) => goTo({ tab: 'schema', schemaId })}
      onOpenProject={(projectId) => goTo({ tab: 'project', projectId })}
    />
  )

  const miniRail = (
    <MiniRail
      docIndex={docIndex + 1}
      docTotal={docs.length}
      overlayOpen={docsOverlayOpen}
      onToggleOverlay={() => setDocsOverlayOpen((open) => !open)}
      onPrevDoc={() => openDocAt(docIndex - 1)}
      onNextDoc={() => openDocAt(docIndex + 1)}
      hasPrev={docIndex > 0}
      hasNext={docIndex >= 0 && docIndex < docs.length - 1}
    />
  )

  // Rail by width: full in the flow while there is room for it, a 56px strip
  // once there is not, and out of the flow entirely below 640 where the strip
  // itself costs more than it returns. Annotate is already at the strip stage
  // at every width, because the canvas always wants the space more.
  let rail: ReactNode = fullRail
  if (view.tab === 'annotate') rail = railInFlow ? miniRail : null
  else if (breakpoint === 'compact') rail = miniRailPlaceholder()
  else if (breakpoint === 'narrow') rail = null

  function miniRailPlaceholder() {
    return (
      <nav
        aria-label="Navigation"
        style={{
          flex: 'none',
          width: 'var(--ts-rail-collapsed)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 'var(--space-2) 0',
          borderRight: '2px solid var(--color-divider)',
        }}
      >
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          aria-label="Show schemas and projects"
          aria-expanded={navOverlayOpen}
          onClick={() => setNavOverlayOpen(true)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </nav>
    )
  }

  return (
    <AppShell
      crumbTop={crumbTop}
      crumbMain={crumbMain}
      stackClaim={breakpoint === 'narrow'}
      onOpenAbout={() => goTo({ tab: 'about' })}
      onOpenNav={
        breakpoint === 'narrow'
          ? view.tab === 'annotate'
            ? () => setDocsOverlayOpen(true)
            : () => setNavOverlayOpen(true)
          : undefined
      }
      navLabel={
        view.tab === 'annotate' ? 'Show documents in this project' : 'Show schemas and projects'
      }
      onCrumbBack={
        view.tab === 'annotate'
          ? () => goTo({ tab: 'project', projectId: view.projectId })
          : undefined
      }
      rail={rail}
    >
      {navOverlayOpen && (
        <RailOverlay onClose={() => setNavOverlayOpen(false)}>{fullRail}</RailOverlay>
      )}
      {(isFirstRun || view.tab === 'about') && (
        <FirstRun
          firstRun={isFirstRun}
          onOpenSchema={(schemaId) => goTo({ tab: 'schema', schemaId })}
          onOpenProject={(projectId) => goTo({ tab: 'project', projectId })}
          onOpenAnnotate={(projectId, docId) => goTo({ tab: 'annotate', projectId, docId })}
        />
      )}
      {!isFirstRun && view.tab === 'schemas' && (
        <SchemasOverview onOpenSchema={(schemaId) => goTo({ tab: 'schema', schemaId })} />
      )}
      {view.tab === 'schema' && (
        <SchemaDetail schemaId={view.schemaId} onDeleted={() => goTo({ tab: 'schemas' })} />
      )}
      {!isFirstRun && view.tab === 'projects' && (
        <ProjectsOverview onOpenProject={(projectId) => goTo({ tab: 'project', projectId })} />
      )}
      {view.tab === 'project' && (
        <ProjectDetail
          projectId={view.projectId}
          onOpenAnnotate={(docId) => goTo({ tab: 'annotate', projectId: view.projectId, docId })}
        />
      )}
      {view.tab === 'annotate' && (
        <AnnotationCanvas
          docId={view.docId}
          onBack={() => goTo({ tab: 'project', projectId: view.projectId })}
          projectName={currentProject?.name ?? 'Project'}
          docs={docs}
          overlayOpen={docsOverlayOpen}
          onCloseOverlay={() => setDocsOverlayOpen(false)}
          onSelectDoc={(docId) => goTo({ tab: 'annotate', projectId: view.projectId, docId })}
        />
      )}
    </AppShell>
  )
}

export default App
