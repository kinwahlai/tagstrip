#!/usr/bin/env node
// Scripted driver for TagStrip. Run:
//   source scripts/env.sh && NODE_PATH=$RUN_DIR/pw/node_modules node scripts/drive.mjs \
//     --browser chromium --url http://127.0.0.1:$PORT/ --journey suggest-text-ocr \
//     --evidence <dir> --check-id <id> [--block-offsite]
// Journey suggest-text-ocr also takes: --case en|zh-Hans|zh-Hant|all|text-layer (default all)
// Journey ocr-harness also takes: --engine ppocr --set synthetic|synthetic-zh|eval
//     [--eval-export <file> --eval-docs <dir>] [--runs N]
// --cdp <ws-url> (chromium only) drives an already-running Chrome instead (win-chrome.sh).
// Exit 0 only if the journey's own assertion passed (for ocr-harness: the harness completed). Result JSON holds verdicts, counts and
// timings only, never document text.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) {
      const next = all[i + 1]
      acc.push([a.slice(2), next === undefined || next.startsWith('--') ? true : next])
    }
    return acc
  }, []),
)
const browserName = args.browser ?? 'chromium'
const journey = args.journey
const checkId = args['check-id'] ?? 'adhoc'
const evidence = args.evidence
const blockOffsite = args['block-offsite'] === true
if (!args.url || !journey || !evidence) {
  console.error('usage: drive.mjs --browser B --url U --journey J --evidence DIR [--check-id ID] [--block-offsite]')
  process.exit(2)
}
fs.mkdirSync(evidence, { recursive: true })

const runDir = process.env.RUN_DIR ?? `/tmp/verify-tagstrip-${process.env.PORT ?? 5199}`
const require = createRequire(path.join(runDir, 'pw', 'noop.js'))
const playwright = require('playwright')

const JOURNEYS = {
  'suggest-text-ocr': suggestTextOcr,
  'ocr-harness': ocrHarness,
}
if (!JOURNEYS[journey]) {
  console.error(`unknown journey "${journey}"; known: ${Object.keys(JOURNEYS).join(', ')}`)
  process.exit(2)
}

// Letters and digits in any script, so Chinese text is kept (same rule as src/lib/ocrEval/score.ts).
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

const ZH_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../test-fixtures/ocr-pages-zh')

// A page image to upload and the box (normalised) to draw the region over.
function zhCase(page) {
  const pages = JSON.parse(fs.readFileSync(path.join(ZH_DIR, 'expected.json'), 'utf8'))
  const p = pages.find((e) => e.page === page)
  const f = p.fields[0]
  return { name: page, buffer: fs.readFileSync(path.join(ZH_DIR, page)), bbox: f.bbox, expected: f.value }
}

// Draws a region over a normalised box [x1,y1,x2,y2] of the page image, scrolling it into view.
async function drawRegion(page, [nx1, ny1, nx2, ny2]) {
  const img = page.getByRole('img', { name: 'Page 1' })
  await img.waitFor()
  await page.waitForFunction(() => {
    const i = document.querySelector('img[alt="Page 1"]')
    return i && i.complete && i.naturalWidth > 0
  })
  await img.scrollIntoViewIfNeeded()
  let box = await img.boundingBox()
  const cy = () => box.y + box.height * ((ny1 + ny2) / 2)
  await page.mouse.move(box.x + box.width / 2, Math.min(Math.max(box.y + 20, 20), 880))
  for (let i = 0; i < 6 && (cy() < 120 || cy() > 780); i++) {
    await page.mouse.wheel(0, cy() - 450)
    await page.waitForTimeout(150)
    box = await img.boundingBox()
  }
  const x0 = box.x + box.width * nx1
  const x1 = box.x + box.width * nx2
  const y0 = box.y + box.height * ny1
  const y1 = box.y + box.height * ny2
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 8 })
  await page.mouse.move(x1, y1, { steps: 8 })
  await page.mouse.up()
}

// Schema and project through the UI. The schema is made only when the browser is still empty, so
// later cases in one run reuse it.
async function ensureProject(page, projectName) {
  await page.goto(args.url)
  const schemaField = page.getByLabel('Schema name')
  const nav = page.getByRole('navigation', { name: 'Schemas and projects' })
  await schemaField.or(nav).first().waitFor()
  if (await schemaField.count()) {
    await schemaField.fill('verify schema')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('field')
    await page.getByRole('button', { name: 'Add label' }).click()
    await page.getByRole('heading', { name: 'Labels · 1' }).waitFor()
  }
  await nav.getByRole('button', { name: /^Projects/ }).first().click()
  await page.getByLabel('Project name').fill(projectName)
  await page.getByLabel('Label schema').selectOption({ label: 'verify schema' })
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByRole('heading', { name: /^Documents · 0/ }).waitFor()
}

// Presses Suggest text and waits for the field to fill; returns elapsed ms and the text.
async function suggestOnce(page) {
  const t = Date.now()
  await page.getByRole('button', { name: 'Suggest text', exact: true }).click()
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[aria-label^="Transcription for "]')
      return el && el.value.trim().length > 0
    },
    null,
    { timeout: 180_000 },
  )
  return { ms: Date.now() - t, got: await page.getByLabel(/^Transcription for /).inputValue() }
}

