# tagstrip checks (ticket TS-16-florence-boxes)

Agreed with the human on: 2026-10-29 (M1)

Changed 2026-10-29 before any run, agreed by Darren: PP-OCRv6 small added beside Florence-2;
Chinese synthetic pages (simplified, traditional) added; Chinese bar for the Tesseract
comparison. See TICKET.md "Changes agreed".

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.
Output varies run to run: also `noise-floor-before-credit`.

No billed checks: models run locally once downloaded.

## Checks: M1 (synthetic set)

### M1-1: matcher and scorer (command check)

- Run: pnpm install --frozen-lockfile && pnpm vitest run src/lib/predict
- Observable outcome: passes. Matcher tests cover: exact line, value contained in a longer line,
  near match within the threshold, value split over two adjacent lines (union box), no match
  (no box, scored a miss).
- Broken by: the matcher always returning the first line's box.

### M1-2: lint, build, full test suite (command check)

- Run: pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test
- Observable outcome: all three exit 0.
- Broken by: a type error in the matcher.

### M1-3: the run, in Chrome on hardware WebGPU (verifier check)

- Action: via the verify skill, open the harness on the synthetic pages (8 English plus the
  Chinese ones), models cached, network
  blocked after caching. Run arms A and B for Florence-2 and for PP-OCRv6, arm C, and the region
  comparison (Florence-2, PP-OCRv6, Tesseract with eng, chi_sim, chi_tra), twice.
- Observable outcome: a report with, per model, arm, run and language: box hits at 0.5 (and 0.3), values match /
  wrong / blank, seconds per page or per region, unstable fields; the WebGPU adapter is hardware,
  not a fallback; no network request after caching. Verdicts against the decision rule in
  TICKET.md, read by the verifier from the counts, not taken from the harness's own summary.
- Broken by: shifting every line box (both models) by 0.1 of the page before scoring; arm A box hits must
  drop and the verdict must turn to fail.

## Checks: M2 (real set, PP-OCRv6 only)

Drafted 2026-10-29. Agreed with the human on: (pending; Darren agrees at the start of the Windows
session, before any run)

Runs on Darren's WSL machine, where the real set lives. Real applicants' documents: evidence holds
counts, ids, verdicts, IoUs and times only; no text, no filenames, no screenshots. Eval pages have
language `unknown`, so the Chinese bar is not judged in M2.

### M2-1: lint, build, full test suite at the M2 commit (command check)

- Run: pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test
- Observable outcome: all three exit 0.
- Broken by: a type error in the matcher.

### M2-2: the real-set run, on hardware WebGPU (verifier check)

- Action: via the verify skill's predict-harness journey, set `eval` (TS-12 Q2's export and source
  documents), line model PP-OCRv6, arms A, B and T, models cached, `--block-offsite`, two runs.
  The browser must report a hardware adapter (the RTX 4070), not SwiftShader or another fallback;
  WSL's own Chromium only has SwiftShader (TS-12), so this needs a Windows-side browser.
- Observable outcome: per arm and run, box hits at 0.5 (and 0.3), values match / wrong / blank,
  seconds per page or per region, unstable fields, skipped pages, adapter, offsite request count.
  The verifier judges, from the counts: arm B against the decision rule (box hits at least half,
  wrong at most a fifth, at most 30 s per page, no network once cached); PP-OCRv6 against
  Tesseract on the same crops (matches at least as many, no more wrong, at most 2 s per region).
  Arm A is reported, not judged.
- Broken by: shifting every PP-OCRv6 line box by 0.1 of the page before scoring; arm A box hits
  must drop and the arm B verdict must turn to fail (one run is enough for the mutant).
