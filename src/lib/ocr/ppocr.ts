// PP-OCRv6 small (PaddlePaddle, Apache-2.0) as the OcrEngine behind Suggest text: onnxruntime-web
// running the DB text detector (line boxes) and the CTC recogniser (text), our own pipeline, with
// WebGPU first and WASM as the fallback. The model and runtime files are served from the app's
// own origin under ocr/ (public/ocr/, fetched by scripts/fetch-ocr-assets.sh), so nothing is
// requested from a CDN (SPEC.md section 6). The pure parts (postprocess, CTC decode, dictionary
// parsing, reading order) are unit-tested; the session code needs a browser.
import * as ort from 'onnxruntime-web/webgpu'
import type { OcrEngine } from './types'

// x1, y1, x2, y2 in the units of whatever it boxes (map pixels, or image pixels).
export type Box = [number, number, number, number]

// Settings from the det model's inference.yml (PostProcess) and PaddleOCR's det/rec defaults.
export const DB = { thresh: 0.2, boxThresh: 0.45, unclip: 1.4, minSize: 3, maxCandidates: 3000 }
const DET_MAX_SIDE = 960
const REC_H = 48
const REC_MIN_W = 320
const REC_MAX_W = 3200

// ---- pure parts -------------------------------------------------------------------------

// The recogniser's inference.yml lists the characters as `  - X` lines (plain or single-quoted
// scalars) under `character_dict:`. Not a general YAML parser: it reads exactly that shape, and
// does not trim, because some entries are whitespace (an ideographic space).
export function parseCharDict(yml: string): string[] {
  const out: string[] = []
  let inDict = false
  for (const raw of yml.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (!inDict) {
      inDict = line.startsWith('  character_dict:')
      continue
    }
    if (!line.startsWith('  - ')) break
    let v = line.slice(4)
    if (v.length >= 2 && v.startsWith("'") && v.endsWith("'"))
      v = v.slice(1, -1).replace(/''/g, "'")
    out.push(v)
  }
  return out
}

// Index 0 is the CTC blank, then the dictionary, then a space (PaddleOCR's use_space_char) when
// the model has the extra class.
export function ctcChars(dict: string[], classes: number): string[] {
  const chars = ['', ...dict]
  if (classes === dict.length + 2) chars.push(' ')
  return chars
}

// logits: T x C, row-major. Greedy per step, repeats collapsed, blanks dropped.
export function ctcDecode(
  logits: ArrayLike<number>,
  steps: number,
  classes: number,
  chars: string[],
) {
  let text = ''
  let prev = -1
  for (let t = 0; t < steps; t++) {
    let best = 0
    let bestV = -Infinity
    for (let c = 0; c < classes; c++) {
      const v = logits[t * classes + c]
      if (v > bestV) {
        bestV = v
        best = c
      }
    }
    if (best !== 0 && best !== prev) text += chars[best] ?? ''
    prev = best
  }
  return text
}

// DB postprocess. prob: h x w probability map. Each 8-connected region above `thresh` is a text
// candidate: scored by its mean probability, dropped under boxThresh or when thinner than
// minSize, then its box is unclipped (grown by area * ratio / perimeter on every side, as the
// shrunk DB kernel is smaller than the text). Boxes are axis-aligned (PaddleOCR fits rotated
// rectangles; for upright lines the two agree) in the map's pixel coordinates [x1,y1,x2,y2].
export function dbBoxes(prob: ArrayLike<number>, w: number, h: number, o = DB): Box[] {
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  const boxes: Box[] = []
  for (let start = 0; start < w * h && boxes.length < o.maxCandidates; start++) {
    if (seen[start] || prob[start] <= o.thresh) continue
    let minX = w
    let maxX = -1
    let minY = h
    let maxY = -1
    let sum = 0
    let n = 0
    seen[start] = 1
    stack.push(start)
    while (stack.length) {
      const p = stack.pop()!
      const x = p % w
      const y = (p - x) / w
      sum += prob[p]
      n++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (seen[q] || prob[q] <= o.thresh) continue
          seen[q] = 1
          stack.push(q)
        }
      }
    }
    const bw = maxX - minX + 1
    const bh = maxY - minY + 1
    if (sum / n < o.boxThresh || Math.min(bw, bh) < o.minSize) continue
    const d = (bw * bh * o.unclip) / (2 * (bw + bh))
    boxes.push([
      Math.max(0, minX - d),
      Math.max(0, minY - d),
      Math.min(w, maxX + 1 + d),
      Math.min(h, maxY + 1 + d),
    ])
  }
  return boxes
}

// Reading order for lines: top to bottom, then left to right within a row (a row = vertical
// centres within half the shorter height of each other).
export function readingOrder(boxes: Box[]): Box[] {
  const mid = (b: Box) => (b[1] + b[3]) / 2
  return [...boxes].sort((a, b) => {
    const tol = Math.min(a[3] - a[1], b[3] - b[1]) / 2
    return Math.abs(mid(a) - mid(b)) <= tol ? a[0] - b[0] : mid(a) - mid(b)
  })
}

// ---- browser part -------------------------------------------------------------------------

export type PpocrBackend = 'webgpu' | 'wasm'

