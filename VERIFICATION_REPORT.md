# TagStrip Verification Report

Verifier run date: 2026-08-18
Milestones checked: M0 (Scaffold), M1 (Schema management)
Dev server: `npm run dev` on http://localhost:5173/ (Vite, started successfully)
Browser: Playwright (Chromium)

## M0 — Scaffold

- ✓ `npm install && npm run dev` starts without errors; the app loads in a browser at the printed local URL — `npm install` reported "up to date, audited 259 packages... found 0 vulnerabilities"; `npm run dev` printed "VITE v8.2.1 ready" and served on http://localhost:5173/, which loaded successfully in Chromium (page title "TagStrip").
- ✓ `npm run build` exits 0 and produces a `dist/` (or equivalent) folder — ran `tsc -b && vite build`, exited 0, and `dist/` contains `index.html`, `assets/` (JS+CSS), and `favicon.svg`.
- ✓ `npm run lint` exits 0 — `eslint .` produced no output and exited 0.
- ✓ The empty-state screen is visible on first load (no console errors in the browser devtools) — with a freshly cleared IndexedDB, the page showed "No label schemas yet. Create one to define the fields you'll annotate." and "Select a schema to manage its labels, or create a new one."; zero `console.error`/`pageerror` events were captured during load. Screenshot: `verification-screenshots/M0-empty-state.png`.
- ✓ `LICENSE` file exists and its content matches the MIT license text with a real year/holder, not a placeholder — file contains the standard MIT license text with "Copyright (c) 2026 Darren Lai" (no `<YEAR>`/`<COPYRIGHT HOLDER>` placeholders).

## M1 — Schema management

- ✓ Create a new label schema via the UI; reload the page; the schema is still there (confirmed via IndexedDB, not just visually) — created schema "Invoice Fields" via the form, did a full `page.reload()`, and confirmed it was still rendered in the UI AND present in `indexedDB.open('tagstrip')` → `labelSchemas` object store (`{"name":"Invoice Fields", ...}` returned by direct `getAll()` in `page.evaluate`). Screenshot: `verification-screenshots/M1-schema-persists.png`.
- ✓ Add a label with a name, color, and hotkey to a schema; it appears in the label list with the correct color swatch — added label "Vendor Name", color `#ff0000`, hotkey `1`. The row appeared immediately with a swatch whose computed `background-color` was `rgb(255, 0, 0)` (exact match) and a `<kbd>1</kbd>` hotkey badge. Screenshot: `verification-screenshots/M1-add-label.png`.
- ✓ Delete a label; it's gone from the list and from IndexedDB after reload — clicked Delete on "Vendor Name", a confirm dialog appeared ("Delete \"Vendor Name\"? This cannot be undone."), confirmed it, the row disappeared from the UI immediately, and after a full reload the schema's `labels` array in IndexedDB no longer contained it (only "Invoice Number" remained). Screenshot: `verification-screenshots/M1-delete-label.png`.
- ✓ Attempt to add two labels with the same name in one schema — confirm the app either prevents this or handles it sensibly — added "Vendor Name" once successfully, then attempted to add a second label also named "Vendor Name" (different color). The label list stayed at exactly 1 row and an inline error appeared: "A label named \"Vendor Name\" already exists in this schema." No duplicate/broken state was created. Screenshot: `verification-screenshots/M1-duplicate-label.png`.
- ✓ Delete an entire schema that's in use by a project — confirm the app handles this explicitly — inserted a synthetic `projects` record directly into IndexedDB (`{id:'fake-project-1', schemaId: <Invoice Fields id>, ...}`) since project-creation UI doesn't exist yet (M2 not built). Then clicked Delete on the "Invoice Fields" schema in the UI; a confirm dialog appeared, confirmed it, and the app blocked the deletion with the message "This schema is used by 1 project. Delete or reassign that project first." The schema remained visible in the schema list, and after a full reload the schema was still present in IndexedDB (`labelSchemas`) and the fake project's `schemaId` still pointed at it (no dangling reference was created, nothing was silently deleted). Screenshot: `verification-screenshots/M1-schema-in-use-blocked.png`.

## Supplementary (not required by rubric, run per CLAUDE.md's "cheap checks" policy)

- `npm test` (vitest) — 1 test file, 7 tests, all passed, exit 0.

## Summary

All M0 and M1 checklist items pass. No blockers, no ✗ items, no design concerns found for these two milestones. The schema-in-use guard (`SchemaValidationError('SCHEMA_IN_USE', ...)` in `src/db/labelSchemas.ts`) is implemented at the data-access layer (checks `db.projects.where('schemaId').equals(id).count()` before allowing delete), so it will continue to work correctly once real project-creation UI lands in M2.

Note on methodology: my first pass at the schema-in-use and duplicate-label checks used ambiguous Playwright locators (`text=...` and `ul > li` matching elements in both the schema list and label list), which produced false negatives. I confirmed via screenshots that the app's actual behavior was correct in both cases, then re-ran with scoped locators (`aside ul` vs `section ul`) to get accurate, reproducible pass results reflected above.

---

## M2 — Projects & documents

Verifier run date: 2026-08-18
Dev server: `npm run dev` on http://localhost:5173/ (Vite, already running from earlier session)
Browser: Playwright (Chromium), driven via a Node script using the `playwright` package
(no MCP browser tool was available in this session's toolset, so Playwright's Node API was
invoked directly through Bash instead)

