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
Q7 in TICKET.md and agreement of the M1 checks.

## O5. Remove the Indra code TS-11 left on main

Opened 2026-10-28. Answers: Darren. Blocks: nothing, but `public/ort/` (14 MB) ships in every
build until it goes.

TS-11 was dropped after M1 (see ARCHIVE O3). M1's engine, onnxruntime-web, its runtime files and
the model scripts are on main and pushed. Decide what to remove and what to keep (the scorer,
harness and synthetic fixtures could serve later OCR work), then agree the removal's checks.

