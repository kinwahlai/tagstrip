"""Reference output of the Python indra-ocr package on the synthetic crops.

Prints `id<TAB>text` per crop (a two-line crop's lines are joined with the two characters
backslash-n so each crop stays on one output row). Used to check the TypeScript port in
src/lib/ocr/indra.ts for parity. SYNTHETIC DATA ONLY: never point this at real documents.

Runs the package's own OrtOCR detector and recogniser on the det.onnx / rec.onnx / meta.json
in ./indra-models (no order, script, mask or language-model files there, so decoding is plain
greedy CTC). Run:
    /home/snaic-darren/projects/lfm-extract-test/.venv/bin/python -I scripts/indra-reference.py
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from indra_ocr.det_post import decode, page_to_input
from indra_ocr.pipeline import OrtOCR

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "indra-models"
CROPS = ROOT / "test-fixtures" / "ocr-crops"


# Detector input scale for a crop. Python indra scales a page's long side to 1024; for a small
# crop that magnifies the text far outside the detector's range and shatters each line into
# fragments (measured on the synthetic set). So the crop is first read at native scale, and
# re-read at a rescaled size only when the lines come out too small or too large. The TypeScript
# port (src/lib/ocr/indra.ts) uses the same rule.
MIN_LINE_H, TARGET_SMALL_H, MAX_LINE_H, TARGET_LARGE_H, MAX_SIDE = 9.0, 12.0, 44.0, 28.0, 2048


def detect(ocr: OrtOCR, gray: np.ndarray) -> np.ndarray:
    h, w = gray.shape

    def run(scale: float):
        long_side = max(1, round(max(h, w) * scale))
        x, s = page_to_input(gray, long_side)
        boxes = decode(ocr.det.run(None, {"x": x[None, None]})[0][0])
        return boxes, s

    boxes, s = run(1.0)
    if len(boxes):
        med = float(np.median(boxes[:, 3] - boxes[:, 1])) / s
        scale = None
        if med < MIN_LINE_H:
            scale = min(MAX_SIDE / max(h, w), TARGET_SMALL_H / max(med, 1.0))
        elif med > MAX_LINE_H:
            scale = TARGET_LARGE_H / med
        if scale is not None and abs(scale - 1.0) > 1e-6:
            boxes, s = run(scale)
    if len(boxes):
        boxes[:, :4] /= s
        boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, w)
        boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, h)
    return boxes


def main() -> None:
    ocr = OrtOCR(MODELS, threads=1)
    for item in json.loads((CROPS / "expected.json").read_text()):
        gray = cv2.imread(str(CROPS / item["file"]), cv2.IMREAD_GRAYSCALE)
        boxes = detect(ocr, gray)
        if len(boxes) == 0:
            print(f"{item['id']}\t")
            continue
        order = sorted(range(len(boxes)), key=lambda i: ((boxes[i, 1] + boxes[i, 3]) / 2, boxes[i, 0]))
        boxes = boxes[order]
        rec = ocr.recognize(gray, boxes)
        text = "\\n".join(r[0] for r in rec if r[0])
        print(f"{item['id']}\t{text}")


if __name__ == "__main__":
    sys.exit(main())
