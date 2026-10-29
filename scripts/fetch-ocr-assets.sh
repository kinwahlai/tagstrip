#!/usr/bin/env bash
# Fetches the OCR files Suggest text serves from the app's own origin (SPEC.md sections 2 and 6),
# into public/ocr/ (gitignored). Runs before `pnpm dev` and `pnpm build` (predev, prebuild), so it
# needs the network once; files already present with the right hash are skipped.
#  - PP-OCRv6 small detector and recogniser, official ONNX (Apache-2.0), at the revisions pinned
#    below (about 31 MB), under public/ocr/ppocr/{det,rec}/;
#  - the Apache-2.0 licence text, public/ocr/ppocr/LICENSE (the Hugging Face repos carry no
#    licence file, so it is the canonical text from apache.org);
#  - the onnxruntime-web WebGPU build's WASM files, copied from node_modules (about 25 MB), under
#    public/ocr/ort/.
# Every download is checked against a sha256 pinned here; a mismatch fails the script.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO_ROOT/public/ocr"

sha_of() { # file -> sha256 hex
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}
get() { # url dest sha256
  if [ -s "$2" ] && [ "$(sha_of "$2")" = "$3" ]; then echo "have $2"; return; fi
  mkdir -p "$(dirname "$2")"
  echo "fetch $2"
  curl -fSL --retry 3 --progress-bar -o "$2.part" "$1"
  got="$(sha_of "$2.part")"
  if [ "$got" != "$3" ]; then
    rm -f "$2.part"
    echo "fetch-ocr-assets: sha256 mismatch for $1 (expected $3, got $got)" >&2
    exit 1
  fi
  mv "$2.part" "$2"
}

HF=https://huggingface.co/PaddlePaddle
DET=28fe5895c24fd108c19eb3e8479f4ab385fbfc62
REC=b8f84f0b80c529de40b4fbb3544b84fa7233a513
get "$HF/PP-OCRv6_small_det_onnx/resolve/$DET/inference.onnx" "$OUT/ppocr/det/inference.onnx" \
  d73e0058b7a8086bbd57f3d10b8bcd4ff95363f67e06e2762b5e814fe9c9410e
get "$HF/PP-OCRv6_small_det_onnx/resolve/$DET/inference.yml" "$OUT/ppocr/det/inference.yml" \
  193f435274bf9f0b5f71a929bbfbcf148282df7e633b34e7c373e8f44741b516
get "$HF/PP-OCRv6_small_rec_onnx/resolve/$REC/inference.onnx" "$OUT/ppocr/rec/inference.onnx" \
  5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634
get "$HF/PP-OCRv6_small_rec_onnx/resolve/$REC/inference.yml" "$OUT/ppocr/rec/inference.yml" \
  ab078671bb49f06228eadccd34f1bb501e157f7a047095ffb943ba81512c77d1
get https://www.apache.org/licenses/LICENSE-2.0.txt "$OUT/ppocr/LICENSE" \
  cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30

# The runtime files come from the installed package (pinned by the lockfile), not the network.
ORT="$REPO_ROOT/node_modules/onnxruntime-web/dist"
mkdir -p "$OUT/ort"
for f in ort-wasm-simd-threaded.asyncify.mjs ort-wasm-simd-threaded.asyncify.wasm; do
  [ -s "$ORT/$f" ] || { echo "fetch-ocr-assets: $ORT/$f missing; run pnpm install" >&2; exit 1; }
  cmp -s "$ORT/$f" "$OUT/ort/$f" || cp "$ORT/$f" "$OUT/ort/$f"
done
echo "ocr assets ready in $OUT"
