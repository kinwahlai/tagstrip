# TS-11: replace Tesseract with Indra OCR

## What is asked, and by whom

Asked by Darren, 2026-10-27: replace Tesseract.js with Indra OCR as TagStrip's on-device OCR
engine, after Indra beat Tesseract in `~/projects/lfm-extract-test` (experiment 10).

## Decided (Darren, 2026-10-27)

Darren accepted Claude's recommendation on each of Q1 to Q6 below:

- **Evaluation set:** real applicants' marriage documents, used under pai-extract's privacy rule:
  results and terminal output record counts and verdicts only, never a value or a filename.
  - Ground truth: `~/projects/pai-extract/.proofline/ground-truth/pai-extract-marriage-cert-v2-tagstrip-annotations-only.json`,
    the latest TagStrip export (annotations only).
  - Documents: `~/projects/pai-extract/samples/sharepoint/marriage/`.
  - Not used: pai-extract's `ground-truth/heldout/` set, kept unseen for pai-extract's own
    measurements.
- **Tesseract is deleted in M2** if M1 passes; no second engine.
- **Latin only** for M1 and M2; Chinese earns its own milestone.
- **Darren reads the OpenRAIL-M licence before M2.** M1 loads weights from an uncommitted path.
- **Checkpoints: M1 and M2.**
- **The decision rule below is agreed as written**, and is not adjusted after the run.

## What the evidence says so far

From `~/projects/lfm-extract-test/LEARNINGS-ocr-text.md` and `RESULTS.md` (experiment 10,
2026-10-21). Scope of that result, stated plainly:

- **Measured:** whole pages, 9 marriage documents, native ONNX Runtime in Python on 4 CPU threads.
  Indra 0.23 s per page against Tesseract's 1.76; 85/96 ground-truth values found in its text
  against 77/96; it reads Chinese, which Tesseract here does not.
- **Not measured:** anything in a browser; cropped regions (what TagStrip actually OCRs); Indra
  without its language-model decoding; Firefox or Safari.
- **Known limit:** handwriting is weak (garbled on the UK registers; 25% on its own benchmark).

## What exists today

- `src/lib/suggestText.ts`: text layer first; OCR only when that finds nothing. Crops the region
  and calls `tesseractEngine.recognize(crop)`, dynamically imported so OCR assets load only on
  first use.
- `src/lib/ocr/types.ts`: `OcrEngine { name; recognize(Blob): Promise<{ text; confidence? }> }`,
  the interface `SPEC.md` section 2 froze so engines can be swapped without touching callers.
- `src/lib/ocr/tesseract.ts`: English only, `eng.traineddata.gz` (2.8 MB) bundled in
  `public/tessdata/`; all assets local because TagStrip is offline-capable (`SPEC.md` section 6).
  Chinese was tried and reverted for poor quality on the quantized model.

## What Indra is, from its package (indra-ocr 1.1.2, read 2026-10-27)

- Code Apache-2.0. **Model weights OpenRAIL-M**, which carries use restrictions.
- Models are ONNX: `det.onnx` 0.4 MB, `rec.onnx` 5.0 MB (Latin), `rec_world.onnx` 5.6 MB,
  `rec_cjk.onnx` 10.2 MB, `rec_rtl.onnx` 4.8 MB, `order.onnx` 3.0 MB, `orient.onnx` and
  `script.onnx` under 0.4 MB each. Language-model files for decoding: `lm.npz` 15.7 MB,
  `lm_world.npz` 11.6 MB, `lm_cjk.npz` 19.0 MB.
- Around the models is about 5,000 lines of Python (OpenCV pre- and post-processing, CTC and
  language-model decoding, reading order). None of it runs in a browser; it has to be ported.
- `onnxruntime-web` can run ONNX models on WASM in all three browser engines with no WebGPU.
  Unconfirmed for these models until M1 runs them.

## Scope

**In scope**: an Indra engine implementing the existing `OcrEngine` interface, running in the
browser from local assets, becoming what "Suggest text" uses.

