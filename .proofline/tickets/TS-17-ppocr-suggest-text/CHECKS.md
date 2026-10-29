# tagstrip checks (ticket TS-17-ppocr-suggest-text)

Agreed with the human on: 2026-10-29 (Darren), with Q1 and Q2 in TICKET.md.

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.
Timings vary run to run: also `noise-floor-before-credit` (two runs; a field whose verdict changes
is reported as unstable).

No billed checks: everything runs locally.

The OCR harness (`harness/ocr.html`, journey `ocr-harness`) gains `--engine ppocr`, which runs the
app's own engine (`src/lib/ocr/ppocr.ts`), and a Chinese crop set (simplified and traditional, cut
from TS-16's synthetic pages p09 to p12). Scored by the existing OCR scorer.

## Checks: M1 (swap the engine)

### M1-1: lint, build, full test suite (command check)

- Run: pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test
- Observable outcome: all three exit 0.
- Broken by: a type error in `src/lib/ocr/ppocr.ts`.

### M1-2: the pipeline's unit tests (command check)

- Run: pnpm install --frozen-lockfile && pnpm vitest run src/lib/ocr
- Observable outcome: passes. Tests cover the detector postprocess (boxes from a probability map),
  CTC decode (repeats collapsed, blanks dropped), and line order (top to bottom, then left to
  right).
- Broken by: CTC decode not collapsing repeated characters.

### M1-3: Suggest text in three browsers, offline (verifier check)

- Action: via the verify skill, journey `suggest-text-ocr` with `--block-offsite`, in Chromium,
  Firefox and WebKit, from an empty browser, on a built app (`pnpm build`, then `vite preview`),
  not the dev server. Three generated images: English "TAGSTRIP 2026", one simplified Chinese
  line, one traditional Chinese line. Press Suggest text twice on each (first call loads, second
  is timed).
- Observable outcome: each transcription equals the expected text after normalisation; the "OCR"
  tag shows; 0 offsite requests; second call at most 2 s; backend (webgpu or wasm) recorded per
  browser. On "Load the sample document" (text-layer PDF), Suggest text fills from the text layer
  and no model or runtime file is requested.
- Broken by: fetching the recogniser from huggingface.co instead of the app's origin.

### M1-4: accuracy against Tesseract on the synthetic crops, on both backends (verifier check)

- Action: `ocr-harness`, synthetic English crops and the Chinese crops, `--engine ppocr` and
  `--engine tesseract` (today's engine, `eng`, run from the base commit), two runs each. PP-OCRv6
  in Chromium on hardware WebGPU (WSL: `win-chrome.sh` route from TS-16; Mac: Metal), and in
  Firefox (WASM).
- Observable outcome, per engine, backend, language and run: match / wrong / blank, median s per
  region, unstable fields. Judged by the verifier from the counts: on English, PP-OCRv6 matches at
  least as many as Tesseract with no more wrong; on Chinese, at least 80% match and at most 10%
  wrong; at most 2 s per region median once cached; on each backend separately.
- Broken by: skipping the resize of each line to the recogniser's input height.

### M1-5: accuracy on the real set (verifier check, WSL machine only)

- Action: `ocr-harness --set eval` with TS-12 Q2's export and documents, `--engine ppocr` and
  `--engine tesseract` (base commit), two runs, `--block-offsite`, hardware WebGPU route.
- Observable outcome: counts only (match / wrong / blank, median s per region, unstable ids,
  skipped). Judged: PP-OCRv6 matches at least as many as Tesseract `eng` with no more wrong, at
  most 2 s per region. No text, no filenames, no screenshots.
- Broken by: passing the whole page to the engine instead of the region's crop.
