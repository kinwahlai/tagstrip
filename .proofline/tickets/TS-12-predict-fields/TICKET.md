# TS-12: predict fields, with boxes, on the current page

## What is asked, and by whom

Asked by Darren, 2026-10-27. On the annotation canvas, on any page of a document, a "Predict
fields" button runs a vision-language model in the browser with a prompt and the project's label
schema. The model returns each field's value and its box; TagStrip draws the boxes as regions
and puts each value into the region's transcription field. Darren: "auto drawing box with
prediction is something i always wanted to do."

## Decided (Darren, 2026-10-28)

- **The licence (Q5).** LFM Open License v1.0, read 2026-10-28: Apache-style redistribution with a
  copy of the licence; no terms on Output; no competitor clause; commercial use licensed only for an
  organisation (with its affiliates) under $10M annual revenue (section 5). Darren: TagStrip is
  open source, and an organisation over the threshold takes that up with Liquid AI itself.
- **The model is never bundled (Q4).** Each user downloads it from Hugging Face on first use of
  "Predict fields", after TagStrip shows its size and the LFM licence; it is cached in the browser.
  TagStrip does not redistribute it. This is a deliberate exception to the offline-capable rule
  (`SPEC.md` section 6), for this opt-in feature only.
- **Opt-in and additive.** Tesseract, Suggest text and manual annotation are unchanged by this
  ticket.
- **M3 (Indra refinement) is dropped**, with TS-11 (`.proofline/ARCHIVE.md` O3).

## The scope change this needs

`SPEC.md` section 2 lists, under "Explicitly out of scope for v1": "Model-assisted pre-labeling
(auto-drawing boxes, not just reading text inside ones you drew)". This ticket reverses that.
Darren confirms the reversal (Q1), and `SPEC.md` is edited to record it with the date before any
M2 code.

## What the evidence says so far

From `~/projects/lfm-extract-test` (experiment 1, 2026-10-21) and the model cards on Hugging Face
(read 2026-10-27).

- **Tested in lfm-extract-test:** `LiquidAI/LFM2.5-VL-450M-Extract`, PyTorch on GPU, marriage
  fields on the right page: 1/6 and 0/6 on the single documents tried, with invented fields.
  `LFM2.5-VL-1.6B-Extract` reached 32/54 at best. No model was ever asked for boxes.
- **`LiquidAI/LFM2.5-VL-450M` (the base model, not `-Extract`)**: official ONNX builds
  (`LiquidAI/LFM2.5-VL-450M-ONNX`, `onnx-community/LFM2.5-VL-450M-ONNX` for transformers.js),
  a WebGPU browser demo, and bounding-box prediction from a prompt, returning
  `[{"label", "bbox": [x1, y1, x2, y2]}]` normalised to 0..1. Its card says it is "not
  well-suited for knowledge-intensive tasks or fine-grained OCR".
- **`-Extract`** has no official ONNX build (one community conversion) and its card does not
  mention boxes. So M1 uses the base model.
- **Size, onnx-community build, q4f16:** decoder 221 MB, embeddings 39 MB, vision encoder 55 MB,
  about 315 MB in all. Expected to need WebGPU to be usable; unconfirmed until M1 runs it.
- **Licence:** LFM Open License v1.0, not MIT. Not yet read.

## How it relates to TS-11

TS-11 reads text inside a box the user drew and returns no boxes. Indra itself returns line boxes
when run on a whole page. A later milestone here could use that to tighten the model's rough box
and re-read its value accurately; that depends on TS-11's engine shipping and is not in M1.

## Scope

**In scope**: the "Predict fields" button, an in-browser VL model, predicted regions drawn on the
page with their values, and a way for the user to accept, fix or discard each one.

**Out of scope**
- Predicting across all pages of a document at once. Reason: not asked; one page at a time keeps
  the cost and the review small. Page choice was hard in lfm-extract-test (experiments 2 and 3).
