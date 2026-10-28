# Projects and documents

A project pairs one label schema with many documents. The user creates a project, uploads PDFs or images (PNG, JPEG, WebP), sees each document's pages and detected content type, and opens one on the annotation canvas.

## Sub-features

- create-project: name plus schema
- upload: PDF or image, per-file progress
- doc-detail: pages, notes, per-page content-type override
- delete-document, delete-project
- doc-order: every document list (project list, annotate rail, `[` `]`, exports) is by filename in natural order, case ignored (TS-15)

## How to get to it

- Rail: button "Projects" opens the overview; the "New project" form has `Project name` (id `project-name`), `Label schema` select (id `project-schema`) and button "Create project".
- A project row's name button, or a rail project entry, opens ProjectDetail.
- "Load the sample document" on the first-run page builds a project and goes straight to the canvas.

## Driving it

No scripted journey yet; the create-and-upload steps run inside `suggest-text-ocr` (scripts/drive.mjs) and can be copied.

Precondition: a schema exists (see schemas.md); without one, "Create project" shows "Create a label schema first".

1. Fill `Project name`, pick the schema in `Label schema`, click "Create project". Result: ProjectDetail with heading "Documents · 0".
2. `getByRole('region', {name:'Documents'}).locator('input[type=file]').setInputFiles(...)` (the visible control is the "Upload document" label). Result: a document row button named after the file.
3. Click the row. Result: "Selected document" panel with "PDF/PNG ... · N page(s)", Notes (`Notes` label, id `doc-notes`) and a `Content type for page N` select per page.
4. Click "Open annotation canvas".
5. Coming back from the canvas (breadcrumb, Esc, or the overlay's back link), the document last open there has `aria-current="true"` and its detail panel is shown.

## Gotchas

- The file input is `sr-only`; use `setInputFiles`, do not click the label (that opens a native chooser).
- On WebKit an ephemeral context fails the upload; see README.
- Document rows are labelled by filename, so with real data they must not appear in evidence.
- Below the breakpoint the document list folds and "← Documents" appears.
