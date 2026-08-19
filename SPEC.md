# TagStrip — Document Field Annotation Tool

**Status:** spec for v1 rebuild, prototype validated in-browser (single-file HTML/JS proof of concept)
**License (recommended):** MIT — permissive, standard for dev tooling, no friction for adopters
**Deployment model:** 100% client-side static site. No backend, no accounts. All data lives in the
user's browser (IndexedDB). Distributable as a GitHub Pages / Netlify / Vercel static deploy, or run
entirely offline from a local build.

## 1. What this is

A browser-based tool for drawing labeled bounding boxes on document pages (PDFs or images) —
built for people preparing training/test data for document-understanding pipelines (KYC field
extraction, ID parsing, invoice parsing, etc.). Renders PDFs directly via pdf.js; no server-side
pre-processing step.

## 2. Explicit scope (v1)

**In scope:**
- PDF and image upload, multi-page documents
- Rectangle (bounding box) annotation, each with an editable **text transcription field** (what
  the box actually says — critical for image-only/scanned PDFs with no text layer to copy from)
- User-defined, savable/reusable label schemas (this is the #1 gap in the prototype — labels were
  hardcoded)
- Projects: a project = one label schema + a set of documents + their annotations
- **Per-page content-type detection** (`text` / `scanned` / `unknown`), auto-detected at upload
  time via pdf.js's text content API, with manual override — see M2 and M4.5. Plus one free-form
  notes field per document. This is workflow metadata, not a labeled classification task — keeps
  scope aligned with "stay focused," doesn't reopen general-purpose classification
- Local persistence (IndexedDB) — reload the page, everything's still there
- JSON import/export of annotations (including transcriptions)
- Keyboard-driven workflow (hotkeys per label, arrow-key page nav, delete key)

