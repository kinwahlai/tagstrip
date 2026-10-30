# tagstrip checks (ticket TS-19-click-to-box)

Agreed with the human on: 2026-10-30

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.

## Checks: M1

### M1-1: picking the box under a point (command check)

- Run: pnpm install --frozen-lockfile && pnpm vitest run src/lib/clickToBox.test.ts
- Observable outcome: passes. Covers: a point inside a text item returns that item's box (plus
  margin); a point between two items returns nothing; overlapping items pick the smallest; a
  point in a detector line (given boxes, no model) returns that line; a point in no line
  returns nothing.
- Broken by: returning the nearest item when the point is in none (boxes blank space clicks).

### M1-2: text-layer page, right box and right text, survives reload (verifier check)

- Action: Chromium via the verify skill, fresh profile. Load the bundled sample. Select a label.
  Click once inside 3 known text items (one short value, one long line, one near another line).
  Reload. Then Ctrl/⌘+Z on a fresh click.
- Observable outcome: each click makes exactly one region, whose box contains that item's box
  and overlaps no other item's box; its field holds exactly that item's string (wrong counted
  apart from blank); no request to `/ocr/`. All three remain after reload. Undo removes the box.
- Broken by: dropping the margin check so the box takes in the neighbouring item.

### M1-3: image page, box on the clicked line (verifier check)

- Action: same session. Upload `test-fixtures/ocr-pages-zh/p09.png`. Click inside the first 3
  fields' boxes from `expected.json`.
- Observable outcome: each makes one region with IoU >= 0.5 against that field's box and the OCR
  tag; its normalised text equals the field's expected value.
- Broken by: running the detector on the whole page instead of a window around the click.

### M1-4: does nothing where it must not (verifier check)

- Action: same session. (a) Click blank margin. (b) Click with no label selected. (c) Click an
  existing region. (d) Drag a box by hand.
- Observable outcome: (a) and (b) create no region; (c) selects that region and creates none;
  (d) draws the dragged box as before.
- Broken by: creating a region on every click whatever is under it.

### M1-5: lint, build, full test suite (command check)

- Run: pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test
- Broken by: any lint, type or test failure.

## Known non-failures

## Changes after a run
