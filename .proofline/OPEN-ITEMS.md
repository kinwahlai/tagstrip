# Open items

Open items only. Read this first when coming back cold. A closed item moves to
`ARCHIVE.md` with its outcome and reasoning. Ids are `O<n>`. `M<n>` means a
milestone only, and `S<n>` a standing check.

## O2. Spec and checks for M10, folder import

Opened 2026-10-27. Answers: Darren. Blocks: any M10 code.

Drafted 2026-10-27 as `.proofline/tickets/TS-10-folder-import/` (TICKET.md, CHECKS.md). Waiting
on Darren: open questions Q1 to Q6 in TICKET.md, and agreement of the M1 checks. M10 is not yet in
`SPEC.md`.

## O4. Spec and checks for TS-12, predict fields with boxes

Opened 2026-10-27. Answers: Darren. Blocks: nothing.

Paused 2026-10-28. M1 (in-browser LFM2.5-VL-450M) stopped before verification: the model reads values
but places no boxes, and this WSL Chromium has no hardware WebGPU. Darren's need was met by a private
offline passport pre-label script instead (`~/projects/passport-prelabel/`, WSL machine only).
M1 code is parked on branch `ts-12-predict-fields`. Resume only if the in-app feature is wanted
again; see TICKET.md "Outcome".

## O8. TS-14 and TS-18 are not tested in Firefox or real Safari

Opened 2026-10-28. Answers: Darren. Blocks: nothing.

Run 2026-10-30 at 0315df9, headless Playwright, ad hoc (the checks name Chromium, so no ledger
rows). Report: `.proofline/verification/O8-cross-browser/0315df9/VERIFICATION_REPORT.md`.

- **WebKit 2336: pass**, TS-14 M1-1, 2, 3, 4, 6, 7 and TS-18 M1-2, M1-3. Field focus after a real
  click on a box works; `[` `]` switch docs, and type into a focused field instead.
- **Firefox 1538: not run.** It does not launch on this Mac (macOS 27.0.1):
  `sandbox_extension_issue_file_to_process ... Operation not permitted`, then a launch timeout.
  Same from Darren's own Terminal, so not the Claude Code sandbox. Needs another machine, an older
  macOS, or a newer Playwright Firefox.
- **Still untested**: real Safari (WebKit is its engine, not its focus behaviour), and `[` `]` on
  non-US keyboard layouts (the code matches `e.key`; Playwright types US only).

## O10. TS-16, Florence-2 and PP-OCRv6 boxes with browser LFM values

Opened 2026-10-29. Answers: Darren. Blocks: nothing.

Shelved 2026-10-30. Darren still wants prediction with automatic boxes in future. M1 (synthetic)
verified at b7255a7: PP-OCRv6 beat Florence-2 on boxes. M2 (real set, 168 fields on 34 pages,
Windows Chrome with hardware WebGPU) verified at c0ef9bf: with LFM values, boxes hit 14/168 and
values were wrong on 133/168, so it fails its rule; mostly the value model is what fails. Even with
true values, boxes hit only 65/168 at the 0.5 threshold. The PP-OCRv6 finding went to main as TS-17. All work,
including the ticket folder and `WINDOWS-M2.md`, is on branch `TS-16-florence-boxes` (pushed, not
merged); resume from its TICKET.md "M2 results". Next decision if resumed: the value model. Follows
O4 (TS-12).

## O13. Typing in an OCR-filled field removes its OCR tag

Opened 2026-10-30. Answers: Darren. Blocks: nothing.

Seen by the TS-18 verifier in Chromium: after typing one character into an OCR-filled field, the
"OCR" tag is gone. Deliberate in the code: `updateAnnotationText` (`src/db/annotations.ts:47`)
clears `ocrSuggested` on every hand edit, with a comment saying so. Decide whether a corrected OCR
suggestion should keep the tag (it would then mean "OCR ran", as O6 decided for empty results), or
lose it (it means "text is OCR's, unedited").

## O15. TS-19 follow-ups: strip size unproven, two small UI gaps

Opened 2026-10-30. Answers: Darren. Blocks: nothing.

- The detector strip around an Alt+click (full width, a tenth of the page tall) is unproven: on
  `p09.png` a whole-page detector gave the same boxes, because its print is large. Needs a page with
  small print to show the strip matters.
- The "No text found under the click" note stays on screen until the next Alt+click.
- The empty regions panel says "drag on the page to draw one" and does not mention Alt+click.
- Untested: Firefox, WebKit, Linux desktops that take Alt+drag, a line longer than the page width.
