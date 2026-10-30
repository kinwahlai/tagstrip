# tagstrip checks (ticket TS-18-suggest-hotkey)

Agreed with the human on: 2026-10-30

Key: Ctrl+Alt+S (Ctrl+Option+S on Mac), per TICKET.md "Decided".

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.

## Checks: M1

### M1-1: key reaches the selected region, from inside its field (command check)

- Run: pnpm install --frozen-lockfile && pnpm vitest run src/components/canvas/RegionList.test.tsx
- Observable outcome: passes, including tests that (a) Ctrl+Alt+S with focus in the selected
  region's field calls `onSuggestText` once with that region's id, also when `e.key` is `ß` (Mac
  Option); (b) with no region selected it is never called; (c) a second press while the first is
  running does not call it again; (d) Ctrl+S, Alt+S and bare `s` do not call it; (e) after it
  resolves, focus is still in that field.
- Broken by: matching `e.key === 's'` instead of the physical key, so (a) fails for the Mac `ß`
  case.

### M1-2: same text as the button, and it survives reload (verifier check)

- Action: Chromium via the verify skill, fresh profile. Load the bundled sample (`northgate-energy-statement.pdf`, text layer) and an
  image page from `test-fixtures/ocr-pages-zh/`. On each, draw a region over a known line;
  leave focus where it lands; press Ctrl+Alt+S (Ctrl+Option+S on Mac). Then draw a second region over the same line,
  click Suggest text. Reload the page.
- Observable outcome: the hotkey region's text equals the button region's text, character for
  character, and equals the fixture's known line (wrong text counted apart from blank). The
  button showed "Suggesting…" during the hotkey run, and focus is still in the hotkey region's
  field when the text arrives (typing one character appends to it). Both texts and the OCR tag (image page) are
  still there after reload.
- Broken by: the hotkey path skips `applySuggestedText`, so the text is never stored.

### M1-3: does nothing where it must not (verifier check)

- Action: same session. (a) Press Ctrl+Alt+S with no region selected. (b) Open a document
  imported without its source and select a region; press it. (c) Press a label letter key and
  `]` with focus outside the field.
- Observable outcome: (a) and (b) change no region's text and run no OCR (no "Suggesting…");
  (b) still shows the existing unavailable reason. (c) label switch and next-doc still work.
- Broken by: the hotkey runs on the first region when none is selected.

### M1-4: lint, build, full test suite (command check)

- Run: pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test
- Broken by: any lint, type or test failure.

## Known non-failures

## Changes after a run

- 2026-10-30, approved by Darren. M1-2 Broken by was "the hotkey calling `suggestText` directly
  without `applySuggestedText`, so the text shows but is not stored". The mutant built to it
  (DOM value only) never showed the text, because React re-renders the field; the check still
  failed on it. Reworded to what the mutant does. Check unchanged.
- 2026-10-30, approved by Darren. M1-3 Broken by was "dropping the `suggestUnavailableReason`
  check from the hotkey path". That mutant survived: with no source pixels, Suggest text ends
  silently, so nothing visible changes. Guard kept (it matches the disabled button). New Broken
  by targets M1-3(a), which the check can see. Check unchanged; to be seen failing again.
