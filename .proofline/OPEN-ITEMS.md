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

## O8. TS-14 is not tested in Firefox or Safari

Opened 2026-10-28. Answers: Darren. Blocks: nothing.

TS-14 (region order, return-to-selected doc, Prev/Next doc and `[` `]`, field focus, label-click
jump) was verified in Chromium only, at 86e3b06. Firefox and Safari (WebKit) are untested. Most
at risk: field focus after clicking a box (Safari does not focus buttons on click, so the focus
timing differs) and the `[` `]` keys on non-US keyboard layouts. To test: run the TS-14 checks
(`.proofline/tickets/TS-14-annotate-flow/CHECKS.md`) with the verify skill's `--browser firefox`
and `--browser webkit`, or by hand in each browser.

## O10. Spec and checks for TS-16, Florence-2 boxes with browser LFM values

Opened 2026-10-29. Answers: Darren. Blocks: any TS-16 code.

Combined test: Florence-2 text-line boxes plus browser LFM values, and Florence versus Tesseract
on region crops. Drafted `.proofline/tickets/TS-16-florence-boxes/` (TICKET.md, CHECKS.md).
M1 (synthetic) verified at b7255a7, 2026-10-29: PP-OCRv6 wins (see TICKET.md "M1 results").
Branch `TS-16-florence-boxes`, pushed, not merged. Next: M2, PP-OCRv6 only, on the WSL machine
with `WINDOWS-M2.md`; Darren agrees the M2 checks there first. Follows O4 (TS-12).
