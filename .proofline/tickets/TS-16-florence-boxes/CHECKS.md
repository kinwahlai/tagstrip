# tagstrip checks (ticket TS-16-florence-boxes)

Agreed with the human on: 2026-10-29 (M1)

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

- Action: via the verify skill, open the harness on the 8 synthetic pages, models cached, network
  blocked after caching. Run arms A, B, C and the Tesseract comparison twice.
- Observable outcome: a report with, per arm and run: box hits at 0.5 (and 0.3), values match /
  wrong / blank, seconds per page or per region, unstable fields; the WebGPU adapter is hardware,
  not a fallback; no network request after caching. Verdicts against the decision rule in
  TICKET.md, read by the verifier from the counts, not taken from the harness's own summary.
- Broken by: shifting every Florence box by 0.1 of the page before scoring; arm A box hits must
  drop and the verdict must turn to fail.

## Checks: M2 (real set), written before M2 starts, after Q1
