#!/usr/bin/env bash
# Downloads, into predict-models/ (gitignored, never in public/ or dist/), what the TS-16 predict
# harness needs besides Florence and LFM:
#  - PP-OCRv6 small detector and recogniser, official ONNX (Apache-2.0), pinned revisions
#    (about 31 MB), under predict-models/ppocr/{det,rec}/;
#  - Tesseract language data eng, chi_sim, chi_tra (4.0.0_best_int, @tesseract.js-data 1.0.0),
#    under predict-models/tessdata/, so no CDN is used at run time (about 30 MB).
# The harness makes no other request. The ONNX Runtime WASM files come from fetch-florence.sh.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
M="$REPO_ROOT/predict-models"
get() { # url dest
  if [ -s "$2" ]; then echo "have $2"; return; fi
  mkdir -p "$(dirname "$2")"
  echo "fetch $2"
  curl -fSL --retry 3 --progress-bar -o "$2.part" "$1"
  mv "$2.part" "$2"
}
HF=https://huggingface.co/PaddlePaddle
DET=28fe5895c24fd108c19eb3e8479f4ab385fbfc62
REC=b8f84f0b80c529de40b4fbb3544b84fa7233a513
for f in inference.onnx inference.yml; do
  get "$HF/PP-OCRv6_small_det_onnx/resolve/$DET/$f" "$M/ppocr/det/$f"
  get "$HF/PP-OCRv6_small_rec_onnx/resolve/$REC/$f" "$M/ppocr/rec/$f"
done
for l in eng chi_sim chi_tra; do
  get "https://cdn.jsdelivr.net/npm/@tesseract.js-data/$l@1.0.0/4.0.0_best_int/$l.traineddata.gz" \
    "$M/tessdata/$l.traineddata.gz"
done
du -sh "$M"
