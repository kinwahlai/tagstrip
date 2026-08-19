import { createWorker } from 'tesseract.js'
import type { Worker } from 'tesseract.js'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
// The "lstm.wasm.js" build embeds the wasm binary as base64 inside the JS
// file itself (no separate .wasm fetch, no relative-path resolution to get
// wrong inside a worker) — see the comment on TESS_LANG_PATH below for why
// that matters here.
import coreUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
import { DEFAULT_OCR_LANGUAGE } from './languages'
import type { OcrEngine } from './types'

// tesseract.js defaults workerPath/corePath/langPath to jsdelivr CDN URLs.
// TagStrip is offline-capable by design (SPEC.md section 6), so all three are
// pointed at locally-bundled assets instead: workerUrl/coreUrl are bundled via
// Vite's ?url asset import (npm packages, not a CDN), and each language's
// data is a static file at public/tessdata/<code>.traineddata.gz (copied from
// the matching @tesseract.js-data npm package — see `npm run update-tessdata`
// to refresh them). langPath must be a *directory* URL, since tesseract.js
// always fetches `${langPath}/<code>.traineddata.gz` itself — that fixed
// filename is why these assets live in public/ rather than going through
// Vite's content-hashed ?url pipeline.
const TESS_LANG_PATH = `${import.meta.env.BASE_URL}tessdata`

let workerPromise: Promise<Worker> | null = null
let loadedLang: string | null = null

// One worker is reused for the session; switching languages calls
// worker.reinitialize() rather than spinning up a new worker each time.
// tesseract.js only re-fetches a language's traineddata the first time it's
// requested (per-worker), so flipping back and forth between two previously
// used languages doesn't redownload anything.
async function getWorker(lang: string): Promise<Worker> {
  if (!workerPromise) {
    loadedLang = lang
    workerPromise = createWorker(lang, undefined, {
      workerPath: workerUrl,
      corePath: coreUrl,
      langPath: TESS_LANG_PATH,
    })
    return workerPromise
  }

  const worker = await workerPromise
  if (loadedLang !== lang) {
    await worker.reinitialize(lang)
    loadedLang = lang
  }
  return worker
}

export const tesseractEngine: OcrEngine = {
  name: 'Tesseract',
  async recognize(imageBlob, options) {
    const worker = await getWorker(options?.lang || DEFAULT_OCR_LANGUAGE)
    const {
      data: { text, confidence },
    } = await worker.recognize(imageBlob)
    return { text: text.trim(), confidence }
  },
}
