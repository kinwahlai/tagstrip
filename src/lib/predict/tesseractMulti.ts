// Tesseract with English, Simplified and Traditional Chinese loaded together, for the TS-16
// region comparison (the app's own engine, src/lib/ocr/tesseract.ts, stays English only).
// Language data is served locally from predict-models/tessdata (scripts/fetch-ppocr.sh); the
// worker and core come from the npm packages, as in the app. No CDN is used.
import { createWorker } from 'tesseract.js'
import type { Worker } from 'tesseract.js'
import workerUrl from 'tesseract.js/dist/worker.min.js?url'
import coreUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'

export const TESSERACT_LANGS = 'eng+chi_sim+chi_tra'

let workerPromise: Promise<Worker> | null = null

function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker(TESSERACT_LANGS, undefined, {
    workerPath: workerUrl,
    corePath: coreUrl,
    langPath: `${import.meta.env.BASE_URL}predict-models/tessdata`,
  })
  return workerPromise
}

export async function tesseractMulti(imageBlob: Blob): Promise<string> {
  const worker = await getWorker()
  const {
    data: { text },
  } = await worker.recognize(imageBlob)
  return text.trim()
}
