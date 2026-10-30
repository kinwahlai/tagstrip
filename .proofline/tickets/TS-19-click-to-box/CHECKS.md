# tagstrip checks (ticket TS-19-click-to-box)

Agreed with the human on: 2026-10-30

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.

## Checks: M1

### M1-1: picking the box under a point (command check)

- Run: pnpm install --frozen-lockfile && pnpm vitest run src/lib/clickToBox.test.ts src/components/canvas/PageStage.test.tsx
- Observable outcome: passes. Covers: a point inside a text item returns that item's box (plus
  margin); a point between two items returns nothing; overlapping items pick the smallest; a
  point in a detector line (given boxes, no model) returns that line; a point in no line
  returns nothing; on the page, an Alt+click with no movement reaches click to box and a plain
  click does not.
- Broken by: returning the nearest item when the point is in none (boxes blank space clicks).

### M1-2: text-layer page, right box and right text, survives reload (verifier check)

- Action: Chromium via the verify skill, fresh profile. Load the bundled sample. Select a label.
  Alt+click (Option+click on Mac) once inside 3 known text items (one short value, one long line, one near another line).
  Reload. Then Ctrl/⌘+Z on a fresh Alt+click.
- Observable outcome: each Alt+click makes exactly one region, whose box contains that item's box
  and overlaps no other item's box; its field holds exactly that item's string (wrong counted
  apart from blank); no request to `/ocr/`. All three remain after reload. Undo removes the box.
- Broken by: dropping the margin check so the box takes in the neighbouring item.

### M1-3: image page, box on the clicked line (verifier check)

- Action: same session. Upload `test-fixtures/ocr-pages-zh/p09.png`. Alt+click inside the first 3
  fields' boxes from `expected.json`.
- Observable outcome: each makes one region with IoU >= 0.5 against that field's box and the OCR
  tag; its normalised text equals the field's expected value.
- Broken by: dropping the gap split, so a caption on the same row is boxed with its value.

### M1-4: does nothing where it must not (verifier check)

- Action: same session. (a) Alt+click blank margin. (b) Alt+click with no label selected. (c) Click an
  existing region. (d) Drag a box by hand. (e) Plain click (no Alt) inside a text item.
- Observable outcome: (a), (b) and (e) create no region; (c) selects that region and creates
  none; (d) draws the dragged box as before.
- Broken by: creating a region on every click whatever is under it.

### M1-6: both shortcuts are named in the panel (verifier check)

- Action: Chromium, open the canvas on any document with its source. Read the panel footer under
  "Suggest text". Repeat with the browser's platform reported as macOS (Playwright user agent or
  `navigator.platform` override) if the run is not on a Mac, or as Windows if it is.
- Observable outcome: the footer shows, without hovering, a line naming Alt+click to box and
  Ctrl+Alt+S to suggest text; on macOS they read Option+click and Ctrl+Option+S.
- Broken by: removing the shortcut line from the footer (tooltip only, as before).

### M1-5: lint, build, full test suite (command check)

- Run: pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test
- Broken by: any lint, type or test failure.

## Known non-failures

## Changes after a run

- 2026-10-30, approved by Darren (amendment after his manual try of 2e6e87b). M1-2, M1-3, M1-4:
  "click" becomes "Alt+click" (Option+click on Mac). M1-4 gains (e): a plain click on text creates
  nothing. M1-1 gains PageStage.test.tsx in its Run line and the Alt-only rule. New M1-6: the
  shortcut hint. All changed checks to be seen failing again.

- 2026-10-30, approved by Darren. M1-3 Broken by was "running the detector on the whole page
  instead of a window around the click". That mutant (b7f8811) survived: `p09.png`'s print is
  large enough to survive the detector's shrink, so whole-page and window give the same boxes.
  M1-3 also failed at b806b99 (field 1 boxed the caption with the date); fixed at da8d7eb by
  splitting the detected line at wide gaps. The new Broken by removes that split. Check
  otherwise unchanged; to be seen failing again.
