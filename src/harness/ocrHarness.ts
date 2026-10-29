// Dev-only harness (harness/ocr.html): runs one OCR engine over a list of crops and shows, per
// region, an id, a verdict and a time. It never renders or logs OCR text, transcriptions or
// filenames; results are also exposed as JSON in window.__ocrResults for the driver, under the
// same rule.
import { ppocrBackend, ppocrEngine } from '../lib/ocr/ppocr'
import type { OcrEngine } from '../lib/ocr/types'
import { summarise, verdict } from '../lib/ocrEval/score'
import type { RegionResult, Summary } from '../lib/ocrEval/score'
import { parseNativeExport } from '../lib/nativeImport'
import { loadPdfDocument, renderPageToBlob } from '../lib/pdf'
import { cropPageRegion } from '../lib/ocrCrop'

type Lang = 'en' | 'zh-Hans' | 'zh-Hant' | 'unknown'

interface Item {
  id: string
  lang: Lang
  crop: () => Promise<Blob>
  expected: string
}

interface LangResult extends RegionResult {
  lang: Lang
}

interface RunRecord {
  run: number
  summary: Summary
  byLang: Record<string, Summary>
  regions: LangResult[]
  skipped: number
}

interface AdapterInfo {
  webgpu: boolean
  vendor?: string
  architecture?: string
  device?: string
  description?: string
  isFallbackAdapter?: boolean
}

interface Store {
  engine: string
  set: string
  backend: string | null
  adapter: AdapterInfo | null
  runs: RunRecord[]
}

declare global {
  interface Window {
    __ocrResults?: Store
  }
}

const ENGINES: Record<string, OcrEngine> = { ppocr: ppocrEngine }
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
  el('option', { value: 'ppocr', textContent: 'ppocr' }),
)
const setSelect = el(
  'select',
  { id: 'set', ariaLabel: 'Set' },
  el('option', { value: 'synthetic', textContent: 'synthetic' }),
  el('option', { value: 'synthetic-zh', textContent: 'synthetic-zh' }),
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

let store: Store = {
  engine: engineSelect.value,
  set: setSelect.value,
  backend: null,
  adapter: null,
  runs: [],
}
window.__ocrResults = store

function resetStore(): void {
  store = {
    engine: engineSelect.value,
    set: setSelect.value,
    backend: null,
    adapter: null,
    runs: [],
  }
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
    lang: 'en',
    expected: e.expected,
    crop: async () => {
      const r = await fetch(base + e.file)
      if (!r.ok) throw new HarnessInputError('synthetic crop missing')
      return r.blob()
    },
  }))
}

// Chinese pages with a box per field. Each field is cropped out of its page with the app's own
// cropPageRegion, so the crop path Suggest text uses is the one measured.
async function syntheticZhItems(): Promise<Item[]> {
  const base = '/test-fixtures/ocr-pages-zh/'
  const res = await fetch(`${base}expected.json`)
  if (!res.ok) throw new HarnessInputError('synthetic fixture missing')
  const pages = (await res.json()) as {
    page: string
    lang: 'zh-Hans' | 'zh-Hant'
    fields: { id: string; bbox: [number, number, number, number]; value: string }[]
  }[]
  const items: Item[] = []
  for (const p of pages) {
    const loaded = (async () => {
      const r = await fetch(base + p.page)
      if (!r.ok) throw new HarnessInputError('synthetic page missing')
      const blob = await r.blob()
      const bmp = await createImageBitmap(blob)
      const dims = { blob, width: bmp.width, height: bmp.height }
      bmp.close()
      return dims
    })()
    for (const f of p.fields) {
      const [x1, y1, x2, y2] = f.bbox
      items.push({
        id: f.id,
        lang: p.lang,
        expected: f.value,
        crop: async () => {
          const page = await loaded
          return cropPageRegion(
            page.blob,
            { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
            page.width,
            page.height,
          )
        },
      })
    }
  }
  return items
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
        lang: 'unknown',
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
  const langs = Object.entries(rec.byLang)
    .map(([l, v]) => `${l} ${v.match}/${v.total}`)
    .join(', ')
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
        el('th', { textContent: 'lang' }),
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
          el('td', { textContent: r.lang }),
          el('td', { textContent: r.verdict }),
          el('td', { textContent: r.ms.toFixed(1) }),
        ),
      ),
    ),
  )
  const summary = el('p', { id: 'summary' })
  summary.textContent =
    `run ${rec.run}: total ${s.total}, match ${s.match}, wrong ${s.wrong}, blank ${s.blank}, ` +
    `median ms ${s.medianMs.toFixed(1)}, skipped ${rec.skipped}, by lang: ${langs}, backend ${store.backend ?? '?'}`
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

// Which WebGPU adapter is present, so a software one (SwiftShader) is visible in the results.
async function adapterInfo(): Promise<AdapterInfo> {
  type Adapter = { info?: Record<string, unknown>; isFallbackAdapter?: boolean }
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<Adapter | null> } }).gpu
  const adapter = gpu ? await gpu.requestAdapter() : null
  if (!adapter) return { webgpu: false }
  const i = adapter.info ?? {}
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  return {
    webgpu: true,
    vendor: str(i.vendor),
    architecture: str(i.architecture),
    device: str(i.device),
    description: str(i.description),
    isFallbackAdapter:
      typeof i.isFallbackAdapter === 'boolean' ? i.isFallbackAdapter : adapter.isFallbackAdapter,
  }
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
    else if (setSelect.value === 'synthetic-zh') items = await syntheticZhItems()
    else ({ items, skipped } = await evalItems())
    await warmUp(name, engine)
    const regions: LangResult[] = []
    for (const item of items) {
      const crop = await item.crop()
      const t0 = performance.now()
      const out = await engine.recognize(crop)
      const ms = performance.now() - t0
      // The text goes straight into the scorer; it is not stored, rendered or logged.
      regions.push({ id: item.id, lang: item.lang, verdict: verdict(out.text, item.expected), ms })
    }
    store.backend = ppocrBackend()
    store.adapter = await adapterInfo()
    const byLang: Record<string, Summary> = {}
    for (const lang of new Set(regions.map((r) => r.lang))) {
      byLang[lang] = summarise(regions.filter((r) => r.lang === lang))
    }
    const rec: RunRecord = {
      run: store.runs.length + 1,
      summary: summarise(regions),
      byLang,
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