**Out of scope**
- Whole-page Markdown, tables, reading order, layout. Reason: TagStrip OCRs a box the user drew;
  layout would be model-assisted pre-labeling, out of v1 scope (`SPEC.md` section 2).
- Any server or Python runtime. Reason: TagStrip has no backend by design.
- Handwriting. Reason: Indra is weak at it too; nothing here would improve it.

## Milestones

Riskiest first. M1 decides whether the rest happens.

- **M1. Feasibility and measurement.** Indra's detection and recognition models run through
  `onnxruntime-web` on region crops, with a TypeScript port of only the steps a crop needs and
  plain CTC decoding. Measured against Tesseract on the same crops under a decision rule written
  before the run. The output is a verdict, not a shipped feature.
- **M2. The engine.** Indra behind `OcrEngine`, assets bundled locally, "Suggest text" uses it,
  Tesseract handled per Q2. Built only if M1 passes.
- **M3. Further work only if M1 shows the need**, such as language-model decoding or the Chinese
  recogniser (Q3).

Checkpoints: M1 and M2 (decided 2026-10-27).

## Open questions

All answered 2026-10-27; see Decided.

- **Q1. Which documents are the evaluation set?** Recommend the marriage documents already
  labelled in TagStrip for lfm-extract-test: their region transcriptions are ground truth at
  exactly the level TagStrip OCRs. They are real personal documents, so they stay where they
  are, never enter this repo or the verifier's evidence, and results record counts only. Darren
  names the export file and documents folder. A small synthetic set, committed, covers the
  checks that need no real data. Blocks: M1-4, M1-5.
- **Q2. Does Tesseract stay as a selectable engine?** Recommend no: if M1 passes, Indra replaces
  it and Tesseract and its assets are deleted in M2. Keeping two engines keeps two sets of assets
  and tests for an engine nobody would pick. Blocks: M2's checks.
- **Q3. Languages.** Recommend Latin only for M1 and M2, matching today. Chinese is the reason
  Indra looked good in lfm-extract-test, but it adds 10 MB (29 MB with its language model), so it
  earns its own milestone once Latin is proven. Blocks: M3.
- **Q4. The licence.** OpenRAIL-M weights in an MIT project, served as static assets. Recommend
  Darren reads the licence before M2 and decides; M1 loads the weights from a local, uncommitted
  path so it ships nothing. Blocks: M2.
- **Q5. Checkpoints.** Recommend M1 (its verdict decides whether M2 exists) and M2 (it changes
  what every user's "Suggest text" returns).
- **Q6. The decision rule's numbers**, below. Darren agrees them before the run, and they are
  never adjusted after it.

## Decision rule for M1 (agreed 2026-10-27)

Scored per region: the engine's text against the human transcription, lowercased with
punctuation and spaces dropped (the same normalisation as experiment 10). Each region is a
match, a wrong value (non-empty, not a match) or a blank.

- **Indra passes** when, in Chromium, it has at least 3 more matches than Tesseract on the
  evaluation set, and no more wrong values than Tesseract.
- **Indra is disqualified** if it fails to run in Chromium, Firefox or WebKit; needs the network at
  run time; or has a median time per crop above 2x Tesseract's in Chromium.
- **If Indra neither passes nor is disqualified**, the answer is "keep Tesseract", and the ticket
  closes with the findings recorded. Language-model decoding (M3) may be proposed then, as a new
  decision with its own rule.

The OCR text should be the same on every run, but timing is not. Each engine runs twice; any
region whose text differs between an engine's two runs is counted as unstable and reported, and
the median times of both runs are given (**noise-floor-before-credit**).

## Falsification tests for the design

- **A crop needs only detection and recognition.** Shown wrong if Indra's match count on crops
  is far below what experiment 10 found on whole pages; then check the earlier stage first
  (crop size and preprocessing) before blaming the model.
- **Plain CTC decoding is enough.** Shown wrong if Indra loses to Tesseract on wrong values;
  that is the case for porting the language model (M3).
- **WASM keeps Firefox and Safari working.** Shown wrong if M1-2 fails in Firefox or WebKit.
  WebKit on Linux approximates Safari; real Safari stays a manual check for Darren before M2.
  Unconfirmed until then.
