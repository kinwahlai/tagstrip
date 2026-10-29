# TS-17: Suggest text reads with PP-OCRv6 instead of Tesseract

## What is asked, and by whom

Asked by Darren, 2026-10-29, after TS-16 M2: "ok. i agree - we addopt pp-ocr for suggest text."
His reasons for replacing Tesseract (TS-16, "Changes agreed"): it does not read Chinese, and it is
slow.

## Why, from the measurements

Same crops, same scorer (TS-16, branch `TS-16-florence-boxes`):

- **Real set (M2, 168 regions, WSL, RTX 4070):** PP-OCRv6 128 match / 31 wrong / 9 blank, 12 ms
  per region; Tesseract (eng+chi_sim+chi_tra) 114 / 43 / 11, 58 ms.
- **Synthetic (M1, Mac):** PP-OCRv6 en 36/36, zh 17/17, 0 wrong, 10 ms; Tesseract en 36/36,
  zh 9/17, 44 ms.

Both were measured on WebGPU. **PP-OCRv6 on WASM (no GPU) has not been measured** for speed or
accuracy; Firefox and Safari users will mostly be on WASM.

## Facts (read 2026-10-29)

- PP-OCRv6 small: PaddlePaddle, **Apache-2.0**, official ONNX. Detector 9.9 MB, recogniser 21.2 MB;
  one recogniser reads English, simplified and traditional Chinese.
- The pipeline (detector postprocess, crop, CTC decode, WebGPU with WASM fallback) exists only in
  TS-16's harness: `src/lib/predict/ppocr.ts` and `ppocr.test.ts`, on the unmerged TS-16 branch.
- It needs onnxruntime-web; its WebGPU build uses `ort-wasm-simd-threaded.asyncify.wasm` (25.6 MB).
  TS-13 removed onnxruntime-web and `public/ort/` from main because nothing used them.
- Today Suggest text uses the text layer first, then Tesseract `eng` from `public/tessdata/`
  (`src/lib/ocr/tesseract.ts`, behind the `OcrEngine` interface in `src/lib/ocr/types.ts`).
- `SPEC.md` section 2 names Tesseract.js as the default engine; section 6 says fully offline-capable
  after first load, no CDN at run time.

## Scope

**In:** a PP-OCRv6 `OcrEngine` for Suggest text, the model and runtime files served from the app's
own origin, the OCR harness gaining `--engine ppocr` and a Chinese crop set (to measure the app's
engine), the verify skill's Suggest text journey and feature map, `SPEC.md` sections 2 and 6
wording, README and CONTRIBUTING mentions.

**Out:**
- Predicting fields or drawing boxes (TS-12, TS-16). Reason: a separate decision, not taken.
- A language picker. Reason: one recogniser reads all three scripts.
- O6 (the OCR tag on empty text). Reason: its own item.
- What happens to the TS-16 branch. Reason: Darren decides separately (Q5).

## Milestones

- **M1. Swap the engine.** PP-OCRv6 behind `OcrEngine`, files served locally, Tesseract handled
  per Q2, docs updated. Checkpoint: proposed yes, since it is code Darren has not seen.

## Design

- Copy the PP-OCRv6 pipeline and its tests from TS-16 into `src/lib/ocr/ppocr.ts` as an
  `OcrEngine` (`recognize(crop)`: detect lines in the crop, read each, join top to bottom). Do not
  merge TS-16: its Florence-2 and LFM code are not wanted on main.
- Load lazily on the first OCR call, as Tesseract does now; the text-layer path fetches nothing.
- WebGPU first, WASM if a session cannot be created there (as in TS-16).

## Falsification tests

- **WASM is fast and accurate enough for browsers without WebGPU.** Shown wrong if, on the WASM
  backend, the synthetic crops take more than 2 s per region (median, once cached) or score below
  Tesseract. Then keeping Tesseract for non-WebGPU browsers is the next decision, with Darren; not
  a pass.
- **The app's crops match the harness's.** Shown wrong if the app engine scores below TS-16's
  harness on the same synthetic crops. Check the crop handed over first (scale, padding in
  `src/lib/ocrCrop.ts` against the harness's `cropOf`) before blaming the model.

## Open questions (Darren answers)

- **Q1. Where the files come from.** About 57 MB: models 31 MB plus the onnxruntime WASM 25.6 MB.
  Recommend: serve them from the app's origin, downloaded at build time by a pinned script with
  hashes (`pnpm build` and CI run it), not committed to git, with the Apache-2.0 licence copied
  alongside. Fetched only on the first OCR call and cached by the browser. Keeps section 6
  (offline after first load); TS-12's "download from Hugging Face" exception was for a 315 MB
  opt-in model. **Unconfirmed:** where TagStrip is hosted and whether it caps file or site size.
  Blocks: M1.
- **Q2. Tesseract.** Recommend: remove it (engine, dependencies, `public/tessdata/`,
  `update-tessdata`) in M1, unless M1-4 shows WASM fails the bar (falsification test 1). Blocks:
  M1.
- **Q3. M1 a checkpoint?** Recommend yes. Blocks: nothing.
- **Q4. The real-set check (M1-5)** runs on the WSL machine only. Recommend yes: it is the one check
  of the app's own engine against real ground truth. Blocks: M1 done.
- **Q5. The TS-16 branch.** Merge, keep parked, or close. Not this ticket's decision. Blocks:
  nothing.
