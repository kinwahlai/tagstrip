# Contributing to TagStrip

Thanks for your interest in contributing! TagStrip is a small, focused tool — please read
[`SPEC.md`](SPEC.md) section 2 for what's explicitly in and out of scope (polygons, whole-document
classification, multi-user/backend features, model-assisted pre-labeling) before proposing a
large feature, so you don't spend time on something that's a deliberate non-goal.

## Development setup

Requires Node.js 20+.

```bash
npm install
npm run dev
```

## Proposing a change

- **Small fixes / clear bugs**: open a PR directly.
- **New features or anything that changes the data model** (`src/db/types.ts`) or the
  import/export formats: please open an issue first to discuss the approach. The schema/project/
  document/annotation model is foundational — changes there ripple through import/export,
  the canvas, and persisted user data, so it's worth agreeing on the shape before writing code.

## Before opening a PR

```bash
npm run lint
npm test
npm run build
```

All three must pass — this is exactly what CI (`.github/workflows/ci.yml`) checks on every PR.
Run `npm run format` first if `npm run lint` or CI flags formatting issues.

If your change affects the annotation canvas (drawing, selection, zoom, or keyboard shortcuts),
please actually exercise it in a browser before opening the PR — that code is interaction-heavy
enough that type-checking and unit tests alone won't catch a broken drag or an off-by-one in the
coordinate math.

## Project structure

```
src/
  components/   # UI components — schema editor, project/document views, annotation canvas
  components/canvas/  # the annotation canvas specifically: drawing surface, toolbar, region list
  db/           # Dexie (IndexedDB) schema (db.ts, types.ts) and typed data-access functions
  lib/          # PDF rendering (pdf.js), geometry math, native + Label Studio export/import
  lib/ocr/      # pluggable OcrEngine interface (types.ts) + the Tesseract.js implementation
  App.tsx       # top-level view switching (Schemas / Projects / annotation canvas) — there's no
                # router; view state is plain useState here since the navigation is shallow
```

- [`SPEC.md`](SPEC.md) — full product spec, data model, and milestone plan
- [`VERIFICATION.md`](VERIFICATION.md) — the acceptance rubric each milestone was checked against
- `VERIFICATION_REPORT.md` / `verification-screenshots/` — the record of those checks actually
  being run, kept in the repo as an audit trail

## Updating OCR language data

`public/tessdata/eng.traineddata.gz` is a static copy of Tesseract's English model, checked in so
OCR works fully offline (no CDN fetch at runtime). It's sourced from the `@tesseract.js-data/eng`
devDependency — run `npm run update-tessdata` after bumping that package to refresh the file.

English-only is deliberate for now, not an oversight — multi-language support (both a language
picker and, separately, combining several languages in one Tesseract pass) was tried and reverted.
The picker mechanism itself worked fine, but two real problems showed up on actual documents: (1)
combining multiple languages in one pass let Tesseract misidentify the script entirely on some
inputs (e.g. Chinese text coming back as Tamil), and (2) even with a single language explicitly
selected, Chinese recognition quality itself was too poor to be useful — the `_best_int` quantized
traineddata used to keep bundle size small trades away far more accuracy for a script with
thousands of character classes than it does for English's ~26 letterforms. Revisiting this would
mean testing the full, non-quantized traineddata (tens of MB instead of ~3MB) before trying to
bring languages back, not just re-adding the picker UI.

## Code style

ESLint (flat config, `eslint.config.js`) and Prettier (`.prettierrc.json`) are the source of
truth — don't hand-format against your own preferences if the tools disagree. Comments should
explain _why_, not _what_; well-named code should make the "what" obvious on its own.

## Reporting issues

Open a GitHub issue with steps to reproduce, expected vs. actual behavior, and your browser
version. For anything involving a specific PDF or image, a minimal reproducing file (with any
sensitive content stripped) is the single most useful thing you can attach.
