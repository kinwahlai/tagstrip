// Pure image/array steps of the Indra pipeline, ported from the Python package (indra_ocr
// det_post.py, rec_preproc.py) without OpenCV. Everything works on plain typed arrays so the
// result does not depend on the browser's canvas scaling (which differs between engines).

export interface Gray {
  data: Uint8Array
  width: number
  height: number
}

// Python's round(): halves go to the even neighbour.
export function pyRound(x: number): number {
  const f = Math.floor(x)
  const d = x - f
  if (d < 0.5) return f
  if (d > 0.5) return f + 1
  return f % 2 === 0 ? f : f + 1
}

// RGBA -> 8-bit gray with OpenCV's fixed-point weights (0.299, 0.587, 0.114). Transparent
// pixels are composited on white first.
export function rgbaToGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    const a = rgba[p + 3]
    let r = rgba[p]
    let g = rgba[p + 1]
    let b = rgba[p + 2]
    if (a < 255) {
      r = (r * a + 255 * (255 - a)) / 255
      g = (g * a + 255 * (255 - a)) / 255
      b = (b * a + 255 * (255 - a)) / 255
    }
    data[i] = (Math.round(r) * 4899 + Math.round(g) * 9617 + Math.round(b) * 1868 + 8192) >> 14
  }
  return { data, width, height }
}

// Per-output-index source taps for one axis. 'area' averages every source pixel an output pixel
// covers, weighted by overlap (cv2.INTER_AREA); 'linear' is two-tap interpolation on pixel
// centres with clamped edges (cv2.INTER_LINEAR).
function taps(
  srcLen: number,
  dstLen: number,
  mode: 'area' | 'linear',
): { start: Int32Array; weights: Float32Array[] } {
  const start = new Int32Array(dstLen)
  const weights: Float32Array[] = []
  const ratio = srcLen / dstLen
  for (let d = 0; d < dstLen; d++) {
    if (mode === 'linear') {
      const fx = (d + 0.5) * ratio - 0.5
      let x0 = Math.floor(fx)
      let t = fx - x0
      if (x0 < 0) {
        x0 = 0
        t = 0
      }
      if (x0 >= srcLen - 1) {
        x0 = Math.max(0, srcLen - 2)
        t = srcLen === 1 ? 0 : 1
      }
      start[d] = x0
      weights.push(srcLen === 1 ? Float32Array.of(1) : Float32Array.of(1 - t, t))
    } else {
      const a = d * ratio
      const b = (d + 1) * ratio
      const i0 = Math.floor(a)
      const i1 = Math.min(srcLen, Math.ceil(b))
      const w = new Float32Array(i1 - i0)
      let sum = 0
      for (let i = i0; i < i1; i++) {
        w[i - i0] = Math.min(b, i + 1) - Math.max(a, i)
        sum += w[i - i0]
      }
      for (let k = 0; k < w.length; k++) w[k] /= sum
      start[d] = i0
      weights.push(w)
    }
  }
  return { start, weights }
}

export function resizeGray(src: Gray, dstW: number, dstH: number, mode: 'area' | 'linear'): Gray {
  if (dstW === src.width && dstH === src.height) return src
  const tx = taps(src.width, dstW, mode)
  const ty = taps(src.height, dstH, mode)
  const tmp = new Float32Array(dstW * src.height)
  for (let y = 0; y < src.height; y++) {
    const row = y * src.width
    for (let x = 0; x < dstW; x++) {
      const w = tx.weights[x]
      let s = 0
      for (let k = 0; k < w.length; k++) s += src.data[row + tx.start[x] + k] * w[k]
      tmp[y * dstW + x] = s
    }
  }
  const out = new Uint8Array(dstW * dstH)
  for (let y = 0; y < dstH; y++) {
    const w = ty.weights[y]
    for (let x = 0; x < dstW; x++) {
      let s = 0
      for (let k = 0; k < w.length; k++) s += tmp[(ty.start[y] + k) * dstW + x] * w[k]
      out[y * dstW + x] = Math.max(0, Math.min(255, Math.round(s)))
    }
  }
  return { data: out, width: dstW, height: dstH }
}

