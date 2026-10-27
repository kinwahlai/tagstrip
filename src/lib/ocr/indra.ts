// Indra OCR engine (datalab-to/indra-ocr, code Apache-2.0, weights OpenRAIL-M) behind the
// OcrEngine interface. Runs det.onnx and rec.onnx through onnxruntime-web on the WASM execution
// provider, single-threaded, from assets served by this app's own origin.
//
// Pipeline for one crop: detection model -> text-line boxes -> recognition model on each line ->
// plain greedy CTC decoding -> lines joined with "\n", top to bottom.
//
// Recogniser: rec.onnx with meta.json "vocab" (1,697 classes: ASCII, Latin-1, Latin Extended A/B,
// Vietnamese, plus LaTeX tokens). It is the package's base recogniser ("base is rec.onnx",
// indra_ocr/pipeline.py, GROUPS comment and OrtOCR.__init__: `self.rec = ... need("rec.onnx")`,
// `self.vocab = Vocab.from_json(meta["vocab"])`) and the Latin one (vocab.py: "Vocab.latin() is
// the first recognizer's character set"). rec_world.onnx / "vocab_world" add Cyrillic, Greek,
// Devanagari and Bengali; rec_cjk and rec_rtl are for other scripts. They are not loaded.
//
// Deviations from the Python package (indra-ocr 1.1.2), all deliberate:
//  1. Not ported: orientation (orient.onnx), skew estimation and deskew, script classification
//     (script.onnx) and the world/cjk/rtl recognisers, reading order and layout (order.onnx),
//     line splitting at wide gaps, tidy_lines (leader-line removal, marker joining), picture
//     boxes, math, the CenterMask model (mask.onnx; absent from the model folder in Python too).
//  2. Language model: none. Plain greedy CTC, no lm.npz, no beam search. The Python only runs its
//     beam search when lm.npz is present and the line's confidence is below a gate.
//  3. Detector input scale. Python scales a page's long side to 1024 px. For a crop that
//     magnifies the text far past what the detector was trained on and splits each line into
//     fragments (measured: 14 of 20 synthetic crops gave 4 to 23 boxes per line). A crop is
//     therefore read first at native scale (long side = the crop's own long side, padded to a
//     multiple of 32 as in page_to_input). If the median line height is then under 9 px or over
//     44 px it is read again at a scale that brings it to 12 px or 28 px (small side capped at a
//     2,048 px long side, as Python's adaptive pass does). Python's own adaptive pass applies
//     only with 8 or more lines and only upward; these thresholds are this port's.
//  4. Resizing, gray conversion and connected components are plain TypeScript (area and linear
//     resampling with float weights, OpenCV's fixed-point gray weights, 4-connected flood fill),
//     not OpenCV. Results can differ from OpenCV by one grey level at some pixels.
//  5. Boxes are axis-aligned, as in Python (det_post.decode returns axis-aligned boxes); no
//     rotation is applied anywhere.
//  6. Lines are recognised one per ONNX call (batch of 1), not in width-sorted batches. Width is
//     padded to a multiple of 8 as in pad_batch.
//  7. The rec.onnx input is the tall window crop (3x line height, 96 px) exactly as Python's
//     `tall` crops are, since rec.onnx's declared input height is 96. The 32 px line crops
//     Python also builds are used there only for script classification, which is skipped.
//  8. A line whose mean CTC confidence is under 0.5 comes back empty (MIN_CONF), as in Python.
//  9. `confidence` is the mean over kept lines of the mean per-character max probability, x100.
// 10. Lines are ordered by vertical centre, then x (Python orders with the order model).
import * as ort from 'onnxruntime-web/wasm'
import type { OcrEngine } from './types'
import { ctcGreedyDecode, decodeIds } from './ctc'
import { WIDTH_MULTIPLE, cropLine, decodeDetection, pageToInput, rgbaToGray } from './indraImage'
import type { Box, Gray } from './indraImage'

const MIN_CONF = 0.5
const MIN_LINE_H = 9
const TARGET_SMALL_H = 12
const MAX_LINE_H = 44
const TARGET_LARGE_H = 28
const MAX_SIDE = 2048

function appUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href
}

interface Loaded {
  det: ort.InferenceSession
  rec: ort.InferenceSession
  chars: string[]
}

let loading: Promise<Loaded> | null = null

