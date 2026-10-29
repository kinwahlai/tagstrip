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
- Before proposing something that sounds like an obvious improvement, skim the git log and
  SPEC.md — some approaches were already tried, reverted, and written up specifically so the next
  pass wouldn't have to rediscover why.

## Development setup

Requires Node.js 20+.

```bash
pnpm install
pnpm run dev
```

`pnpm run dev` and `pnpm run build` first run `scripts/fetch-ocr-assets.sh`, which downloads the OCR
model files (about 31 MB) into `public/ocr/`; it needs network once (see "OCR model and runtime
files" below).

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
  lib/ocr/      # pluggable OcrEngine interface (types.ts) + the PP-OCRv6 implementation (ppocr.ts)
  App.tsx       # top-level view switching (Schemas / Projects / annotation canvas) — there's no
                # router; view state is plain useState here since the navigation is shallow
```

- [`SPEC.md`](SPEC.md) — full product spec, data model, and milestone plan
- [`FORMATS.md`](FORMATS.md) — the native schema-export and project-export JSON shapes
- [`VERIFICATION.md`](VERIFICATION.md) — the acceptance rubric each milestone was checked against
- `VERIFICATION_REPORT.md` / `verification-screenshots/` — the record of those checks actually
  being run, kept in the repo as an audit trail

## Updating pdf.js runtime assets

`public/pdfjs/` is a checked-in copy of four directories from the `pdfjs-dist` package: `wasm/`
(the OpenJPEG, JBIG2 and qcms decoders), `cmaps/` (CJK character maps), `standard_fonts/` and
`iccs/`. pdf.js fetches all of these at runtime and has no default location for them, so
`src/lib/pdf.ts` points `wasmUrl`, `cMapUrl`, `standardFontDataUrl` and `iccUrl` at this folder.

This is not optional polish. Without `wasmUrl`, a PDF whose page images are JPEG 2000
(`/JPXDecode` — common in scanned documents from some notary and government scanners) fails to
decode with `JpxError: OpenJPEG failed to initialize` and renders as a completely blank page, with
no user-visible error. Run `pnpm run update-pdfjs-assets` after bumping `pdfjs-dist`; a stale copy
against a new pdf.js brings that failure straight back.

## OCR model and runtime files

Suggest text runs PP-OCRv6 (Apache-2.0, English and Chinese) through onnxruntime-web. Its model
files and the onnxruntime WASM runtime are served from the app's own origin under `public/ocr/`,
which is gitignored. `scripts/fetch-ocr-assets.sh` downloads the models from Hugging Face at
pinned revisions, checks each against a sha256 pinned in the script, and copies the runtime from
`node_modules`. It runs before `pnpm dev` and `pnpm build` (the `predev` and `prebuild` scripts, so
CI gets it too), so it needs the network once; after that files with the right hash are skipped. To
change a model, change the revision and hash in the script together.

## Code style

ESLint (flat config, `eslint.config.js`) and Prettier (`.prettierrc.json`) are the source of
truth — don't hand-format against your own preferences if the tools disagree. Comments should
explain _why_, not _what_; well-named code should make the "what" obvious on its own.

## Reporting issues

Open a GitHub issue with steps to reproduce, expected vs. actual behavior, and your browser
version. For anything involving a specific PDF or image, a minimal reproducing file (with any
sensitive content stripped) is the single most useful thing you can attach.
