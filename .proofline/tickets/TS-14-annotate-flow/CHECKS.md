# tagstrip checks (ticket TS-14-annotate-flow)

Agreed with the human on: 2026-10-28

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.

All checks run in Chromium through the verify skill, on a fresh browser profile seeded with a
schema of at least 7 labels and a project with at least 3 documents (one multi-page).

## Checks: M1

### M1-1: region list follows schema order, and survives reload

- Action: on one page, draw boxes for schema labels 5, 2, 7, 2 (in that order). Read the
  region list. Reload the browser, reopen the doc, read it again.
- Observable outcome: both reads give labels 2, 2, 5, 7; the two label-2 rows are in draw
  order (first drawn first). Identical order before and after reload.
- Broken by: removing the sort, so the list returns to primary-key order.

### M1-2: Back returns to the doc last annotated, selected and visible

- Action: in a project with enough documents to scroll the list, open doc 1, step with Next
  document to the last doc, press Back (breadcrumb), then repeat with Esc.
- Observable outcome: each time, the project list shows the last doc selected
  (`aria-current="true"`), its detail pane open, and its row inside the visible scroll area.
- Broken by: keeping `selectedDocId` as local state initialised to null.

### M1-3: next document in one step, button and key

- Action: open doc 1 page 1. Click the toolbar's Next document button. Then press `]`. Then `[`.
  On the last document, check the button and press `]`. Then select a region's text field and
  press `]`.
- Observable outcome: doc 2, doc 3, doc 2, each opening at page 1. From page 2 of a multi-page
  document, `]` to a 1-page document shows its page 1 image, and `[` back opens page 1. On the last doc the button
  is disabled and `]` does nothing. With the text field focused, `]` types into the field and
  the document does not change.
- Broken by: wiring `]` to next page instead of next document.

### M1-4: selecting a region focuses and highlights its field

- Action: with 8+ regions on a page (list scrolls), click the bottom-most box on the canvas.
  Type `abc`. Press Esc, press a label hotkey. Then click a region's label in the list; then
  draw a new box.
- Observable outcome: after the canvas click, that region's field is in view, visibly
  highlighted, and focused; `abc` lands in it and is stored (reload shows it). After Esc the
  hotkey switches the active label instead of typing. The list click and the new box each
  focus their own field.
- Broken by: dropping the `focus()` call while keeping the highlight.

### M1-5: lint, build, test

- Run: pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test
- Observable outcome: exit 0.
- Broken by: any lint error, type error or failing test.

### M1-6: clicking a label in the Labels picker jumps to its region's field

Added 2026-10-28 after Darren tried 40d9c9d: clicking a label in the picker only made it the
drawing label. Behaviour agreed by Darren the same day.

- Action: on a page with two regions of label A (drawn first, second) and one of label B, and
  none of label C: click A in the Labels picker, type `x`; click A again, type `y`; click A a
  third time. Click C. Press B's hotkey (after Esc).
- Observable outcome: first click selects the first-drawn A box and focuses its field (`x` lands
  there); second click selects the second A box (`y` lands there); third click wraps back to the
  first A box. Each time A is also the active drawing label. Clicking C makes C active,
  deselects the A box (no field outlined) and focuses no field. B's hotkey makes B active and moves focus to no field.
- Broken by: making a label click only set the drawing label again.

### M1-7: previous document button

Added 2026-10-28, agreed by Darren the same day.

- Action: open doc 2, click the toolbar's "← Prev doc"; on doc 1, check the button.
- Observable outcome: doc 1 opens at page 1; on doc 1 the button is disabled.
- Broken by: wiring "← Prev doc" to the next document.

## Known non-failures

<!-- Starts empty. -->

## Changes after a run

- **M1-3**, 2026-10-28, agreed by Darren the same day: added the page-2-to-1-page-document step.
  The verifier found at 343c4e4 that the page index carried across documents (blank page);
  fixed at 40d9c9d and seen fixed there as an ad-hoc observation. Not yet seen failing as part
  of the check.
- **M1-6**, 2026-10-28, agreed by Darren the same day: clicking a label with no region on the
  page now also deselects the current region. Reason: after trying cec3939, Darren found region A
  stayed selected and focused after clicking such a label.
