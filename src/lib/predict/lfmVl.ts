// Field prediction with LFM2.5-VL-450M in the browser (TS-12 M1, dev harness only for now).
// One call per page: the page image and the field names go in; each found field comes back with
// its value and its box, normalised to 0..1. Greedy decoding, so a given backend is repeatable
// up to WebGPU numerics. The model is read from local files only (scripts/fetch-lfm-vl.sh); no
// request leaves the page's origin. Licence of the model: LFM Open License v1.0.
import {
  AutoModelForImageTextToText,
  AutoProcessor,
  RawImage,
  env,
} from '@huggingface/transformers'
import type { Tensor } from '@huggingface/transformers'
import promptFile from './prompt.json'
import type { Box, FieldBox } from './score'

export const MODEL_ID = 'onnx-community/LFM2.5-VL-450M-ONNX'
export const MODEL_REVISION = '24e63007ff1aaafbde27c89eb01a0513f4f61482'
export const MAX_NEW_TOKENS = 512

// The prompt is the model card's grounding query ("Detect all instances of: ... Response must be
// a JSON array: [{"label", "bbox"}]. Coordinates are normalized to [0,1].") extended with a
// "value" per entry. The text lives in prompt.json so scripts/predict-reference.py uses the same.
export const PROMPT_TEMPLATE: string = promptFile.template

export function buildPrompt(fields: string[]): string {
  return PROMPT_TEMPLATE.replace('{fields}', fields.join(', '))
}

function pageBase(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href
}

// Local model files and ONNX Runtime WASM only; remote loading is off, so a missing file is an
// error rather than a request to the Hugging Face Hub or a CDN.
export function configureLocalRuntime(): void {
  env.allowRemoteModels = false
  env.allowLocalModels = true
  // An origin-relative path, not an absolute URL: transformers.js 4.3.1 skips its local-file
  // existence check when localModelPath is http(s) and then finds no tokenizer.
  env.localModelPath = new URL(pageBase('predict-models/')).pathname
  const ort = pageBase('predict-models/ort/')
  const wasm = env.backends.onnx.wasm
  if (wasm) {
    wasm.wasmPaths = {
      mjs: `${ort}ort-wasm-simd-threaded.asyncify.mjs`,
      wasm: `${ort}ort-wasm-simd-threaded.asyncify.wasm`,
    }
  }
}

export interface BackendInfo {
  webgpu: boolean
  vendor?: string
  architecture?: string
  device?: string
  description?: string
  isFallbackAdapter?: boolean
}

// Which WebGPU adapter is present, so a software one (SwiftShader) is visible in the results.
export async function backendInfo(): Promise<BackendInfo> {
  type Adapter = {
    info?: Record<string, unknown>
    isFallbackAdapter?: boolean
  }
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<Adapter | null> } }).gpu
  if (!gpu) return { webgpu: false }
  const adapter = await gpu.requestAdapter()
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

type Loaded = {
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>
  model: Awaited<ReturnType<typeof AutoModelForImageTextToText.from_pretrained>>
}
let loading: Promise<Loaded> | null = null

// Loads once; later calls reuse it. device is always 'webgpu': there is no WASM fallback.
export function loadModel(): Promise<Loaded> {
  loading ??= (async () => {
    const processor = await AutoProcessor.from_pretrained(MODEL_ID)
    const model = await AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
      device: 'webgpu',
      dtype: { embed_tokens: 'q4f16', decoder_model_merged: 'q4f16', vision_encoder: 'q4f16' },
    })
    return { processor, model }
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

// Pulls the entries out of the model's text. Strips code fences, takes the first JSON array and
// reads each top-level object in it on its own, so one malformed or truncated entry does not
// lose the others. Entries without a string label or four finite numbers for the box are
// dropped; a missing value becomes ''; coordinates are clamped to 0..1 and ordered.
export function parseFields(text: string): FieldBox[] {
  const s = text.replace(/```[a-zA-Z]*/g, '')
  const start = s.indexOf('[')
  if (start < 0) return []
  const objects: string[] = []
  let depth = 0
  let inString = false
  let escaped = false
  let objStart = -1
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '[' || c === '{') {
      if (c === '{' && depth === 1) objStart = i
      depth++
    } else if (c === ']' || c === '}') {
      depth--
      if (c === '}' && depth === 1 && objStart >= 0) {
        objects.push(s.slice(objStart, i + 1))
        objStart = -1
      }
      if (depth === 0) break
    }
  }
  const out: FieldBox[] = []
  for (const o of objects) {
    let v: unknown
    try {
      v = JSON.parse(o)
    } catch {
      continue
    }
    if (typeof v !== 'object' || v === null) continue
    const r = v as Record<string, unknown>
    const b = r.bbox
    if (typeof r.label !== 'string' || !Array.isArray(b) || b.length !== 4) continue
    if (!b.every((n) => typeof n === 'number' && Number.isFinite(n))) continue
    const [a, c, d, e] = (b as number[]).map(clamp01)
    const bbox: Box = [Math.min(a, d), Math.min(c, e), Math.max(a, d), Math.max(c, e)]
    const value =
      typeof r.value === 'string' ? r.value : typeof r.value === 'number' ? String(r.value) : ''
    out.push({ label: r.label, value, bbox })
  }
  return out
}

export async function predictFields(pageImage: Blob, fields: string[]): Promise<FieldBox[]> {
  const { processor, model } = await loadModel()
  const messages = [
    {
      role: 'user',
      content: [{ type: 'image' }, { type: 'text', text: buildPrompt(fields) }],
    },
  ]
  const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true })
  const image = await RawImage.fromBlob(pageImage)
  const inputs = await processor(image, prompt, { add_special_tokens: false })
  const outputs = await model.generate({
    ...inputs,
    max_new_tokens: MAX_NEW_TOKENS,
    do_sample: false,
  })
  const promptLength = inputs.input_ids.dims.at(-1) as number
  const decoded = processor.batch_decode(
    (outputs as Tensor).slice(null, [promptLength, null] as unknown as number[]),
    {
      skip_special_tokens: true,
    },
  )
  return parseFields(decoded[0])
}
