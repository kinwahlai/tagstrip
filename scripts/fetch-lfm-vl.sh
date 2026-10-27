#!/usr/bin/env bash
# Downloads the LFM2.5-VL-450M q4f16 ONNX build (about 315 MB) and copies the ONNX Runtime WASM
# files into lfm-vl-models/ at the repo root (gitignored, never in public/ or dist/). The
# predict harness (harness/predict.html) loads everything from there and makes no other request.
# Model: onnx-community/LFM2.5-VL-450M-ONNX, pinned to one revision. LFM Open License v1.0 applies.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REV=24e63007ff1aaafbde27c89eb01a0513f4f61482
BASE="https://huggingface.co/onnx-community/LFM2.5-VL-450M-ONNX/resolve/$REV"
OUT="$REPO_ROOT/lfm-vl-models/onnx-community/LFM2.5-VL-450M-ONNX"
mkdir -p "$OUT/onnx" "$REPO_ROOT/lfm-vl-models/ort"
FILES=(
  config.json generation_config.json preprocessor_config.json processor_config.json
  tokenizer.json tokenizer_config.json chat_template.jinja
  onnx/decoder_model_merged_q4f16.onnx onnx/decoder_model_merged_q4f16.onnx_data
  onnx/embed_tokens_q4f16.onnx onnx/embed_tokens_q4f16.onnx_data
  onnx/vision_encoder_q4f16.onnx onnx/vision_encoder_q4f16.onnx_data
)
for f in "${FILES[@]}"; do
  if [ -s "$OUT/$f" ]; then echo "have $f"; continue; fi
  echo "fetch $f"
  curl -fSL --retry 3 --progress-bar -o "$OUT/$f.part" "$BASE/$f"
  mv "$OUT/$f.part" "$OUT/$f"
done
# ONNX Runtime WASM files that transformers.js would otherwise fetch from a CDN.
ORT="$(ls -d "$REPO_ROOT"/node_modules/.pnpm/onnxruntime-web@1.31.0-dev.*/node_modules/onnxruntime-web/dist | head -n1)"
for f in ort-wasm-simd-threaded.asyncify.mjs ort-wasm-simd-threaded.asyncify.wasm \
         ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm; do
  cp "$ORT/$f" "$REPO_ROOT/lfm-vl-models/ort/$f"
done
du -sh "$REPO_ROOT/lfm-vl-models"
