// Florence-2-base-ft in the browser (TS-16 M1, dev harness only). Three tasks: text lines with
// boxes (<OCR_WITH_REGION>), plain text (<OCR>) and phrase grounding (<CAPTION_TO_PHRASE_GROUNDING>).
// WebGPU, q4f16, local files only (scripts/fetch-florence.sh); no request leaves the page's
// origin. Model licence: MIT. Florence resizes every input to 768x768, so boxes are fractions of
// the whole image whatever its aspect ratio.
import {
  AutoProcessor,
  Florence2ForConditionalGeneration,
  RawImage,
} from '@huggingface/transformers'
import type { Tensor } from '@huggingface/transformers'
import { configureLocalRuntime } from './lfmVl'
import type { Line } from './matchLines'
import type { Box } from './score'

export const FLORENCE_ID = 'onnx-community/Florence-2-base-ft'
export const FLORENCE_REVISION = 'e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f'
const MAX_NEW_TOKENS = 1024

type FlorenceProcessor = Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> & {
  construct_prompts(text: string): string[]
  post_process_generation(
    text: string,
    task: string,
    size: [number, number],
  ): Record<string, unknown>
}
type Loaded = { processor: FlorenceProcessor; model: Florence2ForConditionalGeneration }
let loadingPromise: Promise<Loaded> | null = null

// Loads once; later calls reuse it. device is always 'webgpu': there is no WASM fallback.
export function loadFlorence(): Promise<Loaded> {
  loadingPromise ??= (async () => {
    configureLocalRuntime()
    const processor = (await AutoProcessor.from_pretrained(FLORENCE_ID)) as FlorenceProcessor
    const model = (await Florence2ForConditionalGeneration.from_pretrained(FLORENCE_ID, {
      device: 'webgpu',
      dtype: {
        vision_encoder: 'q4f16',
        embed_tokens: 'q4f16',
        encoder_model: 'q4f16',
        decoder_model_merged: 'q4',
      },
    })) as Florence2ForConditionalGeneration
    return { processor, model }
  })()
  const p = loadingPromise
  p.catch(() => {
    loadingPromise = null
  })
  return p
}

// Runs one task. `text` is the task token alone, or the task token followed by its input.
async function run(imageBlob: Blob, task: string, text = task): Promise<Record<string, unknown>> {
  const { processor, model } = await loadFlorence()
  const image = await RawImage.fromBlob(imageBlob)
  const inputs = await processor(image, processor.construct_prompts(text))
  const ids = await model.generate({
    ...inputs,
    max_new_tokens: MAX_NEW_TOKENS,
    do_sample: false,
  })
  const decoded = processor.batch_decode(ids as Tensor, { skip_special_tokens: false })[0]
  // Size [1, 1]: the post-processor scales bins by it, so boxes come back as 0..1 fractions.
  return processor.post_process_generation(decoded, task, [1, 1])[task] as Record<string, unknown>
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

// Axis-aligned box around a quad or box given as a flat x,y,x,y,... list, clamped to 0..1.
export function enclosingBox(coords: number[]): Box {
  const xs = coords.filter((_, i) => i % 2 === 0).map(clamp01)
  const ys = coords.filter((_, i) => i % 2 === 1).map(clamp01)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

// Every text line Florence finds, with its box.
export async function ocrWithRegion(image: Blob): Promise<Line[]> {
  const out = (await run(image, '<OCR_WITH_REGION>')) as {
    labels?: string[]
    quad_boxes?: number[][]
  }
  const labels = out.labels ?? []
  const quads = out.quad_boxes ?? []
  return quads.map((q, i) => ({ text: labels[i] ?? '', box: enclosingBox(q) }))
}

export async function ocr(image: Blob): Promise<string> {
  const out = await run(image, '<OCR>')
  return typeof out === 'string' ? (out as string).trim() : ''
}

// Box of the first region Florence grounds the phrase to, or null when it finds none.
export async function ground(image: Blob, phrase: string): Promise<Box | null> {
  const task = '<CAPTION_TO_PHRASE_GROUNDING>'
  const out = (await run(image, task, task + phrase)) as { bboxes?: number[][] }
  const first = out.bboxes?.[0]
  return first && first.length === 4 ? enclosingBox(first) : null
}
