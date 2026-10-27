// Dev-only harness (harness/ocr.html): runs one OCR engine over a list of crops and shows, per
// region, an id, a verdict and a time. It never renders or logs OCR text, transcriptions or
// filenames; results are also exposed as JSON in window.__ocrResults for the driver, under the
// same rule.
import { tesseractEngine } from '../lib/ocr/tesseract'
import type { OcrEngine } from '../lib/ocr/types'
import { summarise, verdict } from '../lib/ocrEval/score'
import type { RegionResult, Summary } from '../lib/ocrEval/score'
import { parseNativeExport } from '../lib/nativeImport'
import { loadPdfDocument, renderPageToBlob } from '../lib/pdf'
import { cropPageRegion } from '../lib/ocrCrop'

interface Item {
  id: string
  crop: () => Promise<Blob>
  expected: string
}

interface RunRecord {
  run: number
  summary: Summary
  regions: RegionResult[]
  skipped: number
}

declare global {
  interface Window {
    __ocrResults?: { engine: string; set: string; runs: RunRecord[] }
  }
}

const ENGINES: Record<string, OcrEngine> = { tesseract: tesseractEngine }
const DOC_EXT = /\.(pdf|png|jpe?g|webp)$/i

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

const engineSelect = el(
  'select',
  { id: 'engine', ariaLabel: 'Engine' },
  el('option', { value: 'tesseract', textContent: 'tesseract' }),
)
const setSelect = el(
  'select',
  { id: 'set', ariaLabel: 'Set' },
  el('option', { value: 'synthetic', textContent: 'synthetic' }),
  el('option', { value: 'eval', textContent: 'eval' }),
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
const results = el('div', { id: 'results' })

root.append(
  labelled('Engine', engineSelect),
  el('br'),
  labelled('Set', setSelect),
  el('br'),
  evalBox,
  runButton,
  status,
  results,
)

function setStatus(state: 'idle' | 'running' | 'done' | 'error', detail = ''): void {
  status.dataset.state = state
  status.textContent = detail ? `${state}: ${detail}` : state
}

let store: { engine: string; set: string; runs: RunRecord[] } = {
  engine: engineSelect.value,
  set: setSelect.value,
  runs: [],
}
window.__ocrResults = store

function resetStore(): void {
  store = { engine: engineSelect.value, set: setSelect.value, runs: [] }
  window.__ocrResults = store
  results.replaceChildren()
  setStatus('idle')
}

setSelect.addEventListener('change', () => {
  evalBox.hidden = setSelect.value !== 'eval'
  resetStore()
})
engineSelect.addEventListener('change', resetStore)

class HarnessInputError extends Error {}

async function syntheticItems(): Promise<Item[]> {
  const base = '/test-fixtures/ocr-crops/'
  const res = await fetch(`${base}expected.json`)
  if (!res.ok) throw new HarnessInputError('synthetic fixture missing')
  const list = (await res.json()) as { id: string; file: string; expected: string }[]
  return list.map((e) => ({
    id: e.id,
    expected: e.expected,
    crop: async () => {
      const r = await fetch(base + e.file)
      if (!r.ok) throw new HarnessInputError('synthetic crop missing')
      return r.blob()
    },
  }))
}

async function evalItems(): Promise<{ items: Item[]; skipped: number }> {
  const exportFile = exportInput.files?.[0]
  const docFiles = Array.from(docsInput.files ?? [])
  if (!exportFile || docFiles.length === 0) throw new HarnessInputError('eval inputs missing')
  let parsed
  try {
    parsed = parseNativeExport(JSON.parse(await exportFile.text()))
  } catch {
    throw new HarnessInputError('export not readable')
  }
  const byName = new Map(docFiles.map((f) => [f.name, f]))
  const items: Item[] = []
  let skipped = 0
  let seq = 0
  // Rendered pages are cached per document and page so a page with many regions renders once.
  for (const doc of parsed.documents) {
    const file = byName.get(doc.filename)
    const wanted = doc.annotations.filter((a) => (a.text ?? '').trim() !== '')
    if (!file || !DOC_EXT.test(file.name)) {
      skipped += wanted.length
      continue
    }
    const pages = new Map<number, Promise<{ blob: Blob; width: number; height: number }>>()
    let pdf: ReturnType<typeof loadPdfDocument> | null = null
    const getPage = (pageIndex: number) => {
      let p = pages.get(pageIndex)
      if (!p) {
        if (doc.sourceType === 'pdf') {
          pdf ??= loadPdfDocument(file)
          p = pdf.then((d) => renderPageToBlob(d, pageIndex + 1))
        } else {
          p = createImageBitmap(file).then((bmp) => {
            const dims = { blob: file as Blob, width: bmp.width, height: bmp.height }
            bmp.close()
            return dims
          })
        }
        pages.set(pageIndex, p)
      }
      return p
    }
    for (const a of wanted) {
      seq++
      items.push({
        id: `r${String(seq).padStart(3, '0')}`,
        expected: a.text!,
        crop: async () => {
          const page = await getPage(a.pageIndex)
          return cropPageRegion(page.blob, a, page.width, page.height)
        },
      })
    }
  }
  return { items, skipped }
}

function renderResults(rec: RunRecord): void {
  const s = rec.summary
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
        el('th', { textContent: 'verdict' }),
        el('th', { textContent: 'ms' }),
      ),
    ),
    el(
      'tbody',
      {},
      ...rec.regions.map((r) =>
        el(
          'tr',
          {},
          el('td', { textContent: r.id }),
          el('td', { textContent: r.verdict }),
          el('td', { textContent: r.ms.toFixed(1) }),
        ),
      ),
    ),
  )
  const summary = el('p', { id: 'summary' })
  summary.textContent =
    `run ${rec.run}: total ${s.total}, match ${s.match}, wrong ${s.wrong}, blank ${s.blank}, ` +
    `median ms ${s.medianMs.toFixed(1)}, skipped ${rec.skipped}`
  results.replaceChildren(summary, table)
}

const warmed = new Set<string>()

async function warmUp(name: string, engine: OcrEngine): Promise<void> {
  if (warmed.has(name)) return
  const canvas = document.createElement('canvas')
  canvas.width = 220
  canvas.height = 56
  const g = canvas.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.fillStyle = '#000'
  g.font = '28px sans-serif'
  g.fillText('Warm up 123', 10, 38)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('warm-up image failed')
  await engine.recognize(blob)
  warmed.add(name)
}

async function run(): Promise<void> {
  const name = engineSelect.value
  const engine = ENGINES[name]
  runButton.disabled = true
  setStatus('running')
  try {
    let items: Item[]
    let skipped = 0
    if (setSelect.value === 'synthetic') items = await syntheticItems()
    else ({ items, skipped } = await evalItems())
    await warmUp(name, engine)
    const regions: RegionResult[] = []
    for (const item of items) {
      const crop = await item.crop()
      const t0 = performance.now()
      const out = await engine.recognize(crop)
      const ms = performance.now() - t0
      // The text goes straight into the scorer; it is not stored, rendered or logged.
      regions.push({ id: item.id, verdict: verdict(out.text, item.expected), ms })
    }
    const rec: RunRecord = {
      run: store.runs.length + 1,
      summary: summarise(regions),
      regions,
      skipped,
    }
    store.runs.push(rec)
    renderResults(rec)
    setStatus('done')
  } catch (e) {
    // Only a generic class is shown: an error message could carry a filename or text.
    results.replaceChildren()
    setStatus('error', e instanceof HarnessInputError ? e.message : 'run failed')
  } finally {
    runButton.disabled = false
  }
}

runButton.addEventListener('click', () => void run())
