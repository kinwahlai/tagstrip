# tagstrip checks (ticket TS-11-indra-ocr)

Agreed with the human on: 2026-10-27

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.
Timing varies run to run: also `noise-floor-before-credit`.

M1 adds a dev-only harness page that runs one engine over a list of crops and prints, per
region, an id, a verdict (match, wrong, blank) and a time: never the text. The synthetic set
lives in `test-fixtures/ocr-crops/` with its expected strings. The evaluation set is Darren's,
outside the repo (TICKET.md Q1). The Indra weights load from a local path outside the repo.

M2 and M3 checks are written before those milestones start.

## Checks: M1, feasibility and measurement

### M1-1: Indra reads the synthetic crops in Chromium

- Action: open the harness in Chromium, choose Indra, run it on the synthetic set.
- Observable outcome: every crop gets a result, and at least 19 of the 20 synthetic crops match
  their expected string.
- Broken by: feeding the recogniser an unnormalised crop (skip the resize-to-model-height step).

### M1-2: Indra runs in Firefox and WebKit

- Action: the same as M1-1, in Firefox and in WebKit.
- Observable outcome: the same verdicts as in Chromium, crop for crop.
- Broken by: requiring a browser feature only Chromium has (for example forcing the WebGPU
  execution provider with no WASM fallback).

### M1-3: no network at run time

- Action: in Chromium, block every request not to the dev server's origin, then run M1-1.
- Observable outcome: the same result as M1-1, and no blocked request is logged.
- Broken by: leaving `onnxruntime-web`'s WASM path at its CDN default.

### M1-4: the comparison run

- Action: run Tesseract, then Indra, each twice, on the evaluation set in Chromium, through the
  harness.
- Observable outcome: a table of matches, wrong values, blanks, unstable regions and median time
  per crop, per engine and run; and the verdict under the TICKET.md decision rule as agreed.
  The evidence holds counts only: no text, no filenames.
- Broken by: scoring Indra's output against Tesseract's instead of against the transcriptions.

### M1-5: the harness scores against the transcriptions

- Action: run the harness's scoring on the synthetic set with one expected string deliberately
  swapped between two crops, then restore it.
- Observable outcome: exactly those two crops turn from match to wrong. The fixture is identical
  to its committed version afterwards.
- Broken by: the scorer counting any non-empty output as a match.

### M1-6: lint, build, test

- Run: `pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test`
- Observable outcome: exit 0.
- Broken by: any lint error, type error or failing test.

## Known non-failures

<!-- Starts empty. -->

## Changes after a run

<!-- Starts empty. -->