Test fixtures (synthesized for this run, no external files used):
- `text3.pdf` — a hand-written 3-page PDF (`%PDF-1.4`, real `Catalog`/`Pages`/`Page` objects, a
  Helvetica `Font` resource, content stream `BT /F1 12 Tf 72 700 Td (Sample text page N) Tj ET`
  per page) — has real embedded text via genuine `Tj` operators.
- `large18.pdf` — the same construction, scaled to 18 pages, for the large-PDF responsiveness check.
- `scan1.png` — a minimal valid 64×48 8-bit RGB PNG built by hand with Python's `struct`/`zlib`
  (IHDR/IDAT/IEND chunks, gradient raw bitmap), no imaging library used.

- ✓ Create a project, attach a schema, upload the multi-page specimen PDF from the earlier
  prototype (or any multi-page PDF) — confirm the correct page count is detected — created label
  schema "Doc Schema", created project "Test Project" attached to it, uploaded `text3.pdf` (3
  pages) via the "Upload document" file input. The doc detail panel immediately showed "PDF · 3
  pages" and the page-nav strip listed exactly 3 rows (Page 1/2/3), each auto-detected as
  `contentType: text` (real `Tj` text-showing operators were present on every page). Screenshot:
  `verification-screenshots/M2-pdf-page-count.png`.
- ✓ Reload the page fully (not SPA navigation — an actual browser reload) — the project, its
  documents, and all pages are still present, sourced from IndexedDB — recorded IndexedDB counts
  before reload (1 project / 1 doc / 3 pages) via direct `indexedDB.open('tagstrip')` +
  `objectStore.getAll()` in `page.evaluate`, then did a real `page.reload()`, re-navigated to the
  Projects tab (SPA state resets on reload, as expected — that's not a bug, the persistence layer
  is IndexedDB not React state), reopened "Test Project" and clicked into `text3.pdf`. The doc
  detail panel again showed "PDF · 3 pages", the page-nav strip again showed 3 rows, and a second
  direct IndexedDB read after reload returned identical counts (1 project / 1 doc / 3 pages) —
  confirming persistence came from IndexedDB, not in-memory state. Screenshot:
  `verification-screenshots/M2-reload-persistence.png`.
- ✓ Upload a plain image (PNG/JPG) as a document — confirm `contentType` is `scanned` (never
  `text`) — uploaded the hand-built `scan1.png` (a raster image, no text layer possible). The doc
  detail panel showed "IMAGE · 1 page" and the page-nav strip showed a single row with a `scanned`
  badge (never `text`), matching spec (plain image uploads are always `scanned`). Screenshot:
  `verification-screenshots/M2-image-scanned-contenttype.png`.
- ✓ Upload a PDF with real embedded text (not a scanned/rasterized one) — confirm at least one
  page is auto-detected as `contentType: text`, and manually override it to `scanned` — confirm
  the override persists after reload — on the already-uploaded `text3.pdf` (all 3 pages
  auto-detected as `text`), used the per-page override `<select>` on Page 1 to set it to
  `scanned`. The UI immediately showed the `scanned` badge plus an "(overridden)" annotation next
  to it. After a full `page.reload()` and re-navigating back into the document, the page-nav strip
  still showed Page 1 as `scanned (overridden)`, the `<select>` value was still `"scanned"`, and a
  direct IndexedDB read of the `pages` store confirmed the record itself has
  `{contentType: "scanned", contentTypeOverridden: true}`. Screenshots:
  `verification-screenshots/M2-override-before-reload.png`,
  `verification-screenshots/M2-override-after-reload.png`.
- ✓ Upload a large-ish PDF (15+ pages) — confirm the UI doesn't freeze/hang during upload and page
  navigation stays responsive — uploaded the hand-built 18-page `large18.pdf`. Upload (through
  pdf.js parsing + per-page `getTextContent()` metadata extraction for all 18 pages, per M2's
  lazy-rasterization design) completed in 819ms. During the upload, a background probe repeatedly
  round-tripped a trivial `page.evaluate()` call every 200ms to detect main-thread blocking; all
  4 samples returned in 2–4ms, i.e. the UI thread was never blocked for a perceptible stretch.
  After upload, the doc detail correctly showed "PDF · 18 pages" with all 18 rows present in the
  page-nav strip, each auto-detected as `text`. A follow-up interaction (changing the content-type
  override on page 10 and then page 18) completed in 118ms total with zero console errors.
  Screenshot: `verification-screenshots/M2-large-pdf-upload.png`. Caveat: this fixture PDF is
  small in byte size (hand-written minimal pages, no embedded raster images) even though it has
  18 real pages that go through the actual metadata-extraction code path — it stresses "does the
  per-page-loop architecture scale to 15+ pages without janking" but not large file I/O per se,
  since no PDF-generation library was available in this environment to produce a heavier file.

## Supplementary (cheap checks re-run per CLAUDE.md policy)

- `npm run lint` — `eslint .`, exited 0, no output.
- `npm test` (vitest) — 4 test files, 18 tests, all passed, exited 0.

## Summary

All 5 M2 checklist items pass. No blockers, no ✗ items. Page count detection, content-type
auto-detection (text vs. scanned), manual override with persistence, full-reload persistence
sourced from IndexedDB (not React state), and large-document upload responsiveness were all
directly observed via Playwright driving a real Chromium browser against the running dev server,
with IndexedDB state inspected directly via `page.evaluate` rather than inferred from the UI
alone. Per the M2 context notes, no attempt was made to verify a rendered page thumbnail in the
document view — that is explicitly deferred to lazy rasterization in M3 and is out of scope for
this milestone's rubric.