function load(): Promise<Loaded> {
  if (!loading) {
    loading = (async () => {
      ort.env.wasm.wasmPaths = appUrl('ort/')
      ort.env.wasm.numThreads = 1
      ort.env.wasm.proxy = false
      const opts: ort.InferenceSession.SessionOptions = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      }
      const base = appUrl('indra-models/')
      const metaRes = await fetch(`${base}meta.json`)
      if (!metaRes.ok) throw new Error(`Indra models not found at ${base} (${metaRes.status}).`)
      const meta = (await metaRes.json()) as { vocab: string }
      const chars = (JSON.parse(meta.vocab) as { chars: string[] }).chars
      const [det, rec] = await Promise.all([
        ort.InferenceSession.create(`${base}det.onnx`, opts),
        ort.InferenceSession.create(`${base}rec.onnx`, opts),
      ])
      return { det, rec, chars }
    })()
    loading.catch(() => {
      loading = null
    })
  }
  return loading
}

async function blobToGray(blob: Blob): Promise<Gray> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Could not acquire 2D canvas context.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return rgbaToGray(data, canvas.width, canvas.height)
  } finally {
    bitmap.close()
  }
}

async function detectAt(det: ort.InferenceSession, gray: Gray, scale: number) {
  const longSide = Math.max(1, Math.round(Math.max(gray.width, gray.height) * scale))
  const input = pageToInput(gray, longSide)
  const out = await det.run({
    x: new ort.Tensor('float32', input.ink, [1, 1, input.height, input.width]),
  })
  const t = out.out
  const [, , h, w] = t.dims
  return { boxes: decodeDetection(t.data as Float32Array, h, w), s: input.scale }
}

async function detectLines(det: ort.InferenceSession, gray: Gray): Promise<Box[]> {
  let { boxes, s } = await detectAt(det, gray, 1)
  if (boxes.length) {
    const hs = boxes.map((b) => (b.box[3] - b.box[1]) / s).sort((a, b) => a - b)
    const med =
      hs.length % 2 ? hs[(hs.length - 1) / 2] : (hs[hs.length / 2 - 1] + hs[hs.length / 2]) / 2
    let scale: number | null = null
    if (med < MIN_LINE_H) {
      scale = Math.min(
        MAX_SIDE / Math.max(gray.width, gray.height),
        TARGET_SMALL_H / Math.max(med, 1),
      )
    } else if (med > MAX_LINE_H) {
      scale = TARGET_LARGE_H / med
    }
    if (scale !== null && Math.abs(scale - 1) > 1e-6)
      ({ boxes, s } = await detectAt(det, gray, scale))
  }
  return boxes.map(({ box }) => [
    Math.min(gray.width, Math.max(0, box[0] / s)),
    Math.min(gray.height, Math.max(0, box[1] / s)),
    Math.min(gray.width, Math.max(0, box[2] / s)),
    Math.min(gray.height, Math.max(0, box[3] / s)),
  ])
}

async function recognizeLine(
  rec: ort.InferenceSession,
  chars: string[],
  gray: Gray,
  box: Box,
): Promise<{ text: string; conf: number }> {
  const crop = cropLine(gray, box)
  const padded = Math.ceil(crop.width / WIDTH_MULTIPLE) * WIDTH_MULTIPLE
  const x = new Float32Array(crop.height * padded)
  for (let y = 0; y < crop.height; y++) {
    x.set(crop.ink.subarray(y * crop.width, (y + 1) * crop.width), y * padded)
  }
  const res = await rec.run(
    {
      x: new ort.Tensor('float32', x, [1, 1, crop.height, padded]),
      widths: new ort.Tensor('int64', BigInt64Array.of(BigInt(crop.width)), [1]),
    },
    ['ids', 'conf', 'lengths'],
  )
  const length = Number((res.lengths.data as BigInt64Array)[0])
  const { ids, meanConf } = ctcGreedyDecode(
    res.ids.data as BigInt64Array,
    res.conf.data as Float32Array,
    length,
  )
  if (meanConf < MIN_CONF) return { text: '', conf: meanConf }
  return { text: decodeIds(ids, chars), conf: meanConf }
}

export const indraEngine: OcrEngine = {
  name: 'Indra',
  async recognize(imageBlob) {
    const { det, rec, chars } = await load()
    const gray = await blobToGray(imageBlob)
    const boxes = await detectLines(det, gray)
    boxes.sort((a, b) => a[1] + a[3] - (b[1] + b[3]) || a[0] - b[0])
    const lines: string[] = []
    const confs: number[] = []
    for (const box of boxes) {
      const r = await recognizeLine(rec, chars, gray, box)
      if (r.text) {
        lines.push(r.text)
        confs.push(r.conf)
      }
    }
    return {
      text: lines.join('\n'),
      confidence: confs.length
        ? (100 * confs.reduce((a, b) => a + b, 0)) / confs.length
        : undefined,
    }
  },
}
