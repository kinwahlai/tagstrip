# Import and export

Projects and schemas leave and enter the app as files. Native TagStrip JSON restores a whole project (optionally with the source document bytes); Label Studio JSON is an export of rectangles, labels and transcriptions. Schemas can be exported and imported on their own.

## Sub-features

- native-export: Export JSON with or without source document
- label-studio-export: configurable tag names
- native-import: project JSON, including annotations-only (documents show a placeholder)
- schema-export / schema-import

## How to get to it

- ProjectDetail: buttons "Export JSON" (dialog `Export JSON`, radiogroup "What to include") and "Label Studio JSON…" (dialog with `Rectangle tag name` id `ls-bbox-tag`, `Labels tag name` id `ls-label-tag`, `Transcription tag name` id `ls-transcription-tag`).
- Schemas: `Export <name>` row button, or "Export" on SchemaDetail.
- Import: "Import project…" and "Import schema…" file labels on the first-run page; "Import schema…" on the schemas overview and the import control on the projects overview (sr-only file inputs, JSON). Label Studio JSON is accepted by import too, per the first-run page text.

## Driving it

No scripted journey yet. Via Playwright MCP: open ProjectDetail of a project with a region, click "Export JSON", choose a radio, submit (button in the dialog), capture the download with `page.waitForEvent('download')`; re-import by `setInputFiles` on the file input of "Import project…" from a fresh context. Compare counts (documents, regions), not text.

## Gotchas

- Annotations-only exports re-import with no page image: drawing and Suggest text are disabled with an explanation.
- Export with source "leaves the browser" by the user's action; do not use real documents for this without the Real data rules.
- Invalid JSON shows `"<name>" is not valid JSON` in a `role="alert"`.
