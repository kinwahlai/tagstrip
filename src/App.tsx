import { useState } from 'react'
import { SchemaManager } from './components/SchemaManager'
import { ProjectManager } from './components/ProjectManager'
import { ProjectView } from './components/ProjectView'
import { AnnotationCanvas } from './components/canvas/AnnotationCanvas'

type View =
  | { tab: 'schemas' }
  | { tab: 'projects' }
  | { tab: 'project'; projectId: string }
  | { tab: 'annotate'; projectId: string; docId: string }

function App() {
  const [view, setView] = useState<View>({ tab: 'schemas' })
  const topTab = view.tab === 'schemas' ? 'schemas' : 'projects'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center gap-6 border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-800">
        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">TagStrip</span>
        <nav className="flex gap-4">
          <button
            type="button"
            onClick={() => setView({ tab: 'schemas' })}
            className={`text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
              topTab === 'schemas'
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
            }`}
          >
            Schemas
          </button>
          <button
            type="button"
            onClick={() => setView({ tab: 'projects' })}
            className={`text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
              topTab === 'projects'
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
            }`}
          >
            Projects
          </button>
        </nav>
      </header>
      <main className={view.tab === 'annotate' ? '' : 'mx-auto max-w-5xl px-4 py-8 sm:px-6'}>
        {view.tab === 'schemas' && <SchemaManager />}
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
        {view.tab === 'annotate' && (
          <AnnotationCanvas
            docId={view.docId}
            onBack={() => setView({ tab: 'project', projectId: view.projectId })}
          />
        )}
      </main>
    </div>
  )
}

export default App
