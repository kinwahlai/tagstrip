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
restore/continue. Also offer a **Label Studio JSON export** as a second format — see the
dedicated subsection below.

### Label Studio JSON export (part of M4)

**What this is for.** Label Studio offers eleven export formats; its plain `JSON` one has become a
de facto interchange shape that document-ML tooling reads. TagStrip emits that shape so such a
pipeline can consume TagStrip's output without a converter. Feeding it back into Label Studio
itself also works, but that is incidental — the target is the format's readers, not the app.

Reverse-engineered from a real Label Studio export sample rather than their published schema, and
described as best-effort for a long time on that basis. **Since verified** by running the output
through `label-studio-converter`, their own package, which read it and produced correct COCO,
Pascal VOC, YOLO and JSON_MIN — coordinates checked by hand. `FORMATS.md` carries the command and
`src/lib/__fixtures__/labelStudioExport.verified.json` is the output that passed, pinned by a test
so drift has to be a decision rather than an accident.

**No further export formats.** Label Studio's converter offers thirteen; the ones that could
plausibly fit a box-drawing tool are COCO, Pascal VOC and YOLO, and all three are detection-only —
each silently drops the per-box transcription, which for document understanding is usually the
answer rather than a detail. Implementing them here would mean maintaining three more surfaces
that emit less than what already exists, when their own converter already produces all three from
our JSON correctly. If someone needs a detector-training format, the converter is the honest route
and `FORMATS.md` documents it.

**Not carried:** page images (`data.image` names a file this export does not contain — the native
export is the one that round-trips pixels), and anything TagStrip-specific beyond a `meta` object
their readers ignore. One-way: TagStrip cannot read this format back.
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

---

## 9. Redesign: the Modernist shell (2026-08)

A design handoff from Claude Design (`docs/ui-mockup-brief.md` was the brief) supplies six screens
in a mail-client shell, in light and dark. Source bundle: `TagStrip Mockups.dc.html` (contact
sheet), `Shell.dc.html` (the UI, parameterised by screen/state/theme), `ts-modernist.css` (the
design system, vendored). `support.js` in that bundle is the design-canvas runtime — harness, not
app code, and not ported.

### Decisions taken before starting

- **CSS.** `ts-modernist.css` is vendored as-is into `src/styles/` and its classes (`.btn`,
  `.table`, `.ts-shell`, `.ts-chip`, …) are used directly. Tailwind stays for one-off layout only.
  Not re-expressed as Tailwind theme tokens — the designed dark theme comes free this way.
- **Label palette.** The five hues that fail 4.5:1 against a white region tag are darkened in
  `src/lib/labelColors.ts`: Orange `#F58231`→`#B35C13`, Olive `#808000`→`#757500`, Green
  `#3CB44B`→`#2A8034`, Teal `#469990`→`#3A7D75`, Magenta `#F032E6`→`#C024B6`. Verified
  independently; all twelve then clear 4.5:1 and the other seven already did. Labels already in
  IndexedDB keep their stored hex and surface as the off-palette swatch, which already exists.
- **Invented data is deferred, not faked.** The mockups show region counts per schema and per
  label, "used by", "last used", annotated ratio, disk usage and per-document region counts. None
  of it is queryable today. Those columns are omitted until R6 rather than stubbed with em-dashes.
- **Archivo is not bundled.** `ts-modernist.css` keeps Archivo first in the stack with a commented
  `@font-face` block; until a self-hosted woff2 is dropped in, a system grotesque resolves. No font
  CDN — that would falsify the product's own claim. Open item, not a blocker.
- **Desktop only.** TagStrip is a desktop tool: long focused sessions on batches of documents,
  keyboard-driven, on a real screen. Phone-sized layouts are explicitly **not** a supported target.
  The 375px figure in the original brief was carried forward by mistake and drove R7 further than
  it needed to go; the resulting layouts are kept because they are built, tested and cost nothing,
  but a usability gap that only appears at phone width is **not a defect** and should be closed as
  won't-do. The no-horizontal-overflow rule still applies at every width, as hygiene rather than
  because phones are supported — an overflow at any size usually means something is wrong at 1440
  too.
- **Responsive is not designed.** The mockups are fixed 1440×900. R7 covers 375–1920 and is the
  only milestone with no reference frames to work from.
