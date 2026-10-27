# Archive

Closed items from `OPEN-ITEMS.md`, newest first, with the reasoning kept whole.

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