// One OCR case: upload, draw, Suggest text (first call loads the engine), clear, Suggest text
// again and time that one. Records no document text.
async function ocrCase(page, name, fileName, upload, bbox, expected) {
  const c = { case: name, match: false }
  await ensureProject(page, `verify project ${name}`)
  await page
    .getByRole('region', { name: 'Documents' })
    .locator('input[type=file]')
    .setInputFiles(upload)
  await page.getByRole('button', { name: new RegExp(fileName.replace('.', '\\.')) }).click()
  await page.getByRole('button', { name: 'Open annotation canvas' }).click()
  await drawRegion(page, bbox)
  await page.getByRole('heading', { name: /Regions on this page · 1/ }).waitFor()
  const first = await suggestOnce(page)
  c.firstMs = first.ms
  c.ocrBadgeShown = (await page.getByText('OCR', { exact: true }).count()) > 0
  c.match = norm(first.got) === norm(expected)
  await page.getByLabel(/^Transcription for /).fill('')
  const second = await suggestOnce(page)
  c.secondMs = second.ms
  c.secondMatch = norm(second.got) === norm(expected)
  c.backend = await page.evaluate(() => window.__ocrBackend ?? null)
  c.gotLength = first.got.length
  return c
}

async function suggestTextOcr(page, ctx, result) {
  const which = args.case ?? 'all'
  if (!['en', 'zh-Hans', 'zh-Hant', 'all', 'text-layer'].includes(which)) throw new Error('bad --case')
  const t0 = Date.now()
  if (which === 'text-layer') return textLayerCase(page, result)

  // The English page is generated in-page; nothing on disk.
  const en = async () => {
    const EXPECTED = 'TAGSTRIP 2026'
    await page.goto(args.url)
    const b64 = await page.evaluate((text) => {
      const c = document.createElement('canvas')
      c.width = 1000
      c.height = 240
      const g = c.getContext('2d')
      g.fillStyle = '#fff'
      g.fillRect(0, 0, c.width, c.height)
      g.fillStyle = '#000'
      g.font = 'bold 96px Arial, Helvetica, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(text, c.width / 2, c.height / 2)
      return c.toDataURL('image/png').split(',')[1]
    }, EXPECTED)
    const upload = { name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') }
    return ocrCase(page, 'en', 'synthetic.png', upload, [0.04, 0.15, 0.96, 0.85], EXPECTED)
  }
  const zh = (file, name) => {
    const z = zhCase(file)
    return ocrCase(page, name, z.name, { name: z.name, mimeType: 'image/png', buffer: z.buffer }, z.bbox, z.expected)
  }
  const runs = {
    en,
    'zh-Hans': () => zh('p09.png', 'zh-Hans'),
    'zh-Hant': () => zh('p11.png', 'zh-Hant'),
  }
  const names = which === 'all' ? Object.keys(runs) : [which]
  result.cases = []
  for (const n of names) result.cases.push(await runs[n]())
  result.match = result.cases.every((c) => c.match)
  result.ocrBadgeShown = result.cases.every((c) => c.ocrBadgeShown)
  result.totalMs = Date.now() - t0
  return result.match && result.ocrBadgeShown
}

// The text-layer path: the bundled sample PDF fills with no OCR tag and no model or runtime file
// is requested (counted as requests whose path contains /ocr/).
async function textLayerCase(page, result) {
  const ocrRequests = []
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.includes('/ocr/')) ocrRequests.push(r.url())
  })
  await page.goto(args.url)
  await page.getByRole('button', { name: 'Load the sample document' }).click()
  await drawRegion(page, [0.05, 0.04, 0.6, 0.12])
  await page.getByRole('heading', { name: /Regions on this page · 1/ }).waitFor()
  const { ms, got } = await suggestOnce(page)
  result.textLayerMs = ms
  result.gotLength = got.length
  result.ocrBadgeShown = (await page.getByText('OCR', { exact: true }).count()) > 0
  result.ocrRequestCount = ocrRequests.length
  result.match = got.trim().length > 0
  return result.match && !result.ocrBadgeShown && ocrRequests.length === 0
}

