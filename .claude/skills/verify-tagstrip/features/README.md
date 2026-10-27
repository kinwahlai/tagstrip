# TagStrip feature map

Features: [schemas](schemas.md), [projects-and-documents](projects-and-documents.md), [annotation-canvas](annotation-canvas.md), [suggest-text](suggest-text.md), [import-export](import-export.md), [ocr-harness](ocr-harness.md) (dev-only).

## Baseline state

- A fresh browser context: IndexedDB is empty, so the app opens on the first-run page ("Create your first label schema"). No seed data.
- The app is at `http://127.0.0.1:$PORT/` (default port 5199), launched by `scripts/launch.sh`.
- Bundled sample (public/sample/northgate-energy-statement.pdf, a text-layer PDF): "Load the sample document" on the first-run page builds a schema (5 labels), a project and one document, and opens the canvas.
- Viewport 1440x900 gives the full rail. Narrower widths fold the rail and document list (App.tsx breakpoints), which changes the handles available.

## Driving conventions

- Scripted driver `scripts/drive.mjs`: repeatable runs, all three browsers, `--block-offsite` for network-blocked runs. Fresh context per run.
- Verifier's Playwright MCP (Chromium): exploratory interactive driving of features with no scripted journey yet.
- Handles: accessible names, labels and roles, never coordinates. The one exception is dragging on the page stage, computed from the bounding box of `img[alt="Page 1"]` (the stage element's box).
- WebKit needs a persistent context (the driver does this): an ephemeral WebKit context cannot store Blobs in IndexedDB, so any upload fails there ("Error preparing Blob/File data to be stored in object store"). Inferred to be a Playwright WebKit limitation, not an app bug, because a persistent context passes.

## Reporting proof

Give, per check: the exact command, the exit code, the result line (JSON from the driver), and the evidence file paths. State the commit (from Doctor). A claim without an evidence file is not proof.

## Reporting an unreachable path

Say which path, the attempted command, and the unmet precondition (for example "needs a scanned PDF; none available; attempted: ..."). Never report it as verified through a different path, and never weaken a journey to make it pass.

## Real data

When a check uses real documents (for example `~/projects/pai-extract/samples/...`), evidence and terminal output hold counts, verdicts and hashes only: never extracted text, transcriptions or filenames. Screenshots of real documents are not taken. The driver's JSON already follows this (verdicts, counts, timings); a new journey must too.
