# Archive

Closed items from `OPEN-ITEMS.md`, newest first, with the reasoning kept whole.

## O11. TS-17, PP-OCRv6 in Suggest text (closed 2026-10-30)

Darren agreed the M1 checks and Q1, Q2 on 2026-10-29: the PP-OCRv6 files are fetched at build time
and served from the app's origin, not committed; Tesseract is removed. Verified at 84f7ba1, all five
checks pass and count, `ledger.py check --rerun` exit 0; one fix attempt (the verify driver's
region drawing in Firefox, not the app). Darren pushed 84f7ba1 to main on 2026-10-30. Results in
`.proofline/tickets/TS-17-ppocr-suggest-text/TICKET.md`, "M1 results". Not measured: PP-OCRv6 on the
real set without a GPU (Firefox and Safari run it on WASM).

## O9. TS-15, stable document order (closed 2026-10-28)

Done and merged at 44f23bf. Every document list (project list, annotate rail, `[` `]`, both
exports) now sorts by filename in natural order, case ignored, then import time, then id, so the
order no longer changes on reload. Cause was a `createdAt`-only sort, with native import stamping
every doc with the same time, so ties fell to random UUIDs (reproduced: 3 imports, 3 orders).
Native import now keeps the export's order. All four checks pass in Chromium and count. The
command checks' `Run:` lines were fixed after their first run (backticks, missing install), with
Darren's approval. Same-filename tiebreak is unit-tested only. Firefox and Safari untested, as O8.

## O7. TS-14, annotation flow fixes (closed 2026-10-28)

Done and merged at 86e3b06, before the 110-document annotation run. Regions list in schema order;
Back returns to the last document, selected and in view; "← Prev doc" / "Next doc →" and `[` `]`
in the canvas, each document opening at page 1; selecting a box focuses and outlines its field;
clicking a label jumps to that label's boxes in turn, or deselects when it has none. All seven
checks pass in Chromium and count. The verifier caught two defects on the way (returned-to row
not scrolled into view; page index carried across documents) and a stale Esc step in M1-6,
reworded with Darren's agreement. The verify skill was ported to macOS. Firefox and Safari are
untested: O8.

## O5. Remove the Indra code TS-11 left on main (closed 2026-10-28)

Done as TS-13, verified at 3ab54a6 (all three checks pass and count) and merged. Removed the Indra
engine, onnxruntime-web, `public/ort/` and the model scripts; `dist/` went from 28 MB to 14 MB.
Kept the scorer, the Tesseract-only harness and the synthetic crops for later OCR measurement.
The attention review caught a broken engine guard in the harness driver, fixed in 3ab54a6.

## O3. TS-11, replace Tesseract with Indra OCR (closed 2026-10-28: dropped)

Darren dropped TS-11 on 2026-10-28, after M1 and before M2. M1 had passed its agreed decision
rule on 28 real marriage documents (Indra 117 match / 33 wrong / 18 blank against Tesseract
114 / 47 / 7, about 7x faster per crop), verified at 42fd49a and merged.

The reason is the weights' licence (Datalab's modified OpenRAIL-M, read 2026-10-28): redistribution
is allowed, but its use restrictions must bind every TagStrip user, commercial use is barred for
organisations over $20M revenue or funding and for anything competing with Datalab, and its
share-alike clause reaches the Output, which for TagStrip is users' training data. An opt-in,
user-fetched Indra engine was offered and declined. Tesseract stays the engine. The M1 code left on
main is O5.

## O1. Settle the spec through engagement-intake (closed 2026-10-27)

Darren decided, 2026-10-27: `SPEC.md` stands as the spec and is not rewritten into proofline's
template; it was written from his own interviews and ten milestones shipped against it.
`VERIFICATION.md` is frozen as history, and new checks live per ticket under
`.proofline/tickets/`. Two stale pointers in `SPEC.md` (section 8's build note and the Deferred
item's gate) were updated to point at proofline. M10 folder import is the first ticket (O2).
Engagement-intake was not run in full: its client, data-handling and domain-expert steps do not
fit an existing project, and no playbook covers adopting proofline mid-project.
