#!/usr/bin/env node
// Scripted driver for TagStrip. Run:
//   source scripts/env.sh && NODE_PATH=$RUN_DIR/pw/node_modules node scripts/drive.mjs \
//     --browser chromium --url http://127.0.0.1:$PORT/ --journey suggest-text-ocr \
//     --evidence <dir> --check-id <id> [--block-offsite]
// Journey predict-harness takes: --set synthetic|eval [--eval-export <file> --eval-docs <dir>]
//     [--arm all|A|B|C|T] [--line-model all|florence|ppocr] [--runs N] [--predictions model|truth|shifted] [--headed]; WEBGPU_ARGS env overrides the Chromium flags.
//     --cdp <ws-url> (chromium only) drives an already-running Chrome instead (win-chrome.sh).
// Journey ocr-harness also takes: --engine tesseract --set synthetic|eval
//     [--eval-export <file> --eval-docs <dir>] [--runs N]
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
  'predict-harness': predictHarness,
}
if (!JOURNEYS[journey]) {
  console.error(`unknown journey "${journey}"; known: ${Object.keys(JOURNEYS).join(', ')}`)
  process.exit(2)
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

async function suggestTextOcr(page, ctx, result) {
  const EXPECTED = 'TAGSTRIP 2026'
  const t0 = Date.now()
  await page.goto(args.url)

  // 1. Schema with one label, through the first-run form and the label editor.
  await page.getByLabel('Schema name').fill('verify schema')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('field')
  await page.getByRole('button', { name: 'Add label' }).click()
  await page.getByRole('heading', { name: 'Labels · 1' }).waitFor()

  // 2. Project using that schema.
  await page
    .getByRole('navigation', { name: 'Schemas and projects' })
    .getByRole('button', { name: /^Projects/ })
    .first()
    .click()
  await page.getByLabel('Project name').fill('verify project')
  await page.getByLabel('Label schema').selectOption({ label: 'verify schema' })
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByRole('heading', { name: /^Documents · 0/ }).waitFor()

  // 3. Synthetic PNG rendered in-page; nothing on disk.
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
  await page
    .getByRole('region', { name: 'Documents' })
    .locator('input[type=file]')
    .setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') })
  await page.getByRole('button', { name: /synthetic\.png/ }).click()
  await page.getByRole('button', { name: 'Open annotation canvas' }).click()

  // 4. Draw one region around the text. Box is computed from the page stage element.
  const img = page.getByRole('img', { name: 'Page 1' })
  await img.waitFor()
  await page.waitForFunction(() => {
    const i = document.querySelector('img[alt="Page 1"]')
    return i && i.complete && i.naturalWidth > 0
  })
  await img.scrollIntoViewIfNeeded()
  const box = await img.boundingBox()
  const x0 = box.x + box.width * 0.04
  const x1 = box.x + box.width * 0.96
  const y0 = box.y + box.height * 0.15
  const y1 = box.y + box.height * 0.85
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 8 })
  await page.mouse.move(x1, y1, { steps: 8 })
  await page.mouse.up()
  await page.getByRole('heading', { name: /Regions on this page · 1/ }).waitFor()

  // 5. Suggest text; OCR runs because an image page has no text layer.
  const input = page.getByLabel('Transcription for field region')
  const tOcr = Date.now()
  await page.getByRole('button', { name: 'Suggest text', exact: true }).click()
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[aria-label="Transcription for field region"]')
      return el && el.value.trim().length > 0
    },
    null,
    { timeout: 180_000 },
  )
  result.ocrMs = Date.now() - tOcr
  const got = await input.inputValue()
  result.ocrBadgeShown = (await page.getByText('OCR', { exact: true }).count()) > 0
  result.gotLength = got.length
  result.match = norm(got) === norm(EXPECTED)
  result.totalMs = Date.now() - t0
  return result.match
}

// Recursive, following symlinks: real sets are split into subfolders. The harness matches
// documents by bare filename, so a name seen twice would be ambiguous; refuse it. Errors give
// counts only, never names, because eval sets hold real documents.
function collectEvalDocs(docsDir) {
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
  return docs
}

// Drives the dev-only OCR harness (/harness/ocr.html) and records verdicts and timings only.
// Passes when every run reached data-state=done; it does not judge the decision rule. With
// --set eval the inputs are real documents: nothing but ids, verdicts and ms is written, and no
// screenshot is taken.
async function ocrHarness(page, ctx, result) {
  const engine = args.engine ?? 'tesseract'
  const set = args.set ?? 'synthetic'
  const runs = Number(args.runs ?? 1)
  if (engine !== 'tesseract' || !['synthetic', 'eval'].includes(set) || !(runs >= 1)) {
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
    const docs = collectEvalDocs(docsDir)
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
    result.runs.push({ run: i, summary: rec.summary, skipped: rec.skipped, regions: rec.regions })
  }
  if (set === 'synthetic') result.screenshotTaken = true
  result.totalRegions = result.runs[0].summary.total
  return true
}