function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}ocr/${path}`, window.location.href).href
}

type Sessions = {
  det: ort.InferenceSession
  rec: ort.InferenceSession
  chars: string[]
}
let loadingPromise: Promise<Sessions> | null = null
let usedBackend: PpocrBackend | null = null

// Which backend the sessions actually run on, or null before loading.
export function ppocrBackend(): PpocrBackend | null {
  return usedBackend
}

async function fetchBytes(path: string): Promise<Uint8Array> {
  const r = await fetch(assetUrl(path))
  if (!r.ok) throw new Error('OCR model file missing; run scripts/fetch-ocr-assets.sh')
  return new Uint8Array(await r.arrayBuffer())
}

// WebGPU first; if a session cannot be created there, both sessions fall back to WASM and the
// backend reported is 'wasm'. Nothing is hidden: ppocrBackend() says which one ran.
function loadSessions(): Promise<Sessions> {
  loadingPromise ??= (async () => {
    ort.env.wasm.wasmPaths = {
      mjs: assetUrl('ort/ort-wasm-simd-threaded.asyncify.mjs'),
      wasm: assetUrl('ort/ort-wasm-simd-threaded.asyncify.wasm'),
    }
    const [detBytes, recBytes, yml] = await Promise.all([
      fetchBytes('ppocr/det/inference.onnx'),
      fetchBytes('ppocr/rec/inference.onnx'),
      fetch(assetUrl('ppocr/rec/inference.yml')).then((r) => {
        if (!r.ok) throw new Error('OCR dictionary missing; run scripts/fetch-ocr-assets.sh')
        return r.text()
      }),
    ])
    let backend: PpocrBackend = 'webgpu'
    let det: ort.InferenceSession
    let rec: ort.InferenceSession
    try {
      det = await ort.InferenceSession.create(detBytes, { executionProviders: ['webgpu'] })
      rec = await ort.InferenceSession.create(recBytes, { executionProviders: ['webgpu'] })
    } catch {
      backend = 'wasm'
      det = await ort.InferenceSession.create(detBytes, { executionProviders: ['wasm'] })
      rec = await ort.InferenceSession.create(recBytes, { executionProviders: ['wasm'] })
    }
    usedBackend = backend
    // The class count is only known from a run, so the blank and space entries are added per run.
    return { det, rec, chars: parseCharDict(yml) }
  })()
  const p = loadingPromise
  p.catch(() => {
    loadingPromise = null
  })
  return p
}

async function toCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  bmp.close()
  return c
}

// Resized copy of a canvas region, as a CHW float tensor in BGR channel order (PaddleOCR decodes
// with OpenCV and normalises per channel index).
function chw(
  src: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  w: number,
  h: number,
  padTo: number,
  norm: (v: number, ch: number) => number,
): ort.Tensor {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.drawImage(src, sx, sy, sw, sh, 0, 0, w, h)
  const px = g.getImageData(0, 0, w, h).data
  const W = Math.max(w, padTo)
  const out = new Float32Array(3 * h * W) // padding stays 0, as PaddleOCR pads after normalising
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const o = y * W + x
      out[o] = norm(px[i + 2], 0) // B
      out[h * W + o] = norm(px[i + 1], 1) // G
      out[2 * h * W + o] = norm(px[i], 2) // R
    }
  }
  return new ort.Tensor('float32', out, [1, 3, h, W])
}

const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

async function recognise(s: Sessions, src: HTMLCanvasElement, box: Box): Promise<string> {
  const sx = Math.max(0, Math.floor(box[0]))
  const sy = Math.max(0, Math.floor(box[1]))
  const sw = Math.max(1, Math.min(src.width - sx, Math.ceil(box[2]) - sx))
  const sh = Math.max(1, Math.min(src.height - sy, Math.ceil(box[3]) - sy))
  const ratio = sw / sh
  const imgW = Math.min(
    REC_MAX_W,
    Math.max(REC_MIN_W, Math.floor(REC_H * Math.max(REC_MIN_W / REC_H, ratio))),
  )
  const w = Math.min(imgW, Math.ceil(REC_H * ratio))
  const input = chw(src, sx, sy, sw, sh, w, REC_H, imgW, (v) => (v / 255 - 0.5) / 0.5)
  const out = await s.rec.run({ [s.rec.inputNames[0]]: input })
  const t = out[s.rec.outputNames[0]]
  const [, steps, classes] = t.dims as number[]
  return ctcDecode(t.data as Float32Array, steps, classes, ctcChars(s.chars, classes)).trim()
}

// Detector boxes for the image, in its own pixel coordinates, in reading order.
async function detectLines(s: Sessions, src: HTMLCanvasElement): Promise<Box[]> {
  const scale = Math.min(1, DET_MAX_SIDE / Math.max(src.width, src.height))
  const w = Math.max(32, Math.round((src.width * scale) / 32) * 32)
  const h = Math.max(32, Math.round((src.height * scale) / 32) * 32)
  const input = chw(
    src,
    0,
    0,
    src.width,
    src.height,
    w,
    h,
    0,
    (v, ch) => (v / 255 - MEAN[ch]) / STD[ch],
  )
  const out = await s.det.run({ [s.det.inputNames[0]]: input })
  const prob = out[s.det.outputNames[0]].data as Float32Array
  const sx = src.width / w
  const sy = src.height / h
  return readingOrder(dbBoxes(prob, w, h)).map((b) => [b[0] * sx, b[1] * sy, b[2] * sx, b[3] * sy])
}

// The text in a cropped region: detect the lines in it, read each, join in reading order. If the
// detector finds no line (a very tight crop), the whole crop is read as one line instead.
export const ppocrEngine: OcrEngine = {
  name: 'PP-OCRv6',
  async recognize(imageBlob) {
    const s = await loadSessions()
    const src = await toCanvas(imageBlob)
    const boxes = await detectLines(s, src)
    if (boxes.length === 0) boxes.push([0, 0, src.width, src.height])
    const lines: string[] = []
    for (const box of boxes) lines.push(await recognise(s, src, box))
    return { text: lines.filter((l) => l !== '').join(' ') }
  },
}