- **A region's tag never leaves its own box unless that is safe** *(R7 follow-up)*. Tags sit above
  their box by preference, flip inside when above would run off the page or cover another region,
  and switch to a compact cut when the box is too short to hold a full one — see `tagPlacement` in
  `lib/geometry.ts`. The third state exists because two earlier two-state versions each just moved
  the collision: the first spilled the tag past the bottom edge onto the content below, the second
  sent it back onto the neighbour above. A tag is a fixed pixel height while a box scales with
  zoom, so shrinking the tag is the only move that does not displace the problem. The compact cut
  wins its height back from padding rather than from the type — the name is set at the same 10px
  either way, because `tagPlacement` compares box height against a pixel constant and never
  consults zoom, so a precisely drawn single-line box triggers it at *any* zoom, over a page that
  may be perfectly readable. Below roughly 13px of box height even the compact tag overflows a
  little; a box that short is a sliver, and the regions inspector carries the label in full
  regardless. Both the saved-region tags and the live drag readout render through one helper in
  `PageStage`, because wiring a placement state into one and forgetting the other is how this
  recurred once already.

  Five rounds of verification went into this, four of them failures: spilling below the box, then
  landing back on the neighbour, then reaching the regions but not the drag readout, then
  justifying 8px type with a claim about zoom that the function's own logic contradicts. Worth
  recording because the bug looked like a twenty-line fix each time.
- **Document content type is the worst case of its pages** *(decided at R6)*. The mockups put one
  content-type tag on each document row, but `contentType` is stored per page, so a multi-page
  document has no stored answer and a mixed one has no obvious one. The rule is: any page
  `scanned` makes the document `scanned`; otherwise any page `unknown` makes it `unknown`;
  otherwise `text`. A document with no pages reads `unknown` rather than guessing. The tag exists
  to say which route Suggest text will take, so it reports the worst case, not the commonest —
  one scanned page in a forty-page PDF still means OCR somewhere in that document, and a tag
  reading `text` would have hidden it. Implemented in `lib/stats.ts` as `docContentType`, which is
  where to change it if the opposite reading turns out to be more useful in practice.

### Milestones

- **R1 — Shell.** Vendor the stylesheet; reconcile theming (`ts-modernist.css` keys off
  `[data-theme="dark"]` while Tailwind v4 defaults `dark:` to `prefers-color-scheme`, so a
  `@custom-variant` must point Tailwind at the same attribute, and an explicit toggle must beat the
  OS in both directions). Build the header (wordmark, breadcrumb, claim strip, theme toggle) and
  the rail (group headers, schema and project lists, footer). Existing page components render
  inside the work surface, still in their current styling. Group headers route to the existing
  list pages until R2/R3 replace them. **Checkpoint — stop for human review.**
- **R2 — Schema screens.** Label-schemas overview table (new; this is where "create a schema"
  finally lives) and schema detail: add-label form pinned above the table it feeds, full
  twelve-swatch palette inline, hotkey select, labels table.
- **R3 — Project screens.** Projects overview table (new) and project detail as three columns —
  documents list, then the selected document with notes and the per-page content-type list.
- **R4 — Annotate.** Labels, undo/redo, zoom, page nav and layer tag in the toolbar; canvas; the
  regions inspector with a transcription input and Suggest text per region; rail collapsed to 56px
  with the document overlay; breadcrumb as back link with Esc. **Checkpoint — stop for human
  review.** Highest-risk screen, same reasoning as M3.
- **R5 — First run.** Accent hero at 52px, the "What this is not" strip naming the plaintext-at-rest
  limit, the three points, and the start-here create form.
- **R6 — Deferred aggregates.** The R-decisions above, made real: counts per schema and label,
  used-by, last used, annotated ratio and progress bar, per-document region counts,
  `navigator.storage.estimate()` for disk use, and the rail's Find box.
- **R7 — Responsive.** 375–1920 with no horizontal overflow at any width; rail to 56px then
  off-canvas; middle column folds into the surface. *(In hindsight, scoped wider than the product:
  see the desktop-only decision above. The work stands, but phone width is not a supported target.)*

Checkpoints after R1 and R4 mirror section 8's reasoning: R1 because every later screen sits inside
that shell, R4 because it is the most interactive surface in the app.
