# TagStrip

A browser-based tool for drawing labeled bounding boxes on document pages (PDFs or images), with
a per-box text transcription field — built for preparing training/test data for
document-understanding pipelines (KYC field extraction, ID parsing, invoice parsing, and similar).

Renders PDFs directly via [pdf.js](https://mozilla.github.io/pdf.js/); no server-side
pre-processing step, and no server at all.

![The TagStrip annotation canvas: the bundled sample document with five labeled regions, the label toolbar along the top, and the region list on the right showing each region's transcription](docs/screenshot.png)

## Everything stays on your machine

TagStrip has no backend. Documents, page images, annotations, and label schemas live in IndexedDB
in your own browser. Nothing is uploaded, because there is nowhere to upload it to.

That makes it usable on material you are not permitted to hand to a third party — customer KYC
packets, identity documents, medical records, anything under NDA. The usual blocker for an
annotation tool is not whether it works, it's whether you're allowed to put the documents in it.

**You can verify this rather than take our word for it.** Load the page once, disconnect from the
network, and keep working — including OCR. pdf.js's worker, the Tesseract worker, its WASM core,
and the English model weights are all served from this app's own origin; tesseract.js normally
pulls those from a CDN and TagStrip deliberately overrides it (see `src/lib/ocr/tesseract.ts`).
Watch the network tab if you'd rather see it directly.

To be exact about the limit: that holds for as long as the tab stays open. There is no service
worker yet, so _reloading_ while disconnected fails — the app's own files have to come off the
network like any other page. Your documents never need it; the app shell still does.

## Why

TagStrip is built for one case: scanned or image-only documents where the transcription itself is
part of what you're labeling, and where the documents are ones you are not allowed to upload
anywhere. That combination rules out a backend, so there isn't one — no account to create, no
server to stand up, nothing to get approved.

It is a small tool, not a platform. If your documents can live on a server, the established
annotation suites will serve you better than this will; they have the team features, the review
workflows and the integrations. TagStrip exists for the case where that option is closed to you.

## Features

- Rectangle (bounding box) annotation, each with an editable **text transcription field**
- User-defined, reusable **label schemas** (name, color, optional 1–9 or 0 hotkey per label) —
  create once, reuse across projects, and export/import a schema on its own to share a label set
  with a team without dragging any documents along
- **Projects**: a project pairs one label schema with a set of uploaded documents and their
  annotations
- PDF and image upload, multi-page documents, with pages rasterized lazily (only when you
  actually view them, not all up front) so large PDFs stay responsive
- **Per-page content-type detection** (`text` / `scanned` / `unknown`), auto-detected from
  pdf.js's text layer at upload time, with manual override, plus a free-form notes field per
  document
- Local persistence via IndexedDB — reload the page, everything's still there
- **Import/export**: a self-describing native JSON format (round-trips a whole project, including
  the source documents), a lightweight standalone schema export/import for sharing just a label
  set, and a best-effort **Label Studio JSON export** — the same shape Label Studio's own JSON
  export produces, so tooling that already reads that format takes TagStrip's output as-is. See
  [`FORMATS.md`](FORMATS.md) for the exact shape of each
- **"Suggest text"** per box: exact text-layer extraction when the page has one (instant, no
  model), falling back to on-device OCR ([Tesseract.js](https://tesseract.projectnaptha.com/),
  English only for now) only when there's no text layer to read from — the OCR engine and its
  language data are self-hosted (no CDN) and only downloaded the first time OCR is actually needed
- Undo/redo, keyboard-driven workflow (hotkeys per label, arrow-key page nav, Delete key), and a
  responsive layout down to phone widths

See [`SPEC.md`](SPEC.md) for the full product spec, data model, and milestone plan, and its
section 2 for what's explicitly out of scope for v1 (polygons, document classification,
multi-user/backend features, model-assisted pre-labeling).

**No data leaves your browser.** Everything — documents, annotations, schemas — lives in
IndexedDB on your machine. Worth knowing if you're annotating sensitive documents.

## Try it without supplying a document

The awkward part of evaluating a tool like this is that the documents worth testing it on are the
ones you are not allowed to hand around. So one ships with it: **Load the sample document** on the
first-run screen builds a label schema, a project and one document, then opens the canvas.

It is a fictional utility bill — imaginary company, imaginary customer, marked SPECIMEN across the
top — with a real text layer, so **Suggest text** demonstrates exact extraction rather than falling
straight to OCR. It is served from the app's own origin like everything else. Its PostScript source
is in [`docs/sample-document.ps`](docs/sample-document.ps) if you want to change it.

## Quickstart

Requires Node.js 20+.

```bash
git clone <this-repo-url>
cd tagstrip
pnpm install
pnpm run dev
```

Then open the printed local URL (typically `http://localhost:5173`) in your browser. Create a
label schema, create a project against it, and upload a PDF or image to start annotating.

## Scripts

| Command                 | What it does                                                           |
| ----------------------- | ---------------------------------------------------------------------- |
| `pnpm run dev`          | Start the local dev server                                             |
| `pnpm run build`        | Type-check and produce a production build in `dist/`                   |
| `pnpm run preview`      | Serve the production build locally, for a final check before deploying |
| `pnpm run lint`         | Run ESLint                                                             |
| `pnpm run format`       | Format the codebase with Prettier                                      |
| `pnpm run format:check` | Check formatting without writing changes (used in CI)                  |
| `pnpm test`             | Run the test suite (Vitest)                                            |

## Build & deploy

TagStrip builds to a static site — no server-side code, so it can be hosted anywhere that serves
static files.

```bash
pnpm run build   # outputs to dist/
pnpm run preview # sanity-check the build locally before deploying
```

Deploy the contents of `dist/` to any static host (GitHub Pages, Netlify, Vercel, S3, or just
open `dist/index.html` directly for fully offline use). `vite.config.ts` sets a relative
(`./`) build base specifically so the same build works unmodified whether it's served from a
domain root or a GitHub Pages project subpath (`https://<user>.github.io/<repo>/`).

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint, tests, and the build on every
push and pull request, and auto-deploys `dist/` to GitHub Pages on every push to `main` — enable
it for your fork/repo under **Settings → Pages → Source: GitHub Actions**.

## Project structure

```
src/
  components/   # UI components (schema editor, project views, annotation canvas)
  db/           # Dexie (IndexedDB) schema and typed data-access functions
  lib/          # PDF rendering, geometry math, import/export, OCR (native + Label Studio + Tesseract)
  App.tsx       # top-level view switching (Schemas / Projects / annotation canvas)
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for more, and [`SPEC.md`](SPEC.md) section 7 for the
suggested full structure.

## Tech stack

React + TypeScript + Vite, Tailwind CSS, Dexie.js over IndexedDB, pdf.js. See
[`SPEC.md`](SPEC.md) section 3 for the full rationale behind each choice.

## Status

Milestones M0–M5 and M4.5 (scaffold, schema management, projects/documents, annotation canvas,
import/export, OCR-assisted transcription, polish) are implemented and verified against
[`VERIFICATION.md`](VERIFICATION.md) — see `VERIFICATION_REPORT.md` for the run-by-run results.
M4.5's Transformers.js/Donut engine (an alternate OCR backend for messier scans, per SPEC.md
section 2) is not yet built — Tesseract.js is the only engine today, behind a pluggable
`OcrEngine` interface a second engine can implement later.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT — see [`LICENSE`](LICENSE).

### Bundled fonts

The interface is set in [Archivo](https://github.com/Omnibus-Type/Archivo) by
Omnibus-Type, under the SIL Open Font License 1.1 — see
[`src/styles/OFL.txt`](src/styles/OFL.txt). The four `.woff2` files in
`src/styles/` are served from this app's own origin rather than a font CDN: a
third-party request would contradict the guarantee at the top of this README on
the very page that makes it. If you redistribute TagStrip, the OFL notice has to
travel with those files.
