#!/usr/bin/env bash
# Downloads Florence-2-base-ft ONNX files, q4f16 except the decoder, which is q4 (about 230 MB; the q4f16 merged decoder fails to load in this ORT: logits subgraph output) into predict-models/ at the repo
# root (gitignored, never in public/ or dist/), plus the ONNX Runtime WASM files. The predict
# harness (harness/predict.html) loads everything from there and makes no other request.
# Model: onnx-community/Florence-2-base-ft (Microsoft Florence-2, MIT), pinned to one revision.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REV=e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f
BASE="https://huggingface.co/onnx-community/Florence-2-base-ft/resolve/$REV"
OUT="$REPO_ROOT/predict-models/onnx-community/Florence-2-base-ft"
mkdir -p "$OUT/onnx" "$REPO_ROOT/predict-models/ort"
FILES=(
  config.json generation_config.json preprocessor_config.json
  tokenizer.json tokenizer_config.json added_tokens.json special_tokens_map.json vocab.json merges.txt
  onnx/vision_encoder_q4f16.onnx onnx/embed_tokens_q4f16.onnx
  onnx/encoder_model_q4f16.onnx onnx/decoder_model_merged_q4.onnx
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
  cp "$ORT/$f" "$REPO_ROOT/predict-models/ort/$f"
done
du -sh "$REPO_ROOT/predict-models"
