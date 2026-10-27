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

Opened 2026-10-27. Answers: Darren. Blocks: any TS-12 code.

Drafted 2026-10-27 as `.proofline/tickets/TS-12-predict-fields/`. Reverses the `SPEC.md`
section 2 exclusion of model-assisted pre-labeling, pending Darren's confirm (Q1). Waiting on Q1 to
Q7 in TICKET.md and agreement of the M1 checks. Q4 and Q5 decided 2026-10-28.

## O6. The OCR tag shows on a region whose OCR returned no text

Opened 2026-10-28. Answers: Darren. Blocks: nothing.

Seen by the TS-13 verifier on mutant d61f1f8 (OCR forced to return empty text): the region kept the
"OCR" tag with an empty transcription. Not checked against the real engine. Decide whether an empty
suggestion should carry the tag.

