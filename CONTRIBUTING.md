# Contributing to TagStrip

Thanks for your interest in contributing! TagStrip is a small, focused tool — please read
[`SPEC.md`](SPEC.md) section 2 for what's explicitly in and out of scope (polygons, whole-document
classification, multi-user/backend features, model-assisted pre-labeling) before proposing a
large feature, so you don't spend time on something that's a deliberate non-goal.

## Working with AI coding agents

This repo is actively built and maintained with the help of AI coding agents (Claude Code). If
you're an agent — or a human directing one — picking up work here, a few pointers before you dive
in:

- **Read `CLAUDE.md` first.** It's the actual working policy for this repo (implement → verify →
  fix, one milestone at a time) and it overrides whatever your default approach would otherwise
  be.
- `SPEC.md` is the product spec and milestone plan; `VERIFICATION.md` is the acceptance rubric
  each milestone is checked against.
- A milestone only counts as done once it's been run in a real browser and checked against
  `VERIFICATION.md` — not because the code looks right on read-through. `VERIFICATION_REPORT.md`
  and `verification-screenshots/` are the record of those runs; keep them, don't delete between
  milestones.
- Before proposing something that sounds like an obvious improvement, skim the git log and this
  file's "Updating OCR language data" section — some approaches (multi-language OCR, for one) were
  already tried, reverted, and written up specifically so the next pass wouldn't have to
  rediscover why.

## Development setup

Requires Node.js 20+.

```bash
pnpm install
pnpm run dev
```

## Proposing a change

- **Small fixes / clear bugs**: open a PR directly.
- **New features or anything that changes the data model** (`src/db/types.ts`) or the
  import/export formats: please open an issue first to discuss the approach. The schema/project/
  document/annotation model is foundational — changes there ripple through import/export,
  the canvas, and persisted user data, so it's worth agreeing on the shape before writing code.

## Before opening a PR

```bash
pnpm run lint
pnpm test
pnpm run build
```

All three must pass — this is exactly what CI (`.github/workflows/ci.yml`) checks on every PR.
Run `pnpm run format` first if `pnpm run lint` or CI flags formatting issues.

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
- [`FORMATS.md`](FORMATS.md) — the native schema-export and project-export JSON shapes
- [`VERIFICATION.md`](VERIFICATION.md) — the acceptance rubric each milestone was checked against
- `VERIFICATION_REPORT.md` / `verification-screenshots/` — the record of those checks actually
  being run, kept in the repo as an audit trail

## Updating OCR language data

`public/tessdata/eng.traineddata.gz` is a static copy of Tesseract's English model, checked in so
OCR works fully offline (no CDN fetch at runtime). It's sourced from the `@tesseract.js-data/eng`
devDependency — run `pnpm run update-tessdata` after bumping that package to refresh the file.

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
