# TS-16: combined test, Florence-2 boxes with browser LFM values

## What is asked, and by whom

Asked by Darren, 2026-10-29: "lfm doesnt work well. let's check again. i found this microsoft
florence 2, that can run on browser" (found while looking for in-browser GPU OCR to replace
Tesseract). Then: "yes, draft the combined test". A test only; no app feature in this ticket.

## Why this, after TS-12

TS-12 M1 found the base LFM reads values (36/36 on synthetic pages, Python on an RTX 4070) but
places no boxes (0/36 at IoU >= 0.5). Its rule says another model is a new decision with its own
rule: this ticket. The passport script got boxes by finding where each value is printed with
Tesseract. Florence-2's `<OCR_WITH_REGION>` returns every text line with a box, so it may do that
"where is it printed" step in the browser.

## Facts (read 2026-10-29)

- Florence-2: Microsoft, **MIT**. Base 0.23B, large 0.77B parameters (model card).
- Tasks include `<OCR>`, `<OCR_WITH_REGION>` (lines as `labels` plus `quad_boxes`, 8 coordinates
  each), `<CAPTION_TO_PHRASE_GROUNDING>`. No task takes a label schema.
- Browser: `onnx-community/Florence-2-base-ft` via transformers.js
  (`Florence2ForConditionalGeneration`); a WebGPU demo exists (Xenova/florence2-webgpu).
- Size, base q4f16: vision encoder 62.4, embeddings 78.8, encoder 25.7, merged decoder 56.5,
  about **223 MB**. Large q4f16 is roughly 2x.
- **Input is resized to 768x768** (`preprocessor_config.json`). Small print on a full page may be
  lost.
- Browser LFM (`onnx-community/LFM2.5-VL-450M-ONNX`, q4f16) is about 315 MB. Its browser
  accuracy has never been measured; the 36/36 was Python. Both models together: about 540 MB.
- TS-12's harness, scorer, synthetic set (8 pages, 36 fields) and Python reference are on branch
  `ts-12-predict-fields` (a079483).
- The real evaluation set (TS-12 Q2, under `~/projects/pai-extract/`) is **not on this Mac**.

## Changes agreed 2026-10-29 (Darren), before any run

Darren's reasons to replace Tesseract: (1) it does not work with Chinese, (2) it is slow, (3) a
model to pair with prediction to draw boxes. Candidates compared the same day (model cards, HF
API): PP-OCRv6 (PaddlePaddle, Apache-2.0, June 2026; official ONNX: small det 9.9 MB + rec
21.2 MB, tiny 6.3 MB; Chinese simplified and traditional official; line polygons; v6 browser
pipeline unproven, PaddleOCR's browser SDK documents v5) and GLM-OCR (0.9B, MIT; text only, no
model-level boxes; community WebGPU port only, 635 MB; Chinese undocumented).

1. **PP-OCRv6 small is added** beside Florence-2: arms A and B with its line boxes, and in the
   region-reading comparison.
2. **Chinese synthetic pages are added**, simplified and traditional, to the 8 English pages.
3. **Chinese bar for replacing Tesseract:** on Chinese fields, at least 80% values match and at
   most 10% wrong, plus at most 2 s per region once cached. Tesseract runs with `chi_sim` and
   `chi_tra` loaded, for a fair baseline.
4. **Browser LFM on Chinese values is reported**, not part of the rule.

GLM-OCR is dropped: it fails reason 3. Florence-2 stays though its Chinese is undocumented.

## Design

Per page, three arms, all in Chrome on WebGPU:

- **Arm A, Florence boxes alone (ceiling).** Florence `<OCR_WITH_REGION>` lines; each field's
  true value is matched to a line by plain code; that line's box is the prediction. Shows whether
  Florence can place boxes at all, apart from LFM.
- **Arm B, end to end.** Same, but the values come from browser LFM. This is the feature's real
  shape.
- **Arm C, grounding by field name (side arm).** Florence `<CAPTION_TO_PHRASE_GROUNDING>` with
  the label name. Reported, not part of the rule.
- **Tesseract comparison.** Florence `<OCR>` on each true region's crop versus Tesseract on the
  same crop: value match counts and time per region. Answers "replace Tesseract?" for Suggest
  text.

The value-to-line matcher is plain code (normalised text: exact, then contained, then the
closest by edit distance under a threshold; a value split over adjacent lines takes their union).
No LLM in that step.

Order: synthetic set first (free, no real data). Real set only if arm A clears the box bar on
synthetic; a model that cannot box clean pages will not box real ones.

## Decision rule (to agree before any run)

Scored as TS-12: box hit at IoU >= 0.5 with Darren's region; value match, wrong or blank under
TS-12's normalisation. Counts per arm.

- **Arm B passes** on a set: box hits on at least half the labelled fields, wrong values at most
  a fifth, in Chrome on hardware WebGPU on this Mac, at most 30 s per page for both models once
  cached, no network once cached.
- **A model replaces Tesseract** for Suggest text if, on English crops, on the same crops, it matches at least as
  many values as Tesseract, has no more wrong values, and takes at most 2 s per region once cached; and on Chinese crops matches at least 80% of
  values with at most 10% wrong (change 3).
- **If arm A fails on synthetic for a model:** that model cannot supply boxes; record it. Both
  fail: close.
- **If arm A passes but arm B fails:** boxes are fine, values are the problem; the next decision
  is the value model, not Florence.
- Each arm runs twice; a field whose verdict changes between runs is reported as unstable
  (**noise-floor-before-credit**).
- IoU at 0.3 is reported beside 0.5 for information, not for the rule.

## Falsification tests

- **Florence line boxes fit the regions Darren draws.** Shown wrong if arm A's IoU sits between
  0.3 and 0.5 for most fields: lines include the printed field name ("Date of birth: ..."), so a
  line box is wider than the value. Then a box trimmed to the value's share of the line is the
  next thing to test, not a pass.
- **768x768 keeps the text readable.** Shown wrong if arm A misses cluster on small-print fields,
  or OCR text on full pages is much worse than on crops. Check the earlier stage (image size sent)
  before blaming the model.
- **Browser LFM matches the Python reference.** Shown wrong if arm B values on synthetic score
  clearly below 36/36.

## Scope

**In:** a harness page, the matcher, a scoring run, the report. **Out:** any app UI, storing
predictions, SPEC changes. Reason: a build is a separate decision after this result.

## Milestones

- **M1. Synthetic run.** Harness, matcher, arms A–C, Tesseract comparison, on the 8 synthetic
  pages. Checkpoint (proposed).
- **M2. Real run.** Same, on the real set, counts only. Only if arm A passes in M1. Checkpoint.

## Answered (Darren, 2026-10-29)

- **Q1. Real set:** cannot be used on this Mac. **M2 is deferred** to the Windows machine; Claude
  writes the prompt to run it there at M1 hand-back, and only if arm A passes on synthetic.
- **Q2.** Florence base first.
- **Q3.** New branch `TS-16-florence-boxes` from main.
- **Q4.** The decision rule's numbers as written.
- **Q5.** M1 and M2 are checkpoints.
