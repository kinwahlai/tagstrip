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

## O6. The OCR tag shows on a region whose OCR returned no text

Opened 2026-10-28. Answers: Darren. Blocks: nothing.

Seen by the TS-13 verifier on mutant d61f1f8 (OCR forced to return empty text): the region kept the
"OCR" tag with an empty transcription. Not checked against the real engine. Decide whether an empty
suggestion should carry the tag.

## O8. TS-14 is not tested in Firefox or Safari

Opened 2026-10-28. Answers: Darren. Blocks: nothing.

TS-14 (region order, return-to-selected doc, Prev/Next doc and `[` `]`, field focus, label-click
jump) was verified in Chromium only, at 86e3b06. Firefox and Safari (WebKit) are untested. Most
at risk: field focus after clicking a box (Safari does not focus buttons on click, so the focus
timing differs) and the `[` `]` keys on non-US keyboard layouts. To test: run the TS-14 checks
(`.proofline/tickets/TS-14-annotate-flow/CHECKS.md`) with the verify skill's `--browser firefox`
and `--browser webkit`, or by hand in each browser.
