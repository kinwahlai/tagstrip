import { createWorker } from 'tesseract.js'
import type { Worker } from 'tesseract.js'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
// The "lstm.wasm.js" build embeds the wasm binary as base64 inside the JS
// file itself (no separate .wasm fetch, no relative-path resolution to get
// wrong inside a worker) — see the comment on TESS_LANG_PATH below for why
// that matters here.
import coreUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
import type { OcrEngine } from './types'

// tesseract.js defaults workerPath/corePath/langPath to jsdelivr CDN URLs.
// TagStrip is offline-capable by design (SPEC.md section 6), so all three are
// pointed at locally-bundled assets instead: workerUrl/coreUrl are bundled via
// Vite's `?url` asset import (npm packages, not a CDN), and the English
// language data is a static file at public/tessdata/eng.traineddata.gz
// (copied from the @tesseract.js-data/eng npm package — see
// `npm run update-tessdata` to refresh it). langPath must be a *directory*
// URL, since tesseract.js always fetches `${langPath}/eng.traineddata.gz`
// itself — that fixed filename is why this asset lives in public/ rather
// than going through Vite's content-hashed `?url` pipeline.
const TESS_LANG_PATH = `${import.meta.env.BASE_URL}tessdata`

let workerPromise: Promise<Worker> | null = null

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', undefined, {
      workerPath: workerUrl,
      corePath: coreUrl,
      langPath: TESS_LANG_PATH,
    })
  }
  return workerPromise
}

export const tesseractEngine: OcrEngine = {
  name: 'Tesseract',
  async recognize(imageBlob) {
    const worker = await getWorker()
    const {
      data: { text, confidence },
    } = await worker.recognize(imageBlob)
    return { text: text.trim(), confidence }
  },
}
