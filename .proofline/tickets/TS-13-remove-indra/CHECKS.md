# tagstrip checks (ticket TS-13-remove-indra)

Agreed with the human on: 2026-10-28

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.

## Checks: M1, removal

### M1-1: Suggest text still reads a scanned region with Tesseract

- Action: run the verify skill's `suggest-text-ocr` journey in Chromium, and the `ocr-harness`
  journey with `--engine tesseract --set synthetic` in Chromium.
- Observable outcome: the journey's text matches and shows the OCR tag; the harness reads at least
  19 of the 20 synthetic crops and offers Tesseract as its only engine.
- Broken by: making Tesseract's `recognize` return empty text.

### M1-2: nothing of onnxruntime ships

- Action: `pnpm run build`, then list `dist/` recursively and read `package.json`.
- Observable outcome: no `ort-wasm*` file and no `.onnx` file anywhere in `dist/`; no
  `onnxruntime-web` in `package.json`'s dependencies.
- Broken by: leaving `public/ort/` in place.

### M1-3: lint, build, test

- Run: pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test
- Observable outcome: exit 0.
- Broken by: any lint error, type error or failing test.

## Known non-failures

<!-- Starts empty. -->

## Changes after a run

- **M1-1**, 2026-10-28, agreed by Darren the same day: the Broken by was "deleting
  `src/lib/ocr/tesseract.ts` along with the Indra files". At 0220ca8 that mutant (6aca53e) stopped
  the whole app loading, because `suggestText.ts` imports the file, so it could not show the check
  catching broken OCR (NOT RUN). Replaced with a break that leaves the app loading and only OCR
  wrong.
