# TS-13: remove the Indra code TS-11 left on main

## What is asked, and by whom

Asked by Darren, 2026-10-28 (tracker item O5), after dropping TS-11 over the Indra weights'
licence (`.proofline/ARCHIVE.md` O3). TS-11's M1 merged an Indra engine and onnxruntime-web into
main; nothing in the app uses them, and `public/ort/` (14 MB) ships in every build.

## Decided (Darren, 2026-10-28)

- **Remove**: the Indra engine (`src/lib/ocr/indra.ts`, `indraImage.ts`, `ctc.ts` and their
  tests), the `onnxruntime-web` dependency and its `update-ort-assets` script, `public/ort/`,
  `scripts/fetch-indra-models.sh`, `scripts/indra-reference.py`, and the `indra-models/` lines in
  `.gitignore` (and `.prettierignore` if present). Also every mention of Indra or onnxruntime in
  the verify skill (`SKILL.md`, `features/*.md`, `scripts/*`) and in README, CONTRIBUTING and
  SPEC.md that the TS-11 work added.
- **Keep**: the scorer (`src/lib/ocrEval/`), the dev-only harness with Tesseract as its only
  engine, the synthetic crops in `test-fixtures/ocr-crops/` and `scripts/make-ocr-fixtures.py`,
  and the driver's `ocr-harness` journey. TS-12's measurement needs the same scoring.
- History stays: TS-11's commits, ledger rows and reports are not rewritten or deleted.

## Scope

**Out of scope**: any change to how Tesseract or Suggest text behaves. Reason: this is removal
only.

## Milestones

- **M1. Removal.** One milestone. Checkpoint: no (Darren decides; recommended no, since it only
  deletes code he has already seen built).

## Falsification test

- Removal is complete when a search for `indra` and `onnxruntime` (case-insensitive) over the
  tracked files outside `.proofline/` finds only historical records such as
  `VERIFICATION_REPORT.md`. Run it before calling the removal done.
