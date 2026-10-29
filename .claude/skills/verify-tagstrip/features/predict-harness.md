# Predict-fields harness (dev-only)

A dev-only page, `/harness/predict.html`, for TS-16: tests text-line boxes from two models with browser LFM values. Line models: **Florence-2-base-ft** (`<OCR_WITH_REGION>`; q4f16 except the decoder, which is q4: the q4f16 merged decoder does not load in this onnxruntime) and **PP-OCRv6 small** (official ONNX detector plus recogniser, our own pipeline in `src/lib/predict/ppocr.ts` on onnxruntime-web, WebGPU with a WASM fallback; the backend actually used is `ppocrBackend` in the results). Arms: **A** each field's true value matched to a line by plain code (`src/lib/predict/matchLines.ts`) gives the box (box only is meaningful); **B** LFM2.5-VL-450M browser values (one call per page, shared by both line models) matched to the same lines for the box (box and value); **C** Florence `<CAPTION_TO_PHRASE_GROUNDING>` with the label name, first box (box only; Florence only); **T** region comparison: on the crop of each true region, Florence `<OCR>`, PP-OCRv6 recogniser and Tesseract (`eng+chi_sim+chi_tra` loaded together) give a value verdict and ms each (OCR scorer). Per field it shows an id (`f001`...), the box verdict (hit at IoU 0.5) with its IoU, and the value verdict (match, wrong, blank); per page the time; per arm and model a summary, and per language (`en`, `zh-Hans`, `zh-Hant`) a summary line, with box hits at 0.5 and at 0.3; and the WebGPU adapter. It counts only and does not judge the decision rule. Not part of the built app (`dist/` has no harness, no `.onnx`, no `predict-models`). It never renders or logs predicted values, transcriptions or filenames.

## Sub-features

- synthetic set: 12 committed pages in `test-fixtures/predict-fields/` (3 to 5 invented fields each, 53 fields; boxes and a `lang` per page in `expected.json`): p01-p08 English, p09-p10 simplified Chinese, p11-p12 traditional Chinese. English by `scripts/make-predict-fixtures.py`, Chinese by `... zh` (macOS Songti SC/TC and Heiti SC/TC fonts)
- eval set: one TagStrip annotations-only export plus the source documents, matched by exact filename; only pages with at least one annotated region are scored; the fields asked for on a page are that page's label names; PDFs are rendered like the app does (pdf.js, scale 2), images as they are
- scoring (`src/lib/predict/score.ts`): box hit when IoU (intersection over union) is at least 0.5 (0.3 also counted, `boxHits03`), per truth region; value verdict (lowercase, letters and digits only; same calendar date; names in either order for labels containing "name"). Arm A's value is the truth and arm C has none, so their `match`/`wrong`/`blank` are null. Arm T uses the OCR scorer (`src/lib/ocrEval/score.ts`).
- "Line model" select: `all` (default), `florence`, `ppocr`; it picks the line models for arms A and B (arm T runs Florence `<OCR>`, PP-OCRv6 and Tesseract, or only the last two when the line model is `ppocr`; `all` leaves arm C out when the line model is `ppocr`).
- "Arm" select: `all` (default; A, B, C, T with `model`; only A, B otherwise), `A`, `B`, `C`, `T`. Florence lines are computed once per page and shared by A and B; arm B `ms` is LFM plus the lines.
- "Predictions" select: `model` (default), `truth` (Florence lines and LFM values are replaced by the ground truth: arms A and B should all hit and match, no model or GPU needed) and `shifted` (every box moved by half its width: every box should be a miss, values unchanged). Arms C and T refuse `truth`/`shifted`. All Florence boxes come from one function, `florenceLines` in `src/harness/predictHarness.ts`.
- results JSON in `window.__predictResults` (`set`, `predictions`, `arm`, `lineModel`, `adapter`, `ppocrBackend`, `runs`: one record per arm (and line model for A and B) per Run click with `run`, `arm`, `model`, `summary`, `byLang`, `skipped`, `pages` with `lang`, `ms` and per-field `id`, `box`, `iou`, `value`; arm T pages hold per-field `verdict` and `ms` per engine (`florence`, `ppocr`, `tesseract`); no text)