// Drives the dev-only OCR harness (/harness/ocr.html) and records verdicts and timings only.
// Passes when every run reached data-state=done; it does not judge the decision rule. With
// --set eval the inputs are real documents: nothing but ids, verdicts and ms is written, and no
// screenshot is taken.
async function ocrHarness(page, ctx, result) {
  const engine = args.engine ?? 'ppocr'
  const set = args.set ?? 'synthetic'
  const runs = Number(args.runs ?? 1)
  if (engine !== 'ppocr' || !['synthetic', 'synthetic-zh', 'eval'].includes(set) || !(runs >= 1)) {
    throw new Error('bad --engine/--set/--runs')
  }
  Object.assign(result, { engine, set, runs: [] })
  await page.goto(new URL('harness/ocr.html', args.url).href)
  await page.getByLabel('Engine', { exact: true }).selectOption(engine)
  await page.getByLabel('Set', { exact: true }).selectOption(set)
  if (set === 'eval') {
    const exportPath = args['eval-export']
    const docsDir = args['eval-docs']
    if (!exportPath || !docsDir) throw new Error('--set eval needs --eval-export and --eval-docs')
    // Recursive, following symlinks: real sets are split into subfolders. The harness matches
    // documents by bare filename, so a name seen twice would be ambiguous; refuse it. Errors
    // give counts only, never names, because eval sets hold real documents.
    const docs = []
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name)
        const st = fs.statSync(p)
        if (st.isDirectory()) walk(p)
        else if (st.isFile() && /\.(pdf|png|jpe?g|webp)$/i.test(name)) docs.push(p)
      }
    }
    walk(docsDir)
    if (docs.length === 0) throw new Error('no documents in --eval-docs')
    const dupes = docs.length - new Set(docs.map((p) => path.basename(p))).size
    if (dupes > 0) throw new Error(`--eval-docs has ${dupes} duplicate filename(s) across subfolders`)
    await page.getByLabel('Export JSON', { exact: true }).setInputFiles(exportPath)
    await page.getByLabel('Source documents', { exact: true }).setInputFiles(docs)
  }
  const statusEl = page.locator('#status')
  for (let i = 1; i <= runs; i++) {
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await page.waitForFunction(
      () => ['done', 'error'].includes(document.querySelector('#status')?.dataset.state),
      null,
      { timeout: 3_600_000 },
    )
    const state = await statusEl.getAttribute('data-state')
    if (state !== 'done') {
      // the harness's own status text is generic (never a filename or OCR text)
      throw new Error(`run ${i} ended in state ${state}: ${(await statusEl.textContent()).slice(0, 80)}`)
    }
    const all = await page.evaluate(() => window.__ocrResults)
    const rec = all.runs[all.runs.length - 1]
    result.runs.push({
      run: i,
      summary: rec.summary,
      byLang: rec.byLang,
      skipped: rec.skipped,
      regions: rec.regions,
    })
    result.backend = all.backend
    result.adapter = all.adapter
  }
  if (set !== 'eval') result.screenshotTaken = true
  result.totalRegions = result.runs[0].summary.total
  return true
}

// Fresh state every run. WebKit cannot store Blobs in IndexedDB in an ephemeral (in-memory)
// context ("Error preparing Blob/File data to be stored in object store"), so it gets a
// persistent context on a brand-new temp profile dir, deleted at the end. Still empty at start.
const viewport = { width: 1440, height: 900 }
let browser = null
let profileDir = null
let context
if (args.cdp && browserName === 'chromium') {
  // An already-running Chrome (Windows-side, for hardware WebGPU from WSL; see win-chrome.sh).
  browser = await playwright.chromium.connectOverCDP(args.cdp)
  context = await browser.newContext({ viewport })
} else if (browserName === 'webkit') {
  profileDir = fs.mkdtempSync(path.join(runDir, 'profile-'))
  context = await playwright.webkit.launchPersistentContext(profileDir, { headless: true, viewport })
} else {
  browser = await playwright[browserName].launch({ headless: true })
  context = await browser.newContext({ viewport })
}
const appOrigin = new URL(args.url).origin
const blocked = []
if (blockOffsite) {
  await context.route('**/*', (route) => {
    const u = route.request().url()
    if (/^https?:/.test(u) && new URL(u).origin !== appOrigin) {
      blocked.push(u)
      return route.abort()
    }
    return route.continue()
  })
}
const page = await context.newPage()
const stem =
  journey === 'ocr-harness'
    ? `${checkId}-ocr-harness-${args.engine ?? 'ppocr'}-${args.set ?? 'synthetic'}-${browserName}`
    : `${checkId}-${journey}-${browserName}`
const result = { journey, browser: browserName, checkId, blockOffsite, passed: false, match: false }
let error = null
try {
  result.passed = Boolean(await JOURNEYS[journey](page, context, result))
} catch (e) {
  error = e
  result.error = String(e.message ?? e).split('\n')[0].slice(0, 200)
  // Playwright errors can quote file paths; with real data only this driver's own messages stay.
  if (journey === 'ocr-harness' && args.set === 'eval' && !/^(run \d+ ended|--set eval|no documents|bad --)/.test(result.error)) {
    result.error = 'driver error (details withheld for the eval set)'
  }
}
// ocr-harness with real data: no screenshot (see features/README.md, Real data).
const noShot = journey === 'ocr-harness' && args.set === 'eval'
if (!noShot) {
  try {
    await page.screenshot({ path: path.join(evidence, `${stem}.png`) })
  } catch {}
}
if (blockOffsite) {
  fs.writeFileSync(path.join(evidence, `${checkId}-blocked.txt`), blocked.map((u) => u + '\n').join(''))
  result.blockedCount = blocked.length
}
fs.writeFileSync(path.join(evidence, `${stem}.json`), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result))
await context.close()
if (browser) await browser.close()
if (profileDir) fs.rmSync(profileDir, { recursive: true, force: true })
process.exit(result.passed ? 0 : 1)
