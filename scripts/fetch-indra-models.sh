#!/usr/bin/env bash
# Puts the Indra OCR model files TagStrip's Indra engine needs into ./indra-models/
# (gitignored; the weights are OpenRAIL-M and must never be committed or placed in public/).
# Copies from the local Hugging Face cache when present, else downloads from the pinned revision.
set -euo pipefail
REV=bd02167fdf2005a19962cc15188f8496a2c87d3b
FILES=(det.onnx rec.onnx meta.json)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/indra-models"
CACHE="${HF_HOME:-$HOME/.cache/huggingface}/hub/models--datalab-to--indra-ocr/snapshots/$REV"
mkdir -p "$DEST"
for f in "${FILES[@]}"; do
  if [ -f "$CACHE/$f" ]; then
    cp -L "$CACHE/$f" "$DEST/$f"
    echo "copied $f from the Hugging Face cache"
  else
    curl -fL --retry 3 -o "$DEST/$f" "https://huggingface.co/datalab-to/indra-ocr/resolve/$REV/$f"
    echo "downloaded $f"
  fi
  chmod u+w "$DEST/$f"
done
ls -l "$DEST"