export const INPUT_MULTIPLE = 32

// det_post.page_to_input: resize so the long side is `longSide`, pad to a multiple of 32 with
// white, return the ink map (0 = paper, 1 = ink) and the scale used.
export function pageToInput(
  gray: Gray,
  longSide: number,
): { ink: Float32Array; width: number; height: number; scale: number } {
  const scale = longSide / Math.max(gray.height, gray.width)
  const nh = Math.max(1, pyRound(gray.height * scale))
  const nw = Math.max(1, pyRound(gray.width * scale))
  const g = resizeGray(gray, nw, nh, scale < 1 ? 'area' : 'linear')
  const ph = Math.ceil(nh / INPUT_MULTIPLE) * INPUT_MULTIPLE
  const pw = Math.ceil(nw / INPUT_MULTIPLE) * INPUT_MULTIPLE
  const ink = new Float32Array(ph * pw)
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) ink[y * pw + x] = 1 - g.data[y * nw + x] / 255
  }
  return { ink, width: pw, height: ph, scale }
}

export type Box = [number, number, number, number]
export interface ScoredBox {
  box: Box
  score: number
}

const OUT_STRIDE = 2
const CORE_X_SHRINK = 0.15

// det_post.decode with its defaults (thresh 0.5, min_area 2, no growth). `out` is the detector's
// [3][h][w] output, flattened: core logit, distance to line top, distance to line bottom, at half
// resolution. Components are 4-connected, as in the Python.
export function decodeDetection(out: Float32Array, h: number, w: number): ScoredBox[] {
  const n = h * w
  const prob = new Float32Array(n)
  for (let i = 0; i < n; i++) prob[i] = 1 / (1 + Math.exp(-out[i]))
  const label = new Int32Array(n)
  const boxes: ScoredBox[] = []
  const stack = new Int32Array(n)
  let next = 0
  for (let seed = 0; seed < n; seed++) {
    if (prob[seed] <= 0.5 || label[seed] !== 0) continue
    next++
    let sp = 0
    stack[sp++] = seed
    label[seed] = next
    let area = 0
    let minX = w
    let maxX = -1
    let sumTop = 0
    let sumBot = 0
    let sumScore = 0
    while (sp > 0) {
      const p = stack[--sp]
      const y = (p / w) | 0
      const x = p - y * w
      area++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      const ys = (y + 0.5) * OUT_STRIDE
      sumTop += ys - out[n + p]
      sumBot += ys + out[2 * n + p]
      sumScore += prob[p]
      if (x > 0 && prob[p - 1] > 0.5 && label[p - 1] === 0) {
        label[p - 1] = next
        stack[sp++] = p - 1
      }
      if (x < w - 1 && prob[p + 1] > 0.5 && label[p + 1] === 0) {
        label[p + 1] = next
        stack[sp++] = p + 1
      }
      if (y > 0 && prob[p - w] > 0.5 && label[p - w] === 0) {
        label[p - w] = next
        stack[sp++] = p - w
      }
      if (y < h - 1 && prob[p + w] > 0.5 && label[p + w] === 0) {
        label[p + w] = next
        stack[sp++] = p + w
      }
    }
    if (area < 2) continue
    const y0 = sumTop / area
    const y1 = sumBot / area
    const lh = Math.max(1, y1 - y0)
    const ex = Math.min(CORE_X_SHRINK * lh, 0.5 * lh)
    boxes.push({
      box: [minX * OUT_STRIDE - ex, y0, (maxX + 1) * OUT_STRIDE + ex, y1],
      score: sumScore / area,
    })
  }
  return boxes
}

