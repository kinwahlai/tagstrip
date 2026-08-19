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

`public/tessdata/*.traineddata.gz` are static copies of Tesseract's language models — English,
Chinese (Simplified + Traditional), Malay, Tamil, Thai, and Vietnamese today — checked in so OCR
works fully offline (no CDN fetch at runtime). Each is sourced from the matching
`@tesseract.js-data/<code>` devDependency — run `npm run update-tessdata` after bumping those
packages to refresh all of them.

"Suggest text" runs exactly one Tesseract language per call, picked via the `<select>` in the
canvas sidebar (`BUNDLED_OCR_LANGUAGES` / `DEFAULT_OCR_LANGUAGE`, both in
`src/lib/ocr/languages.ts`) — it does not combine languages. An earlier version tried Tesseract's
multi-language mode (joining several languages with `+` in one pass, auto-detecting per character)
but reverted it after confirming in practice that combining several visually-distinct scripts made
Tesseract misidentify the script entirely on some inputs (e.g. Chinese text coming back as Tamil),
not just misread an ambiguous character within one script. A single explicit language per call is
the only way to guarantee the right model is actually used.

To add another language: install its `@tesseract.js-data/<code>` package as a devDependency, add
it to the `update-tessdata` script in `package.json`, and add `{ code, label }` to
`BUNDLED_OCR_LANGUAGES` in `src/lib/ocr/languages.ts` — it'll show up in the picker automatically.
Each additional language adds to the one-time OCR download for whoever selects it, so weigh that
against how likely it is to actually appear in your documents.

## Code style

ESLint (flat config, `eslint.config.js`) and Prettier (`.prettierrc.json`) are the source of
truth — don't hand-format against your own preferences if the tools disagree. Comments should
explain _why_, not _what_; well-named code should make the "what" obvious on its own.

## Reporting issues

Open a GitHub issue with steps to reproduce, expected vs. actual behavior, and your browser
version. For anything involving a specific PDF or image, a minimal reproducing file (with any
sensitive content stripped) is the single most useful thing you can attach.