**Stretch / post-v1 (build the core first, revisit if there's appetite):**
- **OCR-assisted transcription** — a "Suggest text" button per box that runs an OCR engine
  against the cropped region and fills the transcription field with its best guess, which the
  user then confirms or edits. Design this behind a small interface rather than hard-coding one
  engine:
  ```ts
  interface OcrEngine {
    name: string;
    recognize(imageBlob: Blob): Promise<{ text: string; confidence?: number }>;
  }
  ```
  Ship **Tesseract.js** as the default implementation — purpose-built for this, no WebGPU
  dependency (works in Safari/Firefox, not just Chrome/Edge), ~10–15MB per language. Add
  **Transformers.js running Donut** (an "OCR-free Document Understanding Transformer," runs
  client-side via ONNX Runtime, no server) as a selectable alternate engine for people annotating
  messier/rotated real-world scans who are willing to trade a larger model download (tens to a
  few hundred MB, vs. Tesseract's per-language packs) for better accuracy than classical OCR on
  hard cases. Making this pluggable rather than picking one avoids relitigating the choice later
  and gives contributors an obvious place to add a third option.

  Two things considered and deliberately excluded from this list:
  - **Docling** — genuinely excellent document understanding, but it's a Python library
    (`pip install docling`), designed to run server-side or as its own API service. Using it
    would mean abandoning the local-only/no-backend architecture decision. Worth revisiting only
    if that decision changes.
  - **Pandoc** — not an OCR tool. It converts between formats that already have extractable
    text/structure (Markdown, DOCX, HTML, etc.); it has no capability to read text out of an
    image. Doesn't apply to the image-only/scanned-PDF case this feature exists for.
- **LLM-based cleanup of OCR output** (optional, further out) — after an OCR engine produces a
  raw guess, an in-browser text LLM via WebLLM could clean it up (fix common misreads, normalize
  a messy date). Note WebLLM's current built-in models (Llama/Phi/Gemma/Mistral/Qwen family) are
  **text-only** — it cannot read the image itself, only refine text already extracted. Worth real
  consideration of the cost/benefit before building: WebGPU-only, multi-hundred-MB+ model
  download and cache on first use, for what's usually a marginal accuracy gain on short field
  values.

**Explicitly out of scope for v1** (call out as "future work" in the README, don't build now):
- Polygons, keypoints, segmentation masks
- Whole-image/document classification tasks
- Multi-user accounts, sharing, review/approval workflows, backend of any kind
- Model-assisted pre-labeling (auto-drawing boxes, not just reading text inside ones you drew)

Keeping this list explicit matters for an open-source repo — it tells contributors what a PR
adding "polygon support" is up against, and stops scope creep in issues.

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | React 18 + TypeScript | Claude Code and most contributors are fastest here; typed models pay off once the data model has schemas/projects/documents/annotations |
| Build tool | Vite | Fast local dev, trivial static build output for GH Pages |
| Styling | Tailwind CSS | Fast iteration; swap later if the project wants a custom design system |
| Local storage | Dexie.js (thin wrapper over IndexedDB) | Avoid hand-rolling IndexedDB transactions; well-maintained, small, popular for exactly this use case |
| PDF rendering | pdf.js | Same as prototype, but self-hosted via npm package instead of a CDN `<script>` tag (CDN dependency is not acceptable for an offline-capable open source tool) |
| OCR (stretch) | Tesseract.js (default) + Transformers.js/Donut (alternate) | Pluggable `OcrEngine` interface — see section 2. Tesseract for lowest footprint/broadest browser support; Donut for better accuracy on messy scans at the cost of a larger model download. Both run fully client-side, no server |
| Text cleanup (further-out stretch) | WebLLM | Optional post-OCR correction pass using a small text LLM. Text-only — cannot read images itself. WebGPU-dependent, so treat as progressive enhancement with a feature check, never a hard requirement |
| State management | React Context + `useReducer`, or Zustand if it grows unwieldy | Don't reach for Redux for this scope |
| Testing | Vitest + React Testing Library (unit/component), Playwright (optional, e2e for the canvas interactions) | |
| Lint/format | ESLint + Prettier | Table stakes for an open source repo |

## 4. Data model (Dexie/IndexedDB schema)

```ts
// Label schema: the reusable, named set of labels a project is annotated against
interface LabelSchema {
  id: string;
  name: string;                 // e.g. "KYC Documents v1"
  labels: {
    id: string;
    name: string;                // e.g. "date_of_birth"
    color: string;                // hex
    hotkey?: string;              // "1".."9", "0"
  }[];
  createdAt: number;
  updatedAt: number;
}

// Project: a working set of documents annotated against one schema
interface Project {
  id: string;
  name: string;
  schemaId: string;
  createdAt: number;
  updatedAt: number;
}

// Document: one uploaded PDF or image group
interface Doc {
  id: string;
  projectId: string;
  filename: string;
  pageCount: number;
  sourceType: "pdf" | "image";  // how it was uploaded
  notes?: string;                // free-form document-level notes (not a fixed taxonomy)
  createdAt: number;
}

// Page: rendered page image, stored as a Blob (NOT base64 — base64 bloats IndexedDB
// storage by ~33% and was a shortcut in the prototype, not a production choice)
interface Page {
  id: string;
  documentId: string;
  pageIndex: number;
  image: Blob;
  width: number;
  height: number;
  contentType: "text" | "scanned" | "unknown"; // auto-detected at upload, user-overridable
  contentTypeOverridden?: boolean;
  textLayer?: PdfTextItem[];    // only present when contentType === "text"; cached positioned
                                  // text items from pdf.js getTextContent(), used for exact
                                  // text extraction — see M4.5
}

interface PdfTextItem {
  str: string;
  x: number; y: number; width: number; height: number; // normalized 0–1, same space as annotations
}

// Annotation: one labeled box, normalized coordinates (0–1) relative to the page
interface Annotation {
  id: string;
  documentId: string;
  pageIndex: number;
  labelId: string;
  x: number; y: number; width: number; height: number;
  text?: string;              // manual transcription, or accepted/edited OCR suggestion
  ocrSuggested?: boolean;      // true if `text` came from Tesseract and hasn't been hand-edited yet
  createdAt: number;
  updatedAt: number;
}
```

Normalized (0–1) coordinates are kept from the prototype — they survive zoom/resize/export
cleanly and let consumers of the exported JSON recompute pixel coordinates using each page's
stored `width`/`height`.

## 5. Core features / milestones

Build in this order — each milestone is a working, demoable increment:

**M0 — Scaffold**
Vite + React + TS + Tailwind + ESLint/Prettier project. Empty-state screen. `LICENSE` (MIT),
`README.md` stub, `CONTRIBUTING.md` stub.

**M1 — Schema management**
Create / rename / delete label schemas. Add/edit/remove labels within a schema (name, color,
optional hotkey 1–9 or 0). Persist to IndexedDB via Dexie. This directly replaces the prototype's
hardcoded `DEFAULT_LABELS` array.

**M2 — Projects & documents**
Create a project, attach a schema. Upload a PDF (pdf.js renders each page to a canvas → Blob →
stored page record) or images. List existing projects/documents, reopen one, confirm data
persists across a full page reload.

While rendering each PDF page, also call pdf.js's `getTextContent()` in the same pass (it's
already loaded the page — this is nearly free). If it returns positioned text items, store them
as `textLayer` and mark `contentType: "text"`; if empty/near-empty, mark `contentType: "scanned"`.
Plain image uploads are always `contentType: "scanned"` (no text layer can exist). Surface this as
a small badge per page (e.g. in the page-nav strip) and let the user override it manually — expose
`notes` as a simple text field on the document.

**M3 — Annotation canvas**
Port the prototype's drawing interaction: draw/select/delete boxes, per-page overlay positioning,
zoom, page navigation, live width×height readout while dragging. This is the part already
validated in the HTML prototype — mostly a faithful port into React components plus wiring to the
new Annotation data model instead of an in-memory array. Include the transcription text field per
selected box in the Region list panel.

**M4 — Import / export**
Export a project's annotations to JSON (same shape as the prototype's export, plus
`labelSchema` and each box's `text` embedded so an export is self-describing). Import to
restore/continue. Also offer a **Label Studio-compatible export** as a second format — see the
dedicated subsection below.

### Label Studio export (part of M4)

Reverse-engineered from a real Label Studio export sample, not their official schema docs (we
don't have access to that) — treat as best-effort compatibility, and say so in the README.
Structure observed:

- Each box produces **two paired result entries** sharing one region `id`: one
  `from_name:"bbox", type:"rectangle"` (raw geometry) and one `from_name:"label", type:"labels"`
  (same geometry plus a `labels: [name]` array). This matches a Label Studio config with separate
  `<Rectangle>` and `<Labels>` tags (their common default template), not the combined
  `<RectangleLabels>` tag used in the earlier multi-page config we explored.
- Coordinates are **percentages of image dimensions** (multiply our 0–1 fractions by 100), plus
  `original_width`/`original_height` in pixels repeated on every result entry.
- Each Label Studio **task** = one image. **Flatten multi-page documents to one task per page**
  by default (matches the sample and Label Studio's more common single-image-per-task usage).
  Note the `pages`-array/multi-page template as a documented alternative, not the default.
- Make the two tag names (`bbox`, `label`) **configurable** in export settings — they default to
  Label Studio's own template defaults, but anyone with a customized labeling config will have
  different names, and a mismatch means their import silently doesn't map correctly.
- If a region has transcription text, emit it as a third paired entry
  (`from_name:"transcription", type:"textarea"`) **only when the user opts in** — not every
  Label Studio project has that control configured, and guessing wrong breaks their import.
- Document has a task-level `meta: {}` field in Label Studio's own format — a natural place to
  carry our `notes` and each page's `contentType`, since those don't map to any of Label Studio's
  own annotation concepts but are still useful context for whoever picks up the export.
- Fill Label-Studio-instance-specific bookkeeping (`completed_by`, `project`, `task`,
  `comment_authors`, `drafts`, `lead_time`, etc.) with inert placeholders (null/0), not invented
  values that could be mistaken for real data.
- Document this feature as "verify a re-import works on your Label Studio version" rather than
  guaranteeing compatibility across versions/configs we haven't tested against.

**M4.5 — OCR assist (stretch, do after M4 works end-to-end)**
Implement the `OcrEngine` interface from section 2, but make it the *second* tier of a two-step
"Suggest text" flow, not the first:

1. **Text-layer extraction (free, exact, no model)** — if the page's `contentType === "text"`,
   gather the `textLayer` items whose bounding boxes overlap the drawn box, sort them in reading
   order, and join them. This is the actual original text, not a guess — always try this first.
2. **OCR fallback** — only when step 1 finds nothing (i.e. `contentType === "scanned"`, or a
   `"text"` page whose text layer happens not to cover that specific region), crop the region out
   of the page image and run it through the active `OcrEngine`.

This means most digitally-created pages (and mixed documents with a few scanned pages stapled in
— a common real-world case) get instant, perfect transcription with zero model download, and the
OCR engines only load/run for pages that actually need them. Ship with Tesseract.js wired up as
the OCR fallback; add the Transformers.js/Donut engine as a second implementation once the
interface is proven. Keep both OCR engines fully optional and lazy-loaded — don't pull their
WASM/model weights into the initial bundle for people who only want manual transcription, text
layer extraction, or no transcription at all.

**M5 — Polish**
Undo/redo (a simple command stack is enough — don't over-engineer), empty/error states written in
the tool's own voice, responsive layout down to ~900px, visible keyboard focus states throughout,
`prefers-reduced-motion` respected for any transitions.

**M6 — Open source packaging**
Fill out `README.md` (what it does, screenshot/GIF, quickstart, how to build/deploy), finish
`CONTRIBUTING.md`, add a GitHub Actions workflow (lint + test + build on PR, optional auto-deploy
to GitHub Pages on merge to main).

## 6. Non-functional requirements

- **Fully offline-capable** after first load — no CDN dependencies at runtime (bundle pdf.js via
  npm, not a `<script src="cdnjs...">` tag as the prototype did).
- **No data leaves the browser.** Worth stating explicitly in the README since it's a trust
  signal for anyone annotating sensitive documents.
- Should comfortably handle multi-page PDFs (tens of pages) without janking the UI — render pages
  lazily (only rasterize a page when it's first viewed, not all pages up front on upload).
- Keyboard-operable: every action reachable via mouse should have a keyboard path where reasonable.

## 7. Suggested repo structure

```
tagstrip/
  src/
    components/       # Canvas, Sidebar, RegionList, SchemaEditor, Toolbar
    db/                # Dexie schema + typed data-access functions
    lib/                # pdf rendering helpers, export/import, geometry math
    state/              # project/document/annotation context or store
    App.tsx
  public/
  LICENSE
  README.md
  CONTRIBUTING.md
  .github/workflows/ci.yml
```

## 8. Handoff note for Claude Code

Suggested first prompt when starting the Claude Code session:

> Scaffold this project per SPEC.md, starting with M0 and M1. Use Vite + React + TypeScript +
> Tailwind. Set up Dexie with the schema in section 4. Stop after M1 so I can review the schema
> editor before we build the canvas.

Building milestone-by-milestone with a review checkpoint after M1 (data layer + schema UI) and
after M3 (the canvas, which is the highest-risk/most-interactive part) is worth doing before
letting it run further — those are the two places most likely to need course-correction.
