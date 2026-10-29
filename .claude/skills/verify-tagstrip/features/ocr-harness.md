# OCR harness (dev-only)

A dev-only page, `/harness/ocr.html`, that runs one OCR engine (`ppocr`, the app's own `ppocrEngine`, the only engine) over a list of crops and shows, per region, an id, a verdict (match, wrong, blank) and a time, plus the counts. It is not part of the built app (`dist/` has no harness file). It never renders or logs OCR text, transcriptions or filenames.

## Sub-features

- synthetic set: the 20 committed English crops in `test-fixtures/ocr-crops/` scored against `expected.json` (lang `en`)
- synthetic-zh set: four Chinese pages `test-fixtures/ocr-pages-zh/p09..p12.png` (p09, p10 zh-Hans; p11, p12 zh-Hant), 17 fields, each cropped from its page by its `expected.json` bbox with the app's `cropPageRegion` and scored (ids `zh-<page>-<n>`)
- eval set: one TagStrip annotations-only export plus the source documents; every annotation with a non-empty transcription is rendered like the app does (PDF via pdf.js at the app's scale, images as-is), cropped with `cropPageRegion`, OCR'd and scored
- scoring: lowercase, keep only letters and digits; equal is match, empty is blank, else wrong
- results JSON in `window.__ocrResults` (ids, lang, verdicts, ms only; per run `summary` and `byLang`; `backend` from `ppocrBackend()` and the WebGPU `adapter` info). eval regions have lang `unknown`. The comparison with the previous engine (TS-17 M1-4, M1-5) is run from the base commit's harness, not this one

## How to get to it

- `http://127.0.0.1:$PORT/harness/ocr.html` on the Vite dev server only (`MODE=dev`, the default of `launch.sh`).
- Controls: select "Engine", select "Set", (eval only) file inputs "Export JSON" and "Source documents" (multiple), button "Run". Status element `#status` has `data-state` of `idle`, `running`, `done` or `error`; results are in `#results`.

## Driving it

```bash
export WORKTREE=/path/to/checkout PORT=5199
S=/home/snaic-darren/projects/tagstrip/.claude/skills/verify-tagstrip/scripts
$S/launch.sh && $S/doctor.sh && $S/pw-install.sh
source $S/env.sh
NODE_PATH=$RUN_DIR/pw/node_modules node $S/drive.mjs --browser chromium --url http://127.0.0.1:$PORT/ \
  --journey ocr-harness --engine ppocr --set synthetic-zh --evidence "$EVIDENCE_DIR" --check-id M1-1
# eval set (real documents, see the rule below), repeat Run twice in one page:
NODE_PATH=$RUN_DIR/pw/node_modules node $S/drive.mjs --browser chromium --url http://127.0.0.1:$PORT/ \
  --journey ocr-harness --engine ppocr --set eval --eval-export <export.json> --eval-docs <folder> \
  --runs 2 --evidence "$EVIDENCE_DIR" --check-id M1-4
```

`--eval-docs` takes a folder, searched recursively (following symlinks); the run refuses a folder where two documents share a filename, since documents are matched by name. Only `.pdf .png .jpg .jpeg .webp` files are attached. Documents are matched to the export by filename. `--runs N` clicks Run N times in the same page and collects each run. `--block-offsite` works as for other journeys (use `--set synthetic --engine ppocr`, expect `blockedCount` 0).

The driver exits 0 when every run reached `data-state=done`; it does not judge the decision rule. Evidence: `<check-id>-ocr-harness-<engine>-<set>-<browser>.json` with `backend`, `adapter` and, per run, the summary (`total`, `match`, `wrong`, `blank`, `medianMs`), `byLang` (the same counts per language), `skipped` (annotations whose document was not supplied) and per-region `id`, `verdict`, `ms`. A screenshot is taken except for `--set eval`.

To check scoring (M1-5), swap two `expected` strings in `test-fixtures/ocr-crops/expected.json`, run, expect exactly those two ids to go from match to wrong, then `git checkout` the file.

## Real data

The eval set is real applicants' documents (`~/projects/pai-extract/...`). The verifier runs it; builders do not. Evidence holds counts, ids (`r001...`), verdicts and times only: no text, no transcriptions, no filenames, no screenshots. The harness and driver already withhold them (the driver also replaces any error text with a generic message for `--set eval`); do not add logging that would not.

## Gotchas

- First run per engine includes a warm-up on a generated image (untimed); model load time is not in the per-region times.
- Input labels are aria-labels on the controls (the visible label text includes the option list, so match with `exact`).
