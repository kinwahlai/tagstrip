// Dev-only harness (harness/predict.html), TS-16: tests Florence-2 text-line boxes with browser
// LFM values on a list of pages. Arms: A = Florence lines, each field's TRUE value matched to a
// line for the box; B = LFM values (one call per page) matched to Florence lines for the box;
// C = Florence phrase grounding by label name; T = Florence <OCR> vs Tesseract on each true
// region's crop. Per field it shows an id, the box verdict with its IoU and the value verdict,
// plus times. It counts only: no pass/fail against any decision rule. It never renders or logs
// predicted values, transcriptions, label values or filenames; results are also exposed as JSON
// in window.__predictResults under the same rule.
import { backendInfo, configureLocalRuntime, loadModel, predictFields } from '../lib/predict/lfmVl'
import type { BackendInfo } from '../lib/predict/lfmVl'
import { ground, loadFlorence, ocr, ocrWithRegion } from '../lib/predict/florence'
import { loadPpocr, ppocrBackend, ppocrCrop, ppocrLines } from '../lib/predict/ppocr'
import { tesseractMulti } from '../lib/predict/tesseractMulti'
import { matchLines } from '../lib/predict/matchLines'
import type { Line } from '../lib/predict/matchLines'
import { IOU_HIT, iou as iouScore, sameLabel, valueVerdict } from '../lib/predict/score'
import type { Box, FieldBox, FieldResult } from '../lib/predict/score'
import { median, summarise as summariseOcr, verdict as ocrVerdict } from '../lib/ocrEval/score'
import type { RegionResult, Summary, Verdict } from '../lib/ocrEval/score'
import { cropPageRegion } from '../lib/ocrCrop'
import { parseNativeExport } from '../lib/nativeImport'
import { loadPdfDocument, renderPageToBlob } from '../lib/pdf'

type Arm = 'A' | 'B' | 'C' | 'T'
type LineModel = 'florence' | 'ppocr'
const IOU_INFO = 0.3 // reported beside IOU_HIT, for information only

interface PageItem {
  image: () => Promise<Blob>
  truth: FieldBox[]
  lang: string // en, zh-Hans, zh-Hant (synthetic) or unknown (eval)
}

interface PageRecord {
  page: string // p001... never the filename
  lang: string
  ms: number // arm A: line model; B: LFM + line model; C: all grounding calls
  fields: FieldResult[]
}

// match/wrong/blank are null where the arm does not predict values (A uses the truth, C none).
interface ArmSummary {
  total: number
  boxHits: number // IoU >= 0.5
  boxHits03: number // IoU >= 0.3
  match: number | null
  wrong: number | null
  blank: number | null
  medianMs: number // per page
}

interface ArmRun {
  run: number
  arm: 'A' | 'B' | 'C'
  model: LineModel // the line model giving the boxes (arm C is Florence grounding)
  summary: ArmSummary
  byLang: Record<string, ArmSummary>
  pages: PageRecord[]
  skipped: number
}

type Engine = 'florence' | 'ppocr' | 'tesseract'
const ENGINES: Engine[] = ['florence', 'ppocr', 'tesseract']
// Only the engines a run used have a key: Florence is left out when it was not loaded.
type EngineMap<T> = Partial<Record<Engine, T>>
const enginesOf = (m: EngineMap<unknown>) => Object.keys(m) as Engine[]

interface TessField {
  id: string
  lang: string
  verdict: EngineMap<Verdict>
  ms: EngineMap<number>
}

interface TessRun {
  run: number
  arm: 'T'
  summary: EngineMap<Summary>
  byLang: Record<string, EngineMap<Summary>>
  pages: { page: string; lang: string; fields: TessField[] }[]
  skipped: number
}

type RunRecord = ArmRun | TessRun

