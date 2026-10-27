// Dev-only harness (harness/predict.html): runs LFM2.5-VL-450M once per page over a list of
// pages, asking for the page's labelled fields with their boxes, and shows per field an id, the
// box verdict with its IoU and the value verdict, plus the time per page. It never renders or
// logs predicted values, transcriptions, label values or filenames; results are also exposed as
// JSON in window.__predictResults under the same rule.
import { backendInfo, configureLocalRuntime, loadModel, predictFields } from '../lib/predict/lfmVl'
import type { BackendInfo } from '../lib/predict/lfmVl'
import { scoreField, summarise } from '../lib/predict/score'
import type { Box, FieldBox, FieldResult, PredictSummary } from '../lib/predict/score'
import { parseNativeExport } from '../lib/nativeImport'
import { loadPdfDocument, renderPageToBlob } from '../lib/pdf'

interface PageItem {
  image: () => Promise<Blob>
  truth: FieldBox[]
}

interface PageRecord {
  page: string // p001... never the filename
  ms: number
  fields: FieldResult[]
}

interface RunRecord {
  run: number
  summary: PredictSummary
  pages: PageRecord[]
  skipped: number
}

interface Store {
  set: string
  predictions: string
  adapter: BackendInfo | null
  runs: RunRecord[]
}

declare global {
  interface Window {
    __predictResults?: Store
  }
}

const DOC_EXT = /\.(pdf|png|jpe?g|webp)$/i
const FIXTURE_BASE = '/test-fixtures/predict-fields/'

class HarnessInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HarnessInputError'
  }
}

const root = document.getElementById('harness-root')!

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}

function labelled(text: string, control: HTMLElement): HTMLLabelElement {
  return el('label', {}, text + ' ', control)
}

const setSelect = el(
  'select',
  { id: 'set', ariaLabel: 'Set' },
  el('option', { value: 'synthetic', textContent: 'synthetic' }),
  el('option', { value: 'eval', textContent: 'eval' }),
)
// 'truth' and 'shifted' replace the model's output with the ground truth itself (or with every
// box moved by half its width) so the scorer can be checked without the model (check M1-3).
const predictionsSelect = el(
  'select',
  { id: 'predictions', ariaLabel: 'Predictions' },
  el('option', { value: 'model', textContent: 'model' }),
  el('option', { value: 'truth', textContent: 'truth' }),
  el('option', { value: 'shifted', textContent: 'shifted' }),
)
const exportInput = el('input', {
  type: 'file',
  id: 'eval-export',
  ariaLabel: 'Export JSON',
  accept: '.json,application/json',
})
const docsInput = el('input', {
  type: 'file',
  id: 'eval-docs',
  ariaLabel: 'Source documents',
  multiple: true,
})
const evalBox = el(
  'div',
  { hidden: true },
  labelled('Export JSON', exportInput),
  el('br'),
  labelled('Source documents', docsInput),
)
const runButton = el('button', { type: 'button', textContent: 'Run' })
const status = el('p', { id: 'status', textContent: 'idle' })
status.dataset.state = 'idle'
const adapterLine = el('p', { id: 'adapter' })
const results = el('div', { id: 'results' })

root.append(
  labelled('Set', setSelect),
  el('br'),
  labelled('Predictions', predictionsSelect),
  el('br'),
  evalBox,
  runButton,
  status,
  adapterLine,
  results,
)

type State = 'idle' | 'loading' | 'running' | 'done' | 'error'

function setStatus(state: State, detail = '', errorName = ''): void {
  status.dataset.state = state
  if (errorName) status.dataset.error = errorName
  else delete status.dataset.error
  status.textContent = detail ? `${state}: ${detail}` : state
}

let store: Store = { set: setSelect.value, predictions: 'model', adapter: null, runs: [] }
window.__predictResults = store

function resetStore(): void {
  store = { set: setSelect.value, predictions: predictionsSelect.value, adapter: null, runs: [] }
  window.__predictResults = store
  results.replaceChildren()
  adapterLine.textContent = ''
  setStatus('idle')
}

setSelect.addEventListener('change', () => {
  evalBox.hidden = setSelect.value !== 'eval'
  resetStore()
})
predictionsSelect.addEventListener('change', resetStore)

async function syntheticPages(): Promise<PageItem[]> {
  const res = await fetch(`${FIXTURE_BASE}expected.json`)
  if (!res.ok) throw new HarnessInputError('synthetic fixture missing')
  const list = (await res.json()) as { page: string; fields: FieldBox[] }[]
  return list.map((p) => ({
    truth: p.fields,
    image: async () => {
      const r = await fetch(FIXTURE_BASE + p.page)
      if (!r.ok) throw new HarnessInputError('synthetic page missing')
      return r.blob()
    },
  }))
}