- Any server, hosted API or Python runtime. Reason: TagStrip has no backend by design.
- The `-Extract` variant. Reason: no official browser build, and no box output stated.

## Milestones

Riskiest first. M1 decides whether the rest happens.

- **M1. Feasibility and measurement.** A dev-only harness runs LFM2.5-VL-450M (onnx-community
  build, q4f16, transformers.js, WebGPU) in Chromium on labelled pages, one call per page, asking
  for each schema field's value and box. Scored against Darren's labelled regions under a rule
  agreed before the run. A reference run of the same model, prompt and pages in Python on the GPU
  separates "the browser port is wrong" from "the model cannot do it". The output is a verdict.
- **M2. The button.** Only if M1 passes: "Predict fields" on the canvas, predicted regions shown
  as unconfirmed until accepted, the model downloaded and cached on first use per Q4.
- **M3.** Dropped 2026-10-28 with TS-11.

Checkpoints: Darren decides (Q6).

## Open questions

Each carries Claude's recommendation; Darren answers.

- **Q1. Reverse the section 2 exclusion?** Recommend yes, worded narrowly: "predicting the
  labelled fields on one page, as unconfirmed regions the user accepts". Blocks: M2.
- **Q2. Evaluation set.** Recommend the same labelled marriage documents as TS-11 Q1, on the page
  each was annotated on, with the same handling: real documents stay outside the repo, results
  record counts only. Blocks: M1-3, M1-4.
- **Q3. How predictions are stored.** Recommend each predicted region carries a flag until the
  user accepts it, exports leave out unaccepted predictions, and accepting is one action per
  region. TagStrip's output is ground truth, and lfm-extract-test showed these models return real
  values from the wrong field, the kind of error a quick review accepts. Blocks: M2.
- **Q4. Where the 315 MB model comes from.** Recommend downloaded from Hugging Face on first use
  and cached in the browser, with the size shown before the download starts. Bundling it would
  make every deploy 315 MB larger. This is a deliberate exception to the offline-capable rule
  (`SPEC.md` section 6), so Darren decides. M1 loads from a local path. Blocks: M2.
- **Q5. The licence.** Darren reads the LFM Open License v1.0 before M2. Blocks: M2.
- **Q6. Checkpoints.** Recommend M1 and M2, as for TS-11.
- **Q7. The decision rule's numbers**, below.

## Decision rule for M1 (proposed, not agreed)

For each labelled field on each evaluation page, the prediction is scored twice:

- **Box:** a hit when its overlap with Darren's region (intersection over union) is at least 0.5.
  A miss otherwise, including no box.
- **Value:** match, wrong value or blank, against Darren's transcription, normalised as in
  experiment 1 (lowercase, punctuation and spaces dropped; dates as the same calendar date; names
  in either order).

- **Passes**, in Chromium: box hits on at least half the labelled fields, and wrong values no
  more than a fifth of them. Wrong values are capped because a wrong pre-filled value is worse
  than a blank one.
- **Disqualified** if it does not run in Chromium on WebGPU on Darren's machine, takes more than
  30 s per page after the model is cached, or needs the network once cached.
- **If neither**, the answer is "do not build M2 on this model". The findings are recorded, and
  another model, or the Indra-assisted route, is a new decision with its own rule.

Model output can vary run to run on WebGPU. The browser run is repeated; any field whose box hit
or value verdict changes between the two runs counts as unstable and is reported
(**noise-floor-before-credit**).

## Falsification tests for the design

- **The base model can point at a field by its name.** Shown wrong if box hits stay low while
  values match: it reads the field but cannot place it. That points to the Indra-assisted route.
- **The browser port matches the model.** Shown wrong if the browser scores clearly below the
  Python reference on the same pages and prompt. Check the earlier stage first (image size,
  preprocessing, prompt template) before blaming the model.
- **One call per page is enough.** Shown wrong if the model returns fields from another part of
  the page, as in lfm-extract-test. Counted as wrong values, not blanks.