interface Store {
  set: string
  predictions: string
  arm: string
  lineModel: string
  adapter: BackendInfo | null
  ppocrBackend: string | null // webgpu or wasm: what PP-OCRv6 actually ran on
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
// 'truth' and 'shifted' replace the models' output (Florence lines and LFM values) with the ground
// truth itself (or with every box moved by half its width) so the scorer and matcher can be
// checked without a model (arms A and B only; arms C and T need the real models).
const predictionsSelect = el(
  'select',
  { id: 'predictions', ariaLabel: 'Predictions' },
  el('option', { value: 'model', textContent: 'model' }),
  el('option', { value: 'truth', textContent: 'truth' }),
  el('option', { value: 'shifted', textContent: 'shifted' }),
)
const armSelect = el(
  'select',
  { id: 'arm', ariaLabel: 'Arm' },
  el('option', { value: 'all', textContent: 'all' }),
  el('option', { value: 'A', textContent: 'A' }),
  el('option', { value: 'B', textContent: 'B' }),
  el('option', { value: 'C', textContent: 'C' }),
  el('option', { value: 'T', textContent: 'T' }),
)
const modelSelect = el(
  'select',
  { id: 'line-model', ariaLabel: 'Line model' },
  el('option', { value: 'all', textContent: 'all' }),
  el('option', { value: 'florence', textContent: 'florence' }),
  el('option', { value: 'ppocr', textContent: 'ppocr' }),
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
  labelled('Arm', armSelect),
  el('br'),
  labelled('Line model', modelSelect),
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

let store: Store = {
  set: setSelect.value,
  predictions: 'model',
  arm: armSelect.value,
  lineModel: modelSelect.value,
  adapter: null,
  ppocrBackend: null,
  runs: [],
}
window.__predictResults = store

function resetStore(): void {
  store = {
    set: setSelect.value,
    predictions: predictionsSelect.value,
    arm: armSelect.value,
    lineModel: modelSelect.value,
    adapter: null,
    ppocrBackend: null,
    runs: [],
  }
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
armSelect.addEventListener('change', resetStore)
modelSelect.addEventListener('change', resetStore)

async function syntheticPages(): Promise<PageItem[]> {
  const res = await fetch(`${FIXTURE_BASE}expected.json`)
  if (!res.ok) throw new HarnessInputError('synthetic fixture missing')
  const list = (await res.json()) as { page: string; lang?: string; fields: FieldBox[] }[]
  return list.map((p) => ({
    truth: p.fields,
    lang: p.lang ?? 'en',
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
        lang: 'unknown',
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

// 'truth' returns the ground truth; 'shifted' moves every box by half its width (to the left
// when that would leave the page), so every box must miss while the values stay right.
function oracle(truth: FieldBox[], mode: string): FieldBox[] {
  if (mode === 'truth') return truth
  return truth.map((t) => {
    const w = t.bbox[2] - t.bbox[0]
    const dx = t.bbox[2] + w / 2 > 1 ? -w / 2 : w / 2
    return { ...t, bbox: [t.bbox[0] + dx, t.bbox[1], t.bbox[2] + dx, t.bbox[3]] as Box }
  })
}

// The one place line boxes come from, for both line models. model: Florence-2
// <OCR_WITH_REGION> or PP-OCRv6 detection plus recognition. truth and shifted: the true value
// and box of every field stand in for the lines, so the matcher and the scorer can be checked
// without a model.
async function lineBoxes(
  model: LineModel,
  image: Blob,
  truth: FieldBox[],
  mode: string,
): Promise<Line[]> {
  if (mode !== 'model') return oracle(truth, mode).map((t) => ({ text: t.value, box: t.bbox }))
  return model === 'florence' ? ocrWithRegion(image) : ppocrLines(image)
}

// box null = nothing predicted (miss, IoU 0). value null = the arm predicts no value (blank).
function armField(truth: FieldBox, box: Box | null, value: string | null, id: string): FieldResult {
  const overlap = box ? iouScore(box, truth.bbox) : 0
  return {
    id,
    box: overlap >= IOU_HIT ? 'hit' : 'miss',
    iou: overlap,
    value: value === null ? 'blank' : valueVerdict(value, truth.value, truth.label),
  }
}

function summariseArm(pages: PageRecord[], values: boolean): ArmSummary {
  const fields = pages.flatMap((p) => p.fields)
  const count = (v: string) => (values ? fields.filter((f) => f.value === v).length : null)
  return {
    total: fields.length,
    boxHits: fields.filter((f) => f.box === 'hit').length,
    boxHits03: fields.filter((f) => f.iou >= IOU_INFO).length,
    match: count('match'),
    wrong: count('wrong'),
    blank: count('blank'),
    medianMs: median(pages.map((p) => p.ms)),
  }
}

function groupByLang<T extends { lang: string }, R>(
  items: T[],
  summarise: (x: T[]) => R,
): Record<string, R> {
  const langs = [...new Set(items.map((x) => x.lang))].sort()
  return Object.fromEntries(langs.map((l) => [l, summarise(items.filter((x) => x.lang === l))]))
}

async function imageSize(image: Blob): Promise<{ width: number; height: number }> {
  const bmp = await createImageBitmap(image)
  const size = { width: bmp.width, height: bmp.height }
  bmp.close()
  return size
}

async function cropOf(image: Blob, box: Box): Promise<Blob> {
  const size = await imageSize(image)
  return cropPageRegion(
    image,
    { x: box[0], y: box[1], width: box[2] - box[0], height: box[3] - box[1] },
    size.width,
    size.height,
  )
}

const fmt = (n: number | null) => (n === null ? 'n/a' : String(n))
const sec = (ms: number) => (ms / 1000).toFixed(2)

function armLine(label: string, s: ArmSummary, skipped: number): string {
  return (
    `${label}: fields ${s.total}, box hits ${s.boxHits} at 0.5, ${s.boxHits03} at 0.3, ` +
    `match ${fmt(s.match)}, wrong ${fmt(s.wrong)}, blank ${fmt(s.blank)}, ` +
    `median s/page ${sec(s.medianMs)}, skipped ${skipped}`
  )
}

function tessLine(label: string, s: EngineMap<Summary>): string {
  const engines = enginesOf(s)
  return (
    `${label}: regions ${s[engines[0]]!.total}; ` +
    engines
      .map((e) => {
        const x = s[e]!
        return (
          `${e} match ${x.match}, wrong ${x.wrong}, blank ${x.blank}, ` +
          `median s/region ${sec(x.medianMs)}`
        )
      })
      .join('; ')
  )
}

function summaryLines(rec: RunRecord): string[] {
  if (rec.arm === 'T') {
    return [
      tessLine(`run ${rec.run} arm T`, rec.summary),
      ...Object.entries(rec.byLang).map(([l, s]) => tessLine(`  ${l}`, s)),
    ]
  }
  const head = `run ${rec.run} arm ${rec.arm} model ${rec.model}`
  return [
    armLine(head, rec.summary, rec.skipped),
    ...Object.entries(rec.byLang).map(([l, s]) => armLine(`  ${l}`, s, 0)),
  ]
}

function renderRecord(rec: RunRecord): HTMLElement[] {
  const rows: HTMLTableRowElement[] = []
  const cells = (...t: string[]) => el('tr', {}, ...t.map((x) => el('td', { textContent: x })))
  let head: string[]
  if (rec.arm === 'T') {
    const engines = enginesOf(rec.summary)
    head = ['id', ...engines]
    for (const p of rec.pages) {
      rows.push(cells(`${p.page} ${p.lang}`, ...engines.map(() => '')))
      for (const f of p.fields) {
        rows.push(cells(f.id, ...engines.map((e) => `${f.verdict[e]} ${sec(f.ms[e]!)} s`)))
      }
    }
  } else {
    head = ['id', 'box', 'IoU', 'value']
    for (const p of rec.pages) {
      rows.push(cells(`${p.page} ${p.lang}`, `page time ${sec(p.ms)} s`, '', ''))
      for (const f of p.fields) rows.push(cells(f.id, f.box, f.iou.toFixed(2), f.value))
    }
  }
  const table = el(
    'table',
    { className: 'arm-table' },
    el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { textContent: h })))),
    el('tbody', {}, ...rows),
  )
  return [
    ...summaryLines(rec).map((t, i) =>
      el('p', { className: i === 0 ? 'summary' : 'lang-summary', textContent: t }),
    ),
    table,
  ]
}

function renderResults(recs: RunRecord[]): void {
  results.replaceChildren(...recs.flatMap(renderRecord))
}

const nth = <T>(list: T[], pick: (x: T) => boolean, n: number): T | undefined =>
  list.filter(pick)[n]

async function run(): Promise<void> {
  const mode = predictionsSelect.value
  runButton.disabled = true
  setStatus('loading')
  try {
    const models: LineModel[] =
      modelSelect.value === 'all' ? ['florence', 'ppocr'] : [modelSelect.value as LineModel]
    // Arm C is Florence grounding, so `all` leaves it out when Florence is not a line model; an
    // explicitly chosen C still runs.
    const arms: Arm[] =
      armSelect.value === 'all'
        ? mode === 'model'
          ? models.includes('florence')
            ? ['A', 'B', 'C', 'T']
            : ['A', 'B', 'T']
          : ['A', 'B']
        : [armSelect.value as Arm]
    if (mode !== 'model' && arms.some((a) => a === 'C' || a === 'T')) {
      throw new HarnessInputError('arms C and T need predictions model')
    }
    // Arm T reads Florence <OCR> only when Florence is a selected line model.
    const engines: Engine[] = models.includes('florence') ? ENGINES : ['ppocr', 'tesseract']
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

    const needLines = arms.includes('A') || arms.includes('B')
    const useFlorence =
      (needLines && models.includes('florence')) ||
      arms.includes('C') ||
      (arms.includes('T') && engines.includes('florence'))
    const usePpocr = (needLines && models.includes('ppocr')) || arms.includes('T')
    if (mode === 'model') {
      configureLocalRuntime()
      if (useFlorence) await loadFlorence()
      if (usePpocr) await loadPpocr()
      if (arms.includes('B')) await loadModel()
      // Untimed warm-ups on the first page: the first run compiles WebGPU kernels.
      const first = pages[0]
      const firstImage = await first.image()
      if (needLines && models.includes('florence')) await ocrWithRegion(firstImage)
      if (needLines && models.includes('ppocr')) await ppocrLines(firstImage)
      if (arms.includes('B')) {
        await predictFields(firstImage, [...new Set(first.truth.map((t) => t.label))])
      }
      if (arms.includes('C')) await ground(firstImage, first.truth[0].label)
      if (arms.includes('T')) {
        const crop = await cropOf(firstImage, first.truth[0].bbox)
        if (engines.includes('florence')) await ocr(crop)
        await ppocrCrop(crop)
        await tesseractMulti(crop)
      }
      store.ppocrBackend = ppocrBackend()
    }

    setStatus('running')
    const key = (arm: 'A' | 'B' | 'C', model: LineModel) => `${arm}-${model}`
    const armPages = new Map<string, PageRecord[]>()
    const push = (k: string, r: PageRecord) => armPages.set(k, [...(armPages.get(k) ?? []), r])
    const tessPages: TessRun['pages'] = []
    const tessResults: EngineMap<(RegionResult & { lang: string })[]> = Object.fromEntries(
      engines.map((e) => [e, []]),
    )
    let seq = 0
    for (let i = 0; i < pages.length; i++) {
      const item = pages[i]
      const page = `p${String(i + 1).padStart(3, '0')}`
      const lang = item.lang
      const ids = item.truth.map(() => `f${String(++seq).padStart(3, '0')}`)
      const image = await item.image()
      const labels = [...new Set(item.truth.map((t) => t.label))]

      // LFM is called once per page and shared by the arm B records of both line models.
      let predicted: FieldBox[] = []
      let lfmMs = 0
      if (arms.includes('B')) {
        if (mode === 'model') {
          const t0 = performance.now()
          predicted = await predictFields(image, labels)
          lfmMs = performance.now() - t0
        } else {
          predicted = item.truth
        }
      }

      if (needLines) {
        for (const model of models) {
          const t0 = performance.now()
          const lines = await lineBoxes(model, image, item.truth, mode)
          const lineMs = mode === 'model' ? performance.now() - t0 : 0
          if (arms.includes('A')) {
            // The true value finds its line; only the box is meaningful here.
            const fields = item.truth.map((t, k) =>
              armField(t, matchLines(t.value, lines), t.value, ids[k]),
            )
            push(key('A', model), { page, lang, ms: lineMs, fields })
          }
          if (arms.includes('B')) {
            // Predicted values go straight into the scorer; they are not stored, rendered or logged.
            const seen = new Map<string, number>()
            const fields = item.truth.map((t, k) => {
              const lk = t.label.toLowerCase()
              const n = seen.get(lk) ?? 0
              seen.set(lk, n + 1)
              const entry = nth(predicted, (p) => sameLabel(p.label, t.label), n)
              const box = entry ? matchLines(entry.value, lines) : null
              return armField(t, box, entry ? entry.value : null, ids[k])
            })
            push(key('B', model), { page, lang, ms: lfmMs + lineMs, fields })
          }
        }
      }

      if (arms.includes('C')) {
        let ms = 0
        const fields: FieldResult[] = []
        for (let k = 0; k < item.truth.length; k++) {
          const t0 = performance.now()
          const box = await ground(image, item.truth[k].label)
          ms += performance.now() - t0
          fields.push(armField(item.truth[k], box, null, ids[k]))
        }
        push(key('C', 'florence'), { page, lang, ms, fields })
      }

      if (arms.includes('T')) {
        const fields: TessField[] = []
        for (let k = 0; k < item.truth.length; k++) {
          const crop = await cropOf(image, item.truth[k].bbox)
          const readers: Record<Engine, (b: Blob) => Promise<string>> = {
            florence: ocr,
            ppocr: ppocrCrop,
            tesseract: tesseractMulti,
          }
          const verdicts: EngineMap<Verdict> = {}
          const times: EngineMap<number> = {}
          for (const e of engines) {
            const t0 = performance.now()
            // The text goes straight into the scorer; it is not stored, rendered or logged.
            const text = await readers[e](crop)
            times[e] = performance.now() - t0
            verdicts[e] = ocrVerdict(text, item.truth[k].value)
            tessResults[e]!.push({ id: ids[k], verdict: verdicts[e]!, ms: times[e]!, lang })
          }
          fields.push({ id: ids[k], lang, verdict: verdicts, ms: times })
        }
        tessPages.push({ page, lang, fields })
      }
    }

    const runNo = (store.runs.at(-1)?.run ?? 0) + 1
    const added: RunRecord[] = []
    for (const arm of arms) {
      if (arm === 'T') {
        const sum = (rows: EngineMap<RegionResult[]>): EngineMap<Summary> =>
          Object.fromEntries(engines.map((e) => [e, summariseOcr(rows[e]!)]))
        added.push({
          run: runNo,
          arm,
          summary: sum(tessResults),
          byLang: Object.fromEntries(
            [...new Set(tessResults[engines[0]]!.map((r) => r.lang))]
              .sort()
              .map((l) => [
                l,
                sum(
                  Object.fromEntries(
                    engines.map((e) => [e, tessResults[e]!.filter((r) => r.lang === l)]),
                  ),
                ),
              ]),
          ),
          pages: tessPages,
          skipped,
        })
        continue
      }
      for (const model of arm === 'C' ? (['florence'] as LineModel[]) : models) {
        const recs = armPages.get(key(arm, model)) ?? []
        added.push({
          run: runNo,
          arm,
          model,
          summary: summariseArm(recs, arm === 'B'),
          byLang: groupByLang(recs, (p) => summariseArm(p, arm === 'B')),
          pages: recs,
          skipped,
        })
      }
    }
    store.runs.push(...added)
    renderResults(added)
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
