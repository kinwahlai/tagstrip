# TagStrip — UI mockup brief

A self-contained brief for handing to a design tool or a fresh AI session. It assumes no prior
knowledge of the project, so it can be pasted in on its own.

## What it is

A browser-based tool for drawing labeled bounding boxes on document pages (PDFs or images), with a
per-box text transcription field. It's used to prepare training and test data for
document-understanding pipelines — KYC field extraction, ID parsing, invoice parsing. Live at
https://www.elevateslife.com/tagstrip/

## Who uses it

Data scientists and ML engineers. Technical, keyboard-driven, working in long focused sessions on
batches of documents.

## The selling point — make this the loudest thing in the design

Everything runs in the browser. No backend, no account, no uploads. Documents, page images,
annotations, and label schemas live in IndexedDB on the user's own machine.

The consequence, which is what actually matters: **you can annotate material you are contractually
not permitted to upload** — customer KYC packets, identity documents, medical records. Load the
page once, disconnect from the network, and keep working, OCR included.

CRITICAL WORDING RULE: claim _location_, never _security_. Never use "encrypted", "secure", "safe",
or "protected". IndexedDB is plaintext at rest. This audience verifies claims, and one overclaim
discredits everything else on the page.

## Key functions

1. **Label schemas** — reusable label sets. Each label has an underscore_style name, a color picked
   from a fixed 12-swatch high-contrast palette, and an optional hotkey 0–9.
2. **Projects** — one schema plus many documents.
3. **Documents** — upload a PDF or image. PDFs render via pdf.js with pages rasterized lazily; each
   page is auto-detected as having a text layer or being scanned.
4. **Annotate** — select a label (click or hotkey), drag a box on the page, add a transcription.
   Undo/redo, zoom, page navigation, delete.
5. **Text assist** — "Suggest text" pulls exact text from the PDF text layer when one exists, and
   falls back to on-device Tesseract OCR for scanned pages.
6. **Import / export** — TagStrip native JSON, Label Studio JSON, and standalone label-schema JSON.

## Screens to mock up

Schemas · Projects · Project detail · Annotate canvas · plus the first-run empty state.

## Layout direction already decided

A mail-client shell: full-width toolbar, a persistent left rail listing schemas and projects
**together** (they are items you pick, not modes you switch into), and one work surface. A third
middle column appears only on project detail, where the document list is long enough to earn it. On
the annotate screen the rail collapses so the canvas gets the full window.

## Problems the current UI has — please solve these

1. The page title appears in three different places across three screens.
2. The header spans full width but content is capped at 1024px and centred — the mismatch is the
   single thing that most makes it feel unfinished.
3. The side rail is 280px on one screen and 320px on another.
4. An instruction caption sits orphaned on the wrong side of the page.
5. The "create" form sits below the list it adds to, so it drifts down as the list grows.
6. Two screens have a permanently empty column.

## Hard constraints

- React 19, Tailwind CSS v4, TypeScript.
- Light **and** dark mode, each designed deliberately — not one inverted from the other.
- **No external network requests of any kind.** No CDN fonts, no
  `@import url('https://fonts.googleapis.com/...')`, no remote images, no analytics, no telemetry. A
  single request to a font CDN would falsify the product's central claim on the very page making it.
  Use a system font stack, or a self-hosted font inlined as a data URI.
- Keyboard-first: visible focus states on every interactive element; digits 0–9 select labels on the
  canvas.
- Must work from 375px to 1920px with no horizontal overflow at any width.
- Accessible: 4.5:1 contrast in both themes, real form labels, never colour alone to convey meaning.
- SVG icons only, never emoji.

## What I want back

Mockups of the four screens plus the first-run empty state, in the shell described above, in both
light and dark mode.

---

## Why two of these constraints exist

Recorded so they don't get dropped as boilerplate on a future pass:

- **No CDN fonts.** A design tool recommended a Google Fonts `@import` for this project. Adding it
  would put a third-party request on every load of the page that promises nothing leaves your
  browser — the claim falsified by the page making it. Any font must be self-hosted or a system
  stack. See `src/lib/ocr/tesseract.ts`, which already overrides tesseract.js's default jsdelivr CDN
  paths for the same reason.
- **Location, not security.** Saying "encrypted" or "secure" would be false: IndexedDB is plaintext
  in the browser profile on disk. The honest claim — the documents never leave the machine — is both
  true and stronger, because the reader can verify it in ten seconds by disconnecting the network.
