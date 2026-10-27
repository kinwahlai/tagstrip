# Suggest text

For a drawn region, the "Suggest text" button fills its transcription. The text layer is tried first (exact, free); only if it yields nothing does it crop the region and run Tesseract OCR in the tab (English only, assets served from the app's own origin). OCR-filled regions carry an "OCR" tag.

## Sub-features

- text-layer: exact extraction on text PDFs, no OCR assets fetched
- ocr-fallback: image pages and scanned PDFs, "OCR" tag shown
- content-type override: per-page select changes the route
- unavailable: disabled with a reason when the export had no source document

## How to get to it

- Annotation canvas, "Regions on this page" panel: button "Suggest text" beside each region's `Transcription for <label> region` field.

## Driving it

Scripted journey `suggest-text-ocr` (OCR path), from an empty browser:

```bash
export WORKTREE=/path/to/clean/worktree PORT=5199
S=/home/snaic-darren/projects/tagstrip/.claude/skills/verify-tagstrip/scripts
$S/launch.sh && $S/doctor.sh && $S/pw-install.sh
source $S/env.sh
NODE_PATH=$RUN_DIR/pw/node_modules node $S/drive.mjs --browser chromium --url http://127.0.0.1:$PORT/ \
  --journey suggest-text-ocr --evidence "$EVIDENCE_DIR" --check-id adhoc
```

It creates schema "verify schema" with label "field", project "verify project", uploads a generated PNG reading "TAGSTRIP 2026", draws a region over it, clicks "Suggest text", waits for the field to fill, and asserts the normalised text (lowercase, alphanumerics only) equals `tagstrip2026`. Expected: exit 0, JSON `match:true`, `ocrBadgeShown:true`, `ocrMs` (about 0.5 to 1.5 s observed on this host, inferred as typical). Screenshot and JSON land in the evidence dir.

Text-layer path (no scripted journey yet): "Load the sample document" on the first-run page (text-layer PDF), draw a region over text, press "Suggest text"; the field fills with no "OCR" tag and the OCR assets (tessdata, wasm) are not requested.

## Gotchas

- First OCR call loads the engine and model; allow up to the driver's 180 s timeout on a slow host.
- OCR output can differ in case or punctuation, hence the normalised comparison. A real mismatch is a finding; do not change the expected text.
- With `--block-offsite`, `blockedCount` should be 0 (OCR assets come from the app's origin). Non-zero is a finding.
- WebKit needs the persistent-context path the driver uses (see README).
- The Suggest text label also appears as a non-button heading in the panel footer; target the button by role.