// rec_preproc._percentiles: np.percentile (linear) of a uint8 sample, from its histogram.
function percentiles(values: Uint8Array, qs: number[]): number[] {
  const n = values.length
  const hist = new Int32Array(256)
  for (let i = 0; i < n; i++) hist[values[i]]++
  const cum = new Int32Array(256)
  let acc = 0
  for (let i = 0; i < 256; i++) {
    acc += hist[i]
    cum[i] = acc
  }
  // searchsorted(cum, v, side="right"): first index whose cumulative count exceeds v
  const firstAbove = (v: number) => {
    let i = 0
    while (i < 255 && cum[i] <= v) i++
    return i
  }
  return qs.map((q) => {
    const x = q * (n - 1)
    const i = Math.floor(x)
    const g = x - i
    const lo = firstAbove(i)
    const hi = firstAbove(Math.min(i + 1, n - 1))
    const d = hi - lo
    return g >= 0.5 ? hi - d * (1 - g) : lo + d * g
  })
}

// rec_preproc.is_dark_line: light text on a dark ground (read inverted by the recogniser).
export function isDarkLine(gray: Gray, box: Box): boolean {
  const x0 = Math.max(0, Math.trunc(box[0]))
  const y0 = Math.max(0, Math.trunc(box[1]))
  const x1 = Math.min(gray.width, Math.trunc(box[2]) + 1)
  const y1 = Math.min(gray.height, Math.trunc(box[3]) + 1)
  if (x1 <= x0 || y1 <= y0) return false
  const b = new Uint8Array((x1 - x0) * (y1 - y0))
  let k = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) b[k++] = gray.data[y * gray.width + x]
  }
  const [lo, med, hi] = percentiles(b, [0.02, 0.5, 0.98])
  return hi - med > 2 * (med - lo) + 8
}

export const LINE_HEIGHT = 32
export const REC_WINDOW = 3 // meta.json "rec_window": rec.onnx reads a 3x-tall window
export const PAD_Y = 0.2
export const PAD_X = 0.3
export const WIDTH_MULTIPLE = 8

// rec_preproc.crop_line with window > 1: the line plus the page above and below it, resized to
// `LINE_HEIGHT * window` pixels high keeping aspect ratio, as an ink map (0 = paper, 1 = ink).
export function cropLine(
  gray: Gray,
  box: Box,
  window: number = REC_WINDOW,
  dark: boolean = isDarkLine(gray, box),
): { ink: Float32Array; width: number; height: number } {
  const height = LINE_HEIGHT * window
  const padY = (window * (1 + 2 * PAD_Y) - 1) / 2
  const [x0, y0, x1, y1] = box
  const h = Math.max(1, y1 - y0)
  const X0 = x0 - PAD_X * h
  const X1 = x1 + PAD_X * h
  const Y0 = y0 - padY * h
  const Y1 = y1 + padY * h
  const ix0 = Math.floor(X0)
  const iy0 = Math.floor(Y0)
  const ix1 = Math.ceil(X1)
  const iy1 = Math.ceil(Y1)
  const cw = Math.max(1, ix1 - ix0)
  const ch = Math.max(1, iy1 - iy0)
  const sx0 = Math.max(0, ix0)
  const sy0 = Math.max(0, iy0)
  const sx1 = Math.min(gray.width, ix1)
  const sy1 = Math.min(gray.height, iy1)
  const crop = new Uint8Array(cw * ch).fill(dark ? 0 : 255)
  if (sx1 > sx0 && sy1 > sy0) {
    for (let y = sy0; y < sy1; y++) {
      const src = y * gray.width + sx0
      crop.set(gray.data.subarray(src, src + (sx1 - sx0)), (y - iy0) * cw + (sx0 - ix0))
    }
  }
  const outW = Math.max(WIDTH_MULTIPLE, Math.min(4096, pyRound((cw * height) / ch)))
  const resized = resizeGray(
    { data: crop, width: cw, height: ch },
    outW,
    height,
    ch > height ? 'area' : 'linear',
  )
  const ink = new Float32Array(resized.data.length)
  for (let i = 0; i < ink.length; i++) {
    const v = resized.data[i] / 255
    ink[i] = dark ? v : 1 - v
  }
  return { ink, width: outW, height }
}
