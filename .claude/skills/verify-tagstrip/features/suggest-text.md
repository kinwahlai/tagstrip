# Suggest text

For a drawn region, the "Suggest text" button fills its transcription. The text layer is tried first (exact, free); only if it yields nothing does it crop the region and run PP-OCRv6 OCR in the tab (English and Chinese; onnxruntime-web on WebGPU, falling back to WASM; model and runtime files served from the app's own origin under `ocr/`, fetched at build time). Detector finds the lines in the crop, the recogniser reads each, joined in reading order. OCR-filled regions carry an "OCR" tag.

## Sub-features

- text-layer: exact extraction on text PDFs, no request to `/ocr/` (model or runtime files)
- ocr-fallback: image pages and scanned PDFs, "OCR" tag shown
- content-type override: per-page select changes the route
- unavailable: disabled with a reason when the export had no source document
- click to box (TS-19): with a label selected, an Alt+click (Option+click on Mac; Playwright: `page.keyboard.down('Alt')`, `page.mouse.click`, `page.keyboard.up('Alt')`) on text (no drag); a plain click only deselects. The panel footer names both shortcuts (Alt+click, Ctrl+Alt+S; Option on Mac) creates a region around it and fills its text. Text-layer pages box the pdf.js item under the click (no `/ocr/` request); other pages run the PP-OCR detector on a full-width strip around the click and box the line under it (OCR tag). Blank spot: no region, a status line under the Suggest text hint says "No text found under the click"
- hotkey (TS-18): Ctrl+Alt+S (Ctrl+Option+S on Mac) runs it on the selected region, from inside its field too; focus stays in the field. No region selected, or unavailable: does nothing

## How to get to it

- Annotation canvas, "Regions on this page" panel: button "Suggest text" beside each region's `Transcription for <label> region` field.
- Keyboard: select a region (drawing one selects it and focuses its field), then Ctrl+Alt+S. In Playwright: `page.keyboard.press('Control+Alt+KeyS')`. The app matches `e.code === 'KeyS'`, not `e.key`. Not wired into `drive.mjs`; drive it by hand in the session.

## Driving it

Scripted journey `suggest-text-ocr`, from an empty browser. Use `MODE=preview` for checks on the built app:

```bash
export WORKTREE=/path/to/clean/worktree PORT=5199
S=/home/snaic-darren/projects/tagstrip/.claude/skills/verify-tagstrip/scripts
MODE=preview $S/launch.sh && $S/doctor.sh && $S/pw-install.sh
source $S/env.sh
NODE_PATH=$RUN_DIR/pw/node_modules node $S/drive.mjs --browser chromium --url http://127.0.0.1:$PORT/ \
  --journey suggest-text-ocr --case all --block-offsite --evidence "$EVIDENCE_DIR" --check-id adhoc
```

`--case en|zh-Hans|zh-Hant|all|text-layer` (default `all` = the three OCR cases). Per OCR case it creates (once) schema "verify schema" with label "field", a project "verify project <case>", uploads the page (`en`: generated PNG "TAGSTRIP 2026"; `zh-Hans`: `test-fixtures/ocr-pages-zh/p09.png`; `zh-Hant`: `p11.png`), draws a region over the text (Chinese: the first field's box from `expected.json`), presses "Suggest text", waits for the field to fill, clears the field and presses it again. Assertion: every case's normalised transcription (lowercase, letters and digits of any script) equals the expected value and the OCR tag shows. JSON per case: `match`, `ocrBadgeShown`, `firstMs` (loads the engine), `secondMs` (the timed call), `backend` (`webgpu` or `wasm`, read from `window.__ocrBackend`, which the OCR branch of `suggestText` sets). WSL Chromium has no WebGPU, so expect `wasm` there.

`--case text-layer`: loads the sample document (text-layer PDF), draws a region over text, presses "Suggest text". Expected: the field fills, no "OCR" tag, and `ocrRequestCount` 0 (no request whose path contains `/ocr/`). Region position over the sample's text is inferred; if it fills nothing, adjust the box in `textLayerCase`.

## Gotchas

- First OCR call loads the engine and model (about 57 MB from the app's origin; the browser caches them); allow up to the driver's 180 s timeout on a slow host.
- OCR output can differ in case or punctuation, hence the normalised comparison. A real mismatch is a finding; do not change the expected text.
- With `--block-offsite`, `blockedCount` should be 0 (OCR files come from the app's origin). Non-zero is a finding.
- WebKit needs the persistent-context path the driver uses (see README).
- The Suggest text label also appears as a non-button heading in the panel footer; target the button by role.