// Drives the dev-only predict-fields harness (/harness/predict.html): verdicts, IoUs, counts,
// times and the WebGPU adapter info only, never values, labels' values or filenames. Passes when
// every run reached data-state=done; it does not judge the decision rule. --predictions
// truth|shifted replaces the model's output with the ground truth (or boxes shifted by half
// their width) to check the scorer without the model (M1-3). With --set eval the inputs are real
// documents: no screenshot, and driver errors are replaced by a generic message.
async function predictHarness(page, ctx, result) {
  const set = args.set ?? 'synthetic'
  const predictions = args.predictions ?? 'model'
  const runs = Number(args.runs ?? 1)
  const arm = args.arm ?? 'all'
  const lineModel = args['line-model'] ?? 'all'
  if (!['all', 'A', 'B', 'C', 'T'].includes(arm)) throw new Error('bad --arm')
  if (!['all', 'florence', 'ppocr'].includes(lineModel)) throw new Error('bad --line-model')
  if (!['synthetic', 'eval'].includes(set) || !['model', 'truth', 'shifted'].includes(predictions) || !(runs >= 1)) {
    throw new Error('bad --set/--predictions/--runs')
  }
  Object.assign(result, { set, predictions, arm, lineModel, runs: [] })
  await page.goto(new URL('harness/predict.html', args.url).href)
  await page.getByLabel('Set', { exact: true }).selectOption(set)
  await page.getByLabel('Predictions', { exact: true }).selectOption(predictions)
  await page.getByLabel('Arm', { exact: true }).selectOption(arm)
  await page.getByLabel('Line model', { exact: true }).selectOption(lineModel)
  if (set === 'eval') {
    const exportPath = args['eval-export']
    const docsDir = args['eval-docs']
    if (!exportPath || !docsDir) throw new Error('--set eval needs --eval-export and --eval-docs')
    const docs = collectEvalDocs(docsDir)
    await page.getByLabel('Export JSON', { exact: true }).setInputFiles(exportPath)
    await page.getByLabel('Source documents', { exact: true }).setInputFiles(docs)
  }
  const statusEl = page.locator('#status')
  for (let i = 1; i <= runs; i++) {
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    // Model load can take minutes; one hour per run is the ceiling.
    await page.waitForFunction(
      () => ['done', 'error'].includes(document.querySelector('#status')?.dataset.state),
      null,
      { timeout: 3_600_000 },
    )
    const state = await statusEl.getAttribute('data-state')
    if (state !== 'done') {
      const errName = (await statusEl.getAttribute('data-error')) ?? ''
      // keep the adapter in the evidence even when the run failed (a software adapter is the usual cause)
      result.adapter = (await page.evaluate(() => window.__predictResults))?.adapter ?? null
      // the harness's own status text is generic; data-error is an error class name
      throw new Error(`run ${i} ended in state ${state}: ${(await statusEl.textContent()).slice(0, 80)} [${errName.slice(0, 60)}]`)
    }
    const all = await page.evaluate(() => window.__predictResults)
    // one record per arm (and per line model for A and B) for this click, each with summary,
    // byLang (en, zh-Hans, zh-Hant), skipped and pages
    const recs = all.runs.filter((r) => r.run === i)
    result.adapter = all.adapter
    result.ppocrBackend = all.ppocrBackend
    result.runs.push({
      run: i,
      arms: recs.map(({ arm: a, model, summary, byLang, skipped, pages }) => ({ arm: a, model, summary, byLang, skipped, pages })),
    })
  }
  if (set === 'synthetic') result.screenshotTaken = true
  result.totalFields = result.runs[0].arms[0].summary.total ?? null
  return true
}

// Fresh state every run. WebKit cannot store Blobs in IndexedDB in an ephemeral (in-memory)
// context ("Error preparing Blob/File data to be stored in object store"), so it gets a
// persistent context on a brand-new temp profile dir, deleted at the end. Still empty at start.
const viewport = { width: 1440, height: 900 }
// macOS: Metal via ANGLE gives a hardware adapter headless; the Vulkan flag gave SwiftShader there.
const DEFAULT_WEBGPU_ARGS =
  process.platform === 'darwin'
    ? '--enable-unsafe-webgpu --use-angle=metal --ignore-gpu-blocklist'
    : '--enable-unsafe-webgpu --enable-features=Vulkan'
const WEBGPU_ARGS = (process.env.WEBGPU_ARGS ?? DEFAULT_WEBGPU_ARGS).split(' ').filter(Boolean)
let browser = null
let profileDir = null
let context
if (args.cdp && browserName === 'chromium') {
  // An already-running Chrome (Windows-side, for hardware WebGPU from WSL; see win-chrome.sh).
  // Its own flags apply, not WEBGPU_ARGS.
  browser = await playwright.chromium.connectOverCDP(args.cdp)
  context = await browser.newContext({ viewport })
} else if (browserName === 'webkit') {
  profileDir = fs.mkdtempSync(path.join(runDir, 'profile-'))
  context = await playwright.webkit.launchPersistentContext(profileDir, { headless: true, viewport })
} else {
  const launchOpts = { headless: args.headed !== true }
  // WebGPU on Linux Chromium needs these (found by experiment, see features/predict-harness.md).
  if (journey === 'predict-harness' && browserName === 'chromium') launchOpts.args = WEBGPU_ARGS
  browser = await playwright[browserName].launch(launchOpts)
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
    ? `${checkId}-ocr-harness-${args.engine ?? 'tesseract'}-${args.set ?? 'synthetic'}-${browserName}`
    : journey === 'predict-harness'
      ? `${checkId}-predict-harness-${args.set ?? 'synthetic'}-${browserName}`
      : `${checkId}-${journey}-${browserName}`
const result = { journey, browser: browserName, checkId, blockOffsite, passed: false, match: false }
let error = null
try {
  result.passed = Boolean(await JOURNEYS[journey](page, context, result))
} catch (e) {
  error = e
  result.error = String(e.message ?? e).split('\n')[0].slice(0, 200)
  // Playwright errors can quote file paths; with real data only this driver's own messages stay.
  if (/-harness$/.test(journey) && args.set === 'eval' && !/^(run \d+ ended|--set eval|no documents|--eval-docs has \d+ duplicate|bad --)/.test(result.error)) {
    result.error = 'driver error (details withheld for the eval set)'
  }
}
// ocr-harness with real data: no screenshot (see features/README.md, Real data).
const noShot = /-harness$/.test(journey) && args.set === 'eval'
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