## How to get to it

- `http://127.0.0.1:$PORT/harness/predict.html` on the Vite dev server only.
- Precondition for `Predictions = model`: `scripts/fetch-lfm-vl.sh`, `scripts/fetch-florence.sh` and `scripts/fetch-ppocr.sh` have been run once in the checkout (about 345 MB, 235 MB and 60 MB (PP-OCRv6 plus Tesseract eng, chi_sim, chi_tra language data) into the gitignored `predict-models/`, shared with the ONNX Runtime WASM; a fresh worktree needs it again, or a symlink to the main checkout's folder). Without it the run ends in `data-state=error`.
- Controls: select "Set", select "Predictions", select "Arm", select "Line model", (eval only) file inputs "Export JSON" and "Source documents" (multiple), button "Run". `#status` has `data-state` of `idle`, `loading`, `running`, `done` or `error`; on error `data-error` holds the error class name (never the message). `#adapter` shows the adapter; one `p.summary` and one table per arm are in `#results`.

## Driving it

```bash
export WORKTREE=/path/to/checkout PORT=5199
S=$WORKTREE/.claude/skills/verify-tagstrip/scripts
$S/launch.sh && $S/doctor.sh && $S/pw-install.sh
source $S/env.sh
NODE_PATH=$RUN_DIR/pw/node_modules node $S/drive.mjs --browser chromium --url http://127.0.0.1:$PORT/ \
  --journey predict-harness --set synthetic --evidence "$EVIDENCE_DIR" --check-id M1-3 [--arm all|A|B|C|T] [--line-model all|florence|ppocr] [--runs 2] [--headed] [--block-offsite]
# scorer check, no model:
... --journey predict-harness --set synthetic --predictions truth   (then --predictions shifted)
# eval set (real documents, see the rule below), two runs in one page:
... --journey predict-harness --set eval --eval-export <export.json> --eval-docs <folder> --runs 2 --check-id M1-4
```

`--eval-docs` is searched recursively; the run refuses a folder with duplicate filenames. `--runs N` clicks Run N times in one page (the model loads once). `--headed` opens a visible Chromium (needs WSLg or a display). The driver launches Chromium with `--enable-unsafe-webgpu --enable-features=Vulkan` (override with the `WEBGPU_ARGS` environment variable, space-separated). Timeouts are one hour per run. Exit 0 when every run reached `data-state=done`; it does not judge the decision rule. Evidence: `<check-id>-predict-harness-<set>-chromium.json` (per run, per arm: summary, `skipped`, pages with `ms` and per-field verdicts; plus `adapter`), and a `.png` only for `--set synthetic`. `--block-offsite` lists any request that left the origin in `<check-id>-blocked.txt`; M1-2 expects `blockedCount` 0 and the same verdicts as the unblocked run.

## Adapter caveat

Read `adapter` in the evidence. `isFallbackAdapter: true` / architecture `swiftshader` is a software adapter: it does not support shader f16, so the q4f16 models fail there (run ends `data-state=error`). Never report a SwiftShader run as a WebGPU pass. PP-OCRv6 reports its own backend (`ppocrBackend`); a `wasm` there is not a WebGPU result. On macOS the driver passes `--enable-unsafe-webgpu --use-angle=metal --ignore-gpu-blocklist`, which gave a hardware Metal adapter headless (the Vulkan flag gave SwiftShader); elsewhere `--enable-features=Vulkan`. Override with `WEBGPU_ARGS`. Report the adapter either way.

## Real data

The eval set is real applicants' documents (`~/projects/pai-extract/...`). The verifier runs it; builders do not. Evidence holds counts, ids, verdicts, IoUs and times only: no text, no filenames, no screenshots. The harness, driver and Python reference already withhold them; do not add logging that would not.

## Gotchas

- First `Run` includes model load and an untimed warm-up on the first page; load time is not in the per-page times.
- Input labels are aria-labels on the controls; match with `exact`.
- transformers.js 4.3.1 skips its local-file check when `localModelPath` is an absolute http(s) URL, so the harness uses an origin-relative path; do not "tidy" it.
