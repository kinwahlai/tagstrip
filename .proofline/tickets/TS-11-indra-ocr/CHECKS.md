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
- Broken by: skipping the crop resize only when the browser is not Chromium.

### M1-3: no network at run time

- Action: in Chromium, block every request not to the dev server's origin, then run M1-1.
- Observable outcome: the same result as M1-1, and no blocked request is logged.
- Broken by: loading the onnxruntime-web runtime from an absolute https URL.

### M1-4: the comparison run

- Action: run Tesseract, then Indra, each twice, on the evaluation set in Chromium, through the
  harness.
- Observable outcome: a table of matches, wrong values, blanks, unstable regions and median time
  per crop, per engine and run; and the verdict under the TICKET.md decision rule as agreed.
  The evidence holds counts only: no text, no filenames.
- Control, in the same session: run each engine once more on a temporary copy of the export in
  which two regions' transcriptions are swapped (the copy lives outside the repo and is deleted
  afterwards). For each engine, those two regions are wrong in the control run, and every other
  region has the same verdict as in the normal run.
- Broken by: scoring Indra's output against Tesseract's instead of against the transcriptions.

### M1-5: the harness scores against the transcriptions

- Action: run the harness's scoring on the synthetic set with one expected string deliberately
  swapped between two crops, then restore it.
- Observable outcome: exactly those two crops turn from match to wrong. The fixture is identical
  to its committed version afterwards.
- Broken by: the scorer counting any non-empty output as a match.

### M1-6: lint, build, test

- Run: pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test
- Observable outcome: exit 0.
- Broken by: any lint error, type error or failing test.

## Known non-failures

<!-- Starts empty. -->

## Changes after a run

- **M1-6**, 2026-10-27, agreed by Darren the same day: removed the backticks around the Run
  command. The ledger runs the line literally, so the shell treated the backticks as command
  substitution and exited 127 at 279d796 before running lint. Formatting only; the command is
  unchanged. TS-10 and TS-12 had the same slip and were fixed before any run.
- **M1-2, M1-3, M1-4**, 2026-10-27, agreed by Darren the same day, after the mutant run on
  f210d4b (reports under `.proofline/verification/TS-11-indra-ocr/M1-b9164a9`, `M1-96cd9f2`,
  `M1-c5e8a01`):
  - M1-2's Broken by (force WebGPU) also broke Chromium, so it could not show the check
    separating browsers; replaced with a break that touches only Firefox and WebKit.
  - M1-3's mutant (no `wasmPaths`) survived: the dev server served the runtime locally anyway.
    Running against the production build was considered, but in M1 the Indra engine exists only
    in the dev-only harness, so the agreed fallback Broken by is used instead.
  - M1-4 could not fail: with Indra scored against Tesseract's output it still produced a table
    and a verdict (which flipped to "keep Tesseract"). The swapped-pair control makes a scorer
    that ignores the transcriptions visible.
