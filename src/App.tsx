import { SchemaManager } from './components/SchemaManager'

function App() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <span className="text-lg font-bold text-slate-900 dark:text-slate-100">TagStrip</span>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <SchemaManager />
      </main>
    </div>
  )
}

export default App