// One item per page that has at least one annotated region; the fields asked for are that
// page's label names. Documents are matched to the export by exact filename.
async function evalPages(): Promise<{ pages: PageItem[]; skipped: number }> {
  const exportFile = exportInput.files?.[0]
  const docFiles = Array.from(docsInput.files ?? [])
  if (!exportFile || docFiles.length === 0) throw new HarnessInputError('eval inputs missing')
  let parsed
  try {
    parsed = parseNativeExport(JSON.parse(await exportFile.text()))
  } catch {
    throw new HarnessInputError('export not readable')
  }
  const labelName = new Map(parsed.labelSchema.labels.map((l) => [l.id, l.name]))
  const byName = new Map(docFiles.map((f) => [f.name, f]))
  const pages: PageItem[] = []
  let skipped = 0
  for (const doc of parsed.documents) {
    const file = byName.get(doc.filename)
    if (!file || !DOC_EXT.test(file.name)) {
      skipped += doc.annotations.length
      continue
    }
    const byPage = new Map<number, FieldBox[]>()
    for (const a of doc.annotations) {
      const label = labelName.get(a.labelId)
      if (label === undefined) continue
      const box: Box = [a.x, a.y, a.x + a.width, a.y + a.height]
      const list = byPage.get(a.pageIndex) ?? []
      list.push({ label, value: a.text ?? '', bbox: box })
      byPage.set(a.pageIndex, list)
    }
    let pdf: ReturnType<typeof loadPdfDocument> | null = null
    for (const pageIndex of [...byPage.keys()].sort((x, y) => x - y)) {
      pages.push({
        truth: byPage.get(pageIndex)!,
        image: async () => {
          if (doc.sourceType === 'pdf') {
            pdf ??= loadPdfDocument(file)
            return (await renderPageToBlob(await pdf, pageIndex + 1)).blob
          }
          return file as Blob
        },
      })
    }
  }
  return { pages, skipped }
}

function oracle(truth: FieldBox[], mode: string): FieldBox[] {
  if (mode === 'truth') return truth
  return truth.map((t) => {
    const w = t.bbox[2] - t.bbox[0]
    const dx = t.bbox[2] + w / 2 > 1 ? -w / 2 : w / 2
    return { ...t, bbox: [t.bbox[0] + dx, t.bbox[1], t.bbox[2] + dx, t.bbox[3]] as Box }
  })
}

function renderResults(rec: RunRecord): void {
  const s = rec.summary
  const rows: HTMLTableRowElement[] = []
  for (const p of rec.pages) {
    rows.push(
      el(
        'tr',
        {},
        el('td', { textContent: p.page }),
        el('td', { colSpan: 3, textContent: `page time ${(p.ms / 1000).toFixed(2)} s` }),
      ),
    )
    for (const f of p.fields) {
      rows.push(
        el(
          'tr',
          {},
          el('td', { textContent: f.id }),
          el('td', { textContent: f.box }),
          el('td', { textContent: f.iou.toFixed(2) }),
          el('td', { textContent: f.value }),
        ),
      )
    }
  }
  const table = el(
    'table',
    {},
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        el('th', { textContent: 'id' }),
        el('th', { textContent: 'box' }),
        el('th', { textContent: 'IoU' }),
        el('th', { textContent: 'value' }),
      ),
    ),
    el('tbody', {}, ...rows),
  )
  const summary = el('p', { id: 'summary' })
  summary.textContent =
    `run ${rec.run}: fields ${s.total}, box hits ${s.boxHits}, match ${s.match}, wrong ${s.wrong}, ` +
    `blank ${s.blank}, median s/page ${(s.medianMs / 1000).toFixed(2)}, skipped ${rec.skipped}`
  results.replaceChildren(summary, table)
}

async function run(): Promise<void> {
  const mode = predictionsSelect.value
  runButton.disabled = true
  setStatus('loading')
  try {
    let pages: PageItem[]
    let skipped = 0
    if (setSelect.value === 'synthetic') pages = await syntheticPages()
    else ({ pages, skipped } = await evalPages())
    if (pages.length === 0) throw new HarnessInputError('no pages to score')
    store.adapter = await backendInfo()
    const a = store.adapter
    adapterLine.textContent =
      `webgpu ${a.webgpu}, vendor ${a.vendor ?? '?'}, architecture ${a.architecture ?? '?'}, ` +
      `fallback ${a.isFallbackAdapter ?? '?'}`
    if (mode === 'model') {
      configureLocalRuntime()
      await loadModel()
      // Untimed warm-up on the first page: the first generate compiles WebGPU kernels.
      await predictFields(await pages[0].image(), [...new Set(pages[0].truth.map((t) => t.label))])
    }
    setStatus('running')
    const records: PageRecord[] = []
    const all: FieldResult[] = []
    let seq = 0
    for (let i = 0; i < pages.length; i++) {
      const item = pages[i]
      const asked = [...new Set(item.truth.map((t) => t.label))]
      let predicted: FieldBox[]
      let ms = 0
      if (mode === 'model') {
        const image = await item.image()
        const t0 = performance.now()
        predicted = await predictFields(image, asked)
        ms = performance.now() - t0
      } else {
        predicted = oracle(item.truth, mode)
      }
      // Predicted values go straight into the scorer; they are not stored, rendered or logged.
      const fields = item.truth.map((t) => {
        seq++
        return scoreField(t, predicted, `f${String(seq).padStart(3, '0')}`)
      })
      all.push(...fields)
      records.push({ page: `p${String(i + 1).padStart(3, '0')}`, ms, fields })
    }
    const rec: RunRecord = {
      run: store.runs.length + 1,
      summary: summarise(
        all,
        records.map((r) => r.ms),
      ),
      pages: records,
      skipped,
    }
    store.runs.push(rec)
    renderResults(rec)
    setStatus('done')
  } catch (e) {
    // Only a generic message is shown: raw error text could carry a filename or a value.
    results.replaceChildren()
    const name = e instanceof Error ? e.name : 'unknown'
    setStatus('error', e instanceof HarnessInputError ? e.message : 'run failed', name)
  } finally {
    runButton.disabled = false
  }
}

runButton.addEventListener('click', () => void run())
