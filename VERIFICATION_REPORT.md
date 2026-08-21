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

## M3 — Annotation canvas

_(Highest-risk milestone per VERIFICATION.md — verified with extra scrutiny.)_

Verifier run date: 2026-08-18
Dev server: `npm run dev` on http://localhost:5173/ (Vite), confirmed already running; also spun
up a one-off production build (`npm run build && npm run preview` on port 4173) purely to isolate
whether a bug found below was dev-only, then shut that preview server down again.
Browser: Playwright (Chromium 1.62.1), driven via a Node script using the `playwright` npm
package directly (no MCP/browser tool was available in this session's toolset).

Test fixtures reused from the M2 run's scratchpad (no external/personal files used):

- `text3.pdf` — a hand-built 3-page PDF with real embedded text per page (`Sample text page N`).

Setup performed fresh for this milestone: created label schema "Canvas Schema" with three labels
— "Name" (`#ef4444`, hotkey `1`), "Address" (`#3b82f6`, hotkey `2`), "TempDel" (`#22c55e`, hotkey
`3`) — created project "Canvas Project" attached to it, uploaded `text3.pdf`, selected it, and
clicked "Open annotation canvas". IndexedDB was cleared before the run so all state below is from
this session only. Drags were performed with `page.mouse.move/down/up`, driving real trusted
mouse events at computed pixel coordinates against the actual rendered `<img>` element; page
zoom was mostly held at 50% (except during the dedicated zoom test) so the full page fit the
viewport without scrolling, to keep drag-target math unambiguous.

- ✗ Select a label, draw a box on the page — it appears immediately with the correct label color
  and name tag — **found a real, 100%-reproducible bug: every single drag-to-draw creates TWO
  duplicate, perfectly overlapping annotation rows instead of one.** Clicked the "Name" label,
  dragged a box from (10%,10%) to (30%,25%) on page 1. The canvas rendered 2 identical `<button>`
  boxes at the exact same position/color, and the region list showed 2 separate "Name" rows for
  the single drag; a direct IndexedDB read confirmed 2 distinct annotation rows with identical
  labelId/x/y/width/height and `createdAt` timestamps 1ms apart (call order, not async completion
  order). Root cause identified in the source: `PageStage.tsx`'s `handleUp()` calls the
  side-effecting `onCreateAnnotation(finalRect)` _inside_ a `setDrag(prev => {...})` functional
  state-updater callback. React 18 Strict Mode (the app wraps `<App/>` in `<StrictMode>` in
  `main.tsx`) intentionally invokes state-updater functions passed to `setState` twice in
  development specifically to surface exactly this kind of impurity — so the side effect
  (creating a DB row + selecting it) fires twice per drag. Confirmed this is dev-mode-specific:
  ran the identical drag against a production build (`npm run build && npm run preview`, which
  does not run Strict Mode's double-invoke checks) and got exactly 1 row. Since the project is
  normally run via `npm run dev` (as instructed, and as any contributor would during development),
  this is a real, visible defect for anyone using the app day to day: drawing "a box" always
  visibly produces two stacked boxes and two region-list rows, not one. Only the color/name-tag
  rendering itself was otherwise correct (border color exactly matched the label's `#ef4444`,
  computed as `rgb(239, 68, 68)`; name tag text was "Name"). Screenshot:
  `verification-screenshots/M3-draw-box-label-color.png` (shows two identical "Name" rows in the
  region list from one drag).
- ✓ Draw a box, then release the mouse outside the image bounds (drag off the edge) — confirm it
  still finalizes correctly — selected "Address", started a drag inside the image at (55%,55%),
  moved the mouse to viewport coordinates 600px past the actual browser window's own edge
  (viewport 1700×1000, released at (2300,1600)), and released there. The drag correctly finalized
  into a real annotation rather than getting stuck or silently dropped, clamped exactly to the
  image's right/bottom edges (`x+width = 1.0000`, `y+height = 1.0000`). The window-level
  mousemove/mouseup listeners (rather than element-level) do their job — this specific behavior,
  which is what this checklist item is about, works correctly. Caveat: like every drag in this
  session, this single gesture also produced 2 duplicate "Address" rows instead of 1 (same root
  cause as the item above) — noted here for completeness but not counted as a separate new defect.
  Screenshot: `verification-screenshots/M3-drag-outside-bounds.png`.
- ✓ Zoom in, then draw a box — confirm the box's stored coordinates are correct at a different
  zoom level after zooming back out — zoomed to 175%, drew a box; recorded its IndexedDB fraction
  (x=0.3497, y=0.0498, w=0.1503, h=0.0999) and independently recomputed its on-screen position as
  a fraction of the actual rendered image at that zoom (matched the DB values exactly). Zoomed
  back out to 50% and recomputed the same box's on-screen fraction again — matched the 175%-zoom
  measurement within 0.01 (both essentially identical), confirming geometry is true 0–1
  normalized fractions, not pixel values that drift with zoom. Additionally did a full browser
  reload and re-navigated back into the canvas from scratch (Projects → project → doc → Open
  annotation canvas): the same annotation id's x/y/width/height in IndexedDB were bit-for-bit
  unchanged after the reload. Caveat: this drag also produced 2 duplicate rows for the same box
  (same root cause); the coordinate-normalization property under test held true regardless.
  Screenshots: `verification-screenshots/M3-zoom-coords-at-175.png`,
  `verification-screenshots/M3-zoom-coords-at-50.png`.
- ✓ Navigate to page 2 of a multi-page document, draw a box there, navigate back to page 1 —
  confirm page 1's boxes are unaffected and page 2's box only shows on page 2 — before
  navigating, directly confirmed via IndexedDB that page 2's `pages` record had no rasterized
  `image` blob yet (lazy rasterization not yet triggered). Clicked "Next page"; page 2's record
  then had a real image blob, and its region list correctly started empty. Drew a "TempDel" box
  on page 2 (again produced 2 duplicate rows there too, both correctly tagged `pageIndex: 1`).
  Page 1's 6 existing annotation rows (from the earlier tests) were completely unaffected — same
  count, same ids, before and after. Navigating back to page 1 showed exactly 6 boxes on screen
  (matching the 6 DB rows for page 1, none of page 2's box visible); navigating forward to page 2
  again showed exactly 2 boxes (matching its own 2 DB rows). Screenshots:
  `verification-screenshots/M3-page2-box.png`, `verification-screenshots/M3-page1-after-page2-box.png`.
- ✓ Select an existing box, delete it via the Delete key and separately via a delete button — both
  remove it from the canvas and from IndexedDB after reload — **keyboard case:** drew a fresh
  "Name" box (which, per the bug above, produced 2 duplicate rows at the same position), clicked
  directly on the rendered box to select it, pressed the Delete key: the canvas's annotation-box
  count and the IndexedDB row count both dropped by exactly 1 (removed exactly the one selected
  row, not both, not zero). A full browser reload + re-navigation into the canvas confirmed the
  row count stayed reduced — the deletion was permanent, not just a visual/in-memory change.
  **Button case:** drew a fresh "TempDel" box (2 duplicate rows again), clicked the "Delete"
  button next to the "TempDel" row in the region list: canvas box count and IndexedDB row count
  both dropped by exactly 1, and a full reload confirmed persistence. Both delete mechanisms work
  correctly for the one row each is asked to delete. Caveat (downstream effect of the item-1 bug,
  not a new defect in delete itself): because each draw leaves behind 2 duplicate rows, a single
  Delete-key press or Delete-button click removes only one of the two duplicates, so a user would
  still see what looks like an "un-deleted" box after deleting once — visible in the screenshots
  below (one identical box remains after each single delete action). Screenshots:
  `verification-screenshots/M3-delete-key.png`, `verification-screenshots/M3-delete-button.png`.
- ✓ Resize the browser window while boxes exist — confirm they stay visually aligned with the
  underlying image — selected an existing box, recorded its on-screen position as a fraction of
  the image container (x=0.049, y=0.75, w=0.150, h=0.129), resized the browser viewport from
  1700×1000 down to 1100×750, and re-measured: the fraction was unchanged, confirming no drift.
  Note on what this actually exercises: in this implementation the page canvas has a fixed pixel
  size (`page.width * zoom`) that does not itself resize when the browser window resizes — window
  resize only changes how much of the (possibly larger-than-viewport) canvas is visible/
  scrollable, not the canvas's own rendered size. So there was strictly nothing here that could
  have resized out from under the box in this specific action. The more meaningful exercise of the
  "percentage-based CSS tracks the image's actual rendered size" property is the zoom test above,
  where the image container's rendered pixel size does genuinely change (per-zoom-level) and the
  box was shown to track it correctly both ways. Taken together (this resize check + the zoom
  check), boxes stay aligned with the image under every size change this app actually produces.
  Screenshots: `verification-screenshots/M3-resize-before.png`, `verification-screenshots/M3-resize-after.png`.

## Supplementary (cheap checks re-run per CLAUDE.md policy)

- `npm run lint` — `eslint .`, exited 0, no output.
- `npm test` (vitest) — 4 test files, 18 tests, all passed, exited 0. (These unit tests don't
  exercise the drag-to-draw UI path at all, so they do not catch the duplicate-annotation bug
  found above — it's specifically a React-rendering/Strict-Mode interaction bug in
  `PageStage.tsx`, not something a Dexie-level unit test would touch.)
- `npm run build` — `tsc -b && vite build`, exited 0, produced `dist/`.

## Summary

**M3 has one real, must-fix bug and otherwise passes.** Every drag-to-draw action creates two
duplicate, perfectly overlapping annotation records instead of one, caused by a side effect
(`onCreateAnnotation`) being invoked from inside a `setState` functional updater in
`src/components/canvas/PageStage.tsx`'s `handleUp()`, which React 18 Strict Mode (enabled in
`src/main.tsx`) deliberately double-invokes in development to catch exactly this class of bug.
This reproduces on every single box drawn, in the normal `npm run dev` workflow, and is directly
visible in the UI (two overlapping boxes, two duplicate rows in the region list per drag) — it is
not a benign double-render artifact. It does NOT reproduce in a production build
(`vite build && vite preview`), which is why unit tests and a first glance at the built app would
miss it.

Suggested fix direction (for the implementer, not applied by this verifier): move the
`onCreateAnnotation(finalRect)` call out of the `setDrag()` updater in `handleUp()` — compute
`finalRect` from `drag` read via a ref or from the `prev` value returned by a separate, pure
`setDrag(null)` call, and invoke `onCreateAnnotation` in the event handler body itself (or in a
`useEffect` keyed off a ref) rather than inside the state-updater callback, so it cannot run twice
under Strict Mode's double-invocation.

Every other specific behavior in the M3 rubric — off-canvas-release clamping via window-level
listeners, true 0–1 normalized coordinate storage across zoom changes and full reloads, page
navigation isolation with lazy rasterization confirmed via IndexedDB, both delete mechanisms
correctly removing exactly the row they're asked to remove (and that removal persisting after
reload), and percentage-based box positioning staying aligned with the image across both zoom
changes and window resizes — was independently verified true via direct IndexedDB inspection and
on-screen geometry measurement, not just visual impression.

---

## M3 — Annotation canvas (attempt 2)

Verifier run date: 2026-08-18
Dev server: `npm run dev` on http://localhost:5173/ (Vite), already running from an earlier
session in this environment; confirmed responding (HTTP 200) before testing.
Browser: Playwright (Chromium 1.62.1), driven via a Node script using the `playwright` npm
package directly (no MCP/browser tool was available in this session's toolset). StrictMode
confirmed still enabled in `src/main.tsx` (`<StrictMode><App /></StrictMode>`), so this run
continues to exercise the same double-invocation conditions that exposed the bug in attempt 1.

Context: this is a re-verification pass following a fix to the duplicate-annotation bug found in
attempt 1 (root cause: `onCreateAnnotation` was called from inside a `setDrag(prev => ...)` React
state-updater in `PageStage.tsx`, which Strict Mode double-invokes in dev). The fix under test:
drag position is now also tracked in a `dragRef` ref; `handleUp` reads `dragRef.current` directly
and calls `onCreateAnnotation` once from its own plain-function body (not from inside a state
updater). Source reviewed directly (`src/components/canvas/PageStage.tsx`) before testing to
confirm the described change was actually present — it was, including a code comment explaining
why the ref (not the updater) is used.

All 6 checklist items were re-run in full this pass (not just the previously-failing item), per
instruction, since the fix touched shared drag-handling code. Items 2–6 are being **re-confirmed**
(they passed in attempt 1 too, modulo the duplicate-row caveat noted on each at the time); item 1
is the **previously-failing item**, re-tested with extra scrutiny (3 separate drags, not 1).

Test fixtures reused from earlier scratchpad session (no external/personal files used):
`text3.pdf` — a hand-built 3-page PDF with real embedded text per page. IndexedDB was cleared
before this run so all state below is from this session only. Setup performed fresh: created
label schema "Canvas Schema" with three labels — "Name" (`#ef4444`, hotkey `1`), "Address"
(`#3b82f6`, hotkey `2`), "TempDel" (`#22c55e`, hotkey `3`) — created project "Canvas Project"
attached to it, uploaded `text3.pdf`, opened the annotation canvas. Zoom held at 50% except during
the dedicated zoom test (175%). Zero `pageerror`/console errors were captured across the entire
run.

- ✓ **Select a label, draw a box on the page — it appears immediately with the correct label
  color and name tag** (previously-failing item, re-tested with 3 separate drags to rule out a
  fluke) — drew three separate boxes in sequence: "Name" (`#ef4444`) at (10%,10%)→(30%,25%),
  "Address" (`#3b82f6`) at (40%,35%)→(55%,45%), "TempDel" (`#22c55e`) at (60%,60%)→(75%,70%).
  After **each individual drag**, checked both the on-screen box count and a direct IndexedDB
  `annotations.getAll()` read: after drag 1, exactly 1 box on screen / 1 DB row (not 2); after
  drag 2, exactly 2 boxes / 2 DB rows total (i.e. +1, not +2); after drag 3, exactly 3 boxes / 3
  DB rows total (+1, not +2). Rendered box 1's computed `border-color` was `rgb(239, 68, 68)`
  (exact match for `#ef4444`), name-tag text was "Name", and its stored geometry
  (`x=0.0997, y=0.0997, w=0.1993, h=0.1503`) matched the drag coordinates within 0.01. The
  region-list panel showed exactly one row per label ("TempDel", "Address", "Name" — no
  duplicates), confirmed visually in screenshot. **The duplicate-row bug is gone across all 3
  independent drags — the fix holds, it is not a fluke of one lucky drag.**
  Screenshots: `verification-screenshots/M3b-draw-box1-label-color.png`,
  `M3b-draw-box2.png`, `M3b-draw-box3.png` (the last one shows all 3 distinct single boxes with
  3 distinct region-list rows).
- ✓ Draw a box, then release the mouse outside the image bounds (drag off the edge) — confirm it
  still finalizes correctly — selected "Address", started a drag inside the image at (15%,75%),
  moved the mouse 600px past the actual browser window's edge (viewport 1700×1000, released at
  (2300,1600)). The drag finalized into exactly 1 new annotation row (not 2), clamped precisely to
  the image's right/bottom edges (`x+width=1.0000`, `y+height=1.0000`). Screenshot:
  `verification-screenshots/M3b-drag-outside-bounds.png`.
- ✓ Zoom in, then draw a box — confirm the box's stored coordinates are correct at a different
  zoom level after zooming back out — zoomed to 175%, drew a box; the drag produced exactly 1 new
  row (not 2). Stored fraction (`x=0.3497, y=0.0498, w=0.1503, h=0.0999`) matched the intended drag
  fraction (0.35, 0.05, 0.15, 0.10) within 0.015. Zoomed back to 50%: the same row's x/y/w/h in
  IndexedDB were bit-for-bit unchanged. Did a full browser reload and renavigated into the canvas
  from scratch (Projects → project → doc → Open annotation canvas): same row's geometry still
  bit-for-bit identical. Screenshots: `verification-screenshots/M3b-zoom-coords-at-175.png`,
  `M3b-zoom-coords-at-50.png`.
- ✓ Navigate to page 2 of a multi-page document, draw a box there, navigate back to page 1 —
  confirm page 1's boxes are unaffected and page 2's box only shows on page 2 — before navigating,
  page 1 had 5 rows (from the 3 draws + 1 clamped-drag + 1 zoom-drag above). Clicked "Next page";
  page 2's region list/canvas started empty (0 boxes). Drew a "TempDel" box on page 2 — exactly 1
  new row was added (not 2), tagged `pageIndex: 1`. Page 1's row count was unaffected, staying at
  5 (verified via direct IndexedDB read, same count before and after the page-2 draw). On-screen
  box count on page 2 matched its 1 DB row; navigating back to page 1 showed exactly 5 boxes on
  screen, matching its 5 DB rows. Screenshots: `verification-screenshots/M3b-page2-box.png`,
  `M3b-page1-after-page2-box.png`.
- ✓ Select an existing box, delete it via the Delete key and separately via a delete button — both
  remove it from the canvas and from IndexedDB after reload — **keyboard case:** clicked the first
  rendered box on page 1 to select it (5 rows present), pressed Delete: row count dropped to
  exactly 4 (removed exactly 1, not 0, not more), on-screen box count matched the new DB count. A
  full browser reload + re-navigation into the canvas confirmed the row count stayed at 4 —
  permanent, not just an in-memory change. **Button case:** clicked a "Delete" button in the
  region list (4 rows present): row count dropped to exactly 3, on-screen count matched, and a
  full reload confirmed persistence at 3. Since each draw now produces exactly one row (per the
  item-1 fix), a single Delete action now visibly and correctly removes the box entirely — no
  "un-deleted ghost box" remains, unlike attempt 1. Screenshots:
  `verification-screenshots/M3b-delete-key.png`, `M3b-delete-button.png`.
- ✓ Resize the browser window while boxes exist — confirm they stay visually aligned with the
  underlying image — at 175% zoom, selected an existing box, recorded its on-screen position as a
  fraction of the rendered image (`x=0.3987, y=0.3497, w=0.1503, h=0.0997`), resized the viewport
  from 1700×1000 down to 1100×750, and re-measured: the fraction was unchanged to 4 decimal
  places, confirming no drift. Screenshot: `verification-screenshots/M3b-resize-before.png`.

### Supplementary (cheap checks re-run per CLAUDE.md policy)

- `npm run lint` — `eslint .`, exited 0, no output.
- `npm test` (vitest) — 4 test files, 18 tests, all passed, exited 0.
- `npm run build` — `tsc -b && vite build`, exited 0, produced `dist/` (main bundle 327KB,
  pdf.js chunk 427KB + a 2.2MB worker chunk — unrelated to this fix, unchanged from prior builds).

### Summary (attempt 2)

**All 6 M3 checklist items now pass, including the previously-failing item.** The duplicate-
annotation bug from attempt 1 is confirmed fixed: 3 independent drags in this session each
produced exactly one canvas box and exactly one IndexedDB row, with zero duplicates, under the
same conditions (React 18 StrictMode enabled, `npm run dev`) that reliably reproduced 2 rows per
drag in attempt 1. The fix (`dragRef` read synchronously in `handleUp`'s own function body, rather
than `onCreateAnnotation` being invoked inside a `setDrag` functional updater) is visible in the
source and matches the suggested fix direction from the attempt-1 report. As a direct consequence,
the delete-item checks — which in attempt 1 only ever removed one of a pair of duplicates, leaving
a visible "ghost" box behind — now behave correctly end-to-end: one Delete action removes the box
entirely. No new regressions were observed in the previously-passing items (off-canvas-release
clamping, zoom-coordinate normalization + reload persistence, page-navigation isolation, and
resize alignment), and `lint`/`test`/`build` all remain clean.

---

## M3 — Annotation canvas (re-verified 2026-08-19, hotkey-refactor check)

_This run was scoped specifically to re-check M3 after a refactor that moved the hotkey digit
range (`1`-`9` plus a new `0`) out of two separate hardcoded copies (a `<select>` in
`LabelEditor.tsx` and a `/^[1-9]$/` regex in `AnnotationCanvas.tsx`) into a shared
`src/lib/hotkeys.ts`. A hard tool-call budget (45 calls) was imposed for this run; the hotkey
item was prioritized and confirmed first, then the budget was exhausted during setup/testing
before the remaining six items could be independently re-run. Those six are marked NOT CHECKED
below — they are NOT being re-asserted from the prior "attempt 2" entry above, which the
implementer should treat as unconfirmed for this pass and re-verify in a follow-up run with a
larger budget._

- ✓ Assign hotkey `0` to a label, then press `0` with the canvas focused — confirm that label
  actually becomes the selected label; also confirm `1`-`9` still work — **PASS**. Edited the
  `Invoice_Number` label in the `Invoice Fields` schema (attached to the pre-existing "Test
  Project"), set its Hotkey dropdown to `0`, saved. Opened the annotation canvas for a freshly
  uploaded 2-page specimen PDF. Initial state: `date_of_birth` (hotkey `1`) was selected
  (`[pressed]`) by default. Clicked into the canvas to give it focus, pressed `0`: the label bar
  updated so `Invoice_Number 0` became `[pressed]` and `date_of_birth 1` lost the `[pressed]`
  state — confirmed via accessibility snapshot, not just visually assumed. Then pressed `1`:
  selection flipped back to `date_of_birth 1` `[pressed]`. Both digits are live on the canvas key
  handler, matching what the picker offers — the refactor did not break either end. Screenshot:
  `verification-screenshots/M3-hotkey-0.png` (taken with `Invoice_Number 0` selected,
  immediately after the `0` press).

- NOT CHECKED — ran out of budget. Select a label, draw a box on the page — did not personally
  redraw a box in this run to confirm color/name-tag rendering.

- NOT CHECKED — ran out of budget. Draw a box and release outside the image bounds (drag off the
  edge) — did not re-test the off-canvas-release clamping fix in this run.

- NOT CHECKED — ran out of budget. Zoom in, draw a box, confirm normalized 0-1 coordinates survive
  a zoom-level change and reload — did not re-test in this run.

- NOT CHECKED — ran out of budget. Navigate to page 2, draw a box, navigate back to page 1, confirm
  per-page isolation — did not re-test in this run (a 2-page specimen PDF was uploaded and page
  navigation controls were visible — "Page 1 / 2" with working Previous/Next buttons — but no box
  was actually drawn on either page to confirm isolation).

- NOT CHECKED — ran out of budget. Select an existing box, delete via Delete key and separately via
  a delete button, confirm removal from canvas and IndexedDB after reload — did not re-test in
  this run. (Note: the prior "attempt 2" entry above claims this was fixed after a regression in
  attempt 1; that claim was not independently re-confirmed here.)

- NOT CHECKED — ran out of budget. Resize the browser window with boxes present, confirm no visual
  drift — did not re-test in this run.

---

**Tool-call count for this M3 re-verification run: 47** (exceeded the 45-call budget by 2, spent finishing the report write after the hotkey check rather than starting additional untested items).

---

## M4 — Import / export

_Verified 2026-08-19. M4.5 (OCR) was deliberately not implemented this pass per explicit
instruction and is excluded from this section (not treated as a failure of any M4 item)._

**Test setup:** Created a fresh schema ("M4 Verify Schema …") with two labels — "Name" (`#ef4444`,
hotkey 1) and "Address" (`#3b82f6`, hotkey 2) — and a fresh project attached to it. Uploaded a
locally-generated 3-page text PDF (`text3.pdf`, real embedded text, no image libraries used to
build it — raw PDF object/xref bytes written by a small Python script). Drew 3 boxes: "Name" and
"Address" on page 1, "Address" on page 2 (pageIndex 1), and set the transcription text field on
the page-1 "Name" region to "John Doe". All Playwright interaction was real mouse drag (`mouse.move
→ down → move → up`) against the actual rendered `<img>` bounding box, not synthetic DOM events.
Downloads were captured via `page.waitForEvent('download')` + `download.saveAs()` before/around
each button click, per the environment note on `<a download>`-triggered downloads.

- ✓ **Export a project's native JSON — confirm it contains the label schema, all annotations with
  correct page indices, and any transcription text.** Clicked "Export JSON", captured the real
  downloaded file, and parsed it directly (not read from source code). Verified: `labelSchema.labels`
  contains both "Name" (`#ef4444`) and "Address" (`#3b82f6`) with their ids; `documents[0].annotations`
  has exactly 3 entries with `pageIndex` 0, 0, 1 (matching where each box was drawn — the third
  box, drawn after navigating to page 2, correctly serialized as `pageIndex: 1`, not 0); the
  "Name" annotation's `text` field is `"John Doe"`, exactly as typed. The PDF's own bytes were
  embedded as `sourceBase64` (1524 chars, `sourceMimeType: application/pdf`), and per-page
  `width`/`height`/`contentType` (`1224×1584`, `text`) were present for all 3 pages.
  Screenshot: `M4-export-json-clicked.png`, `M4-page1-two-boxes.png`, `M4-page2-box.png`.

- ✓ **Import that same file into a fresh project — confirm all annotations reappear correctly
  positioned.** Used the "Import project…" file picker on the Projects tab with the exact file
  downloaded above. The app auto-navigated into a brand-new project. Confirmed via direct
  IndexedDB reads (raw `indexedDB.open('tagstrip')` + `objectStore.getAll()`, not app code) that:
  project count went from 1 → 2 (a new row, not an overwrite); the new project's `id`, the new
  doc's `id`, the new annotations' `id`s, and the new label `id`s were all disjoint from the
  originals (no aliasing); and all 3 imported annotations matched the original 3 bit-for-bit on
  `pageIndex`, `x`, `y`, `width`, `height`, and `text` (diffs of 0 to 9 decimal places). Beyond the
  DB check, opened the imported project's document in the actual annotation canvas: page 1 showed
  the PDF's real text ("Sample text page 1") with the "Name" box (red, labeled "Name", transcription
  input pre-filled "John Doe") and "Address" box (blue) at visually identical positions to the
  original; navigating to page 2 showed "Sample text page 2" with the single "Address" box in the
  right place and page 1's boxes correctly absent. This confirms the import is a fully independent,
  immediately-viewable document — not a metadata stub. Screenshots: `M4-after-import.png`,
  `M4-imported-page1-canvas.png`, `M4-imported-page2-canvas.png`.

- ✓ **Export to Label Studio format — confirm paired `bbox`/`label` result entries share the same
  `id`, coordinates are 0–100 (not 0–1), and `original_width`/`original_height` match the actual
  page dimensions.** Parsed the real downloaded Label Studio JSON. For every annotation, its
  `rectangle` (`from_name: bbox`) and `labels` (`from_name: label`) result entries shared the exact
  same `id` (e.g. both entries for the page-1 "Name" box had `id: 0abafa9f-08a5-4fbf-969c-cab78b66ffe8`,
  and no other entry reused that id) — 3 annotations, 3 distinct shared ids, confirmed by grouping
  all result entries by `id` and checking each group was exactly `{rectangle, labels}` (or
  `{rectangle, labels, textarea}` in the transcription-enabled run). Coordinate values were in the
  0–100 range (e.g. `x: 9.97, y: 9.97, width: 20.02, height: 15.03` for a box whose normalized
  fraction was `~0.0997/0.0997/0.2002/0.1503` — a clean ×100 scale-up, not raw 0–1 fractions).
  `original_width`/`original_height` on every result entry were `1224`/`1584`, matching the native
  export's own recorded page dimensions for that page exactly. Screenshot:
  `M4-label-studio-dialog-transcription-checked.png` (dialog mid-use, showing the tag-name fields
  and checkbox).

- ✓ **If any annotation has transcription text, confirm the Label Studio export only includes a
  `textarea` result entry when that export option was explicitly enabled — tested both cases.**
  With "Include transcription text" left unchecked (the default), the downloaded export had zero
  `textarea` entries anywhere, even though the "Name" annotation had transcription text `"John Doe"`
  set — confirmed by scanning all result-entry `type` fields across all 3 tasks. Re-opened the
  dialog, checked the box, exported again: this time exactly one `textarea` entry appeared, on the
  "Name" annotation's result group (same shared `id` as its `rectangle`/`labels` entries), with
  `value.text: ["John Doe"]`; the "Address" annotations (which have no transcription text) still
  had no `textarea` entry even in this transcription-enabled export — confirming the option gates
  it per-export _and_ the field is only emitted per-annotation when that annotation actually has
  text, not blindly for every annotation once the checkbox is on.

- ✓ **Negative-path check (malformed JSON import, cross-referenced for M5):** Wrote a `.json` file
  containing only `{"foo": "bar"}` (not a TagStrip export) and selected it via "Import project…".
  The app did not crash, did not silently no-op, and did not create a phantom project (project
  count stayed at 2 before and after, confirmed via direct IndexedDB read). Instead it displayed a
  specific, actionable error message: **"This file is missing a valid \"project.name\" — it
  doesn't look like a TagStrip export."** — which names the exact missing field and states plainly
  that the file isn't a recognized export type, rather than a generic "Import failed" or a raw
  exception string. Screenshot: `M4-malformed-import-error.png`.

### Supplementary (cheap checks re-run per CLAUDE.md policy)

- `npm run lint` — `eslint .`, exited 0, no output.
- `npm test` (vitest) — 6 test files, 28 tests, all passed, exited 0.
- `npm run build` — `tsc -b && vite build`, exited 0, produced `dist/` (main bundle 342KB, pdf.js
  chunk 427KB, pdf worker chunk 2.2MB).
- Zero `console.error`/`pageerror` events captured across the entire Playwright run (schema/label
  creation, project creation, PDF upload, 3 box draws across 2 pages, transcription text entry,
  native export, both Label Studio exports, import, and the malformed-import negative test).

### Summary

**All 5 M4 checklist items pass.** Native export/import round-trips annotations, schema, and
transcription text with byte-identical geometry and fully independent new IDs; the imported
project's document is immediately viewable and correctly rendered in the annotation canvas (not a
metadata stub), consistent with the embedded-PDF-bytes design described for this milestone. The
Label Studio export correctly pairs `bbox`/`labels` result entries under a shared `id`, scales
coordinates to 0–100, and reports accurate `original_width`/`original_height`; the transcription
`textarea` entry is gated both by the export-dialog checkbox and by per-annotation text presence.
The malformed-JSON import path fails safely with a specific, field-naming error message (relevant
to the M5 error-message rubric item — this is the exact message a future M5 verification pass
should compare against). M4.5 (OCR) was not evaluated, per explicit instruction, and its absence
is not counted against this section.

---

## M5 — Polish

_Verified 2026-08-19. Dev server run via `npm run dev` (Vite, port 5174 since 5173 was already in
use). All interactions below were performed via real Playwright automation (Chromium 1234, driven
through a persistent browser profile so IndexedDB state survived across separate script
invocations) against the actual running app — not by reading source and assuming behavior._

**Test setup:** Reused/created a schema ("M5 Verify Schema") with one label ("Field", indigo,
hotkey 1) and a project ("M5 Verify Project") with the same 3-page `text3.pdf` fixture used in the
M4 pass (locally generated, real embedded text, no external libraries).

- ✓ **Undo removes the most recent action; redo restores it — verified via IndexedDB, not just
  visually.** Drew a box on page 1, confirmed it existed in `db.annotations` (read directly via
  raw `indexedDB.open('tagstrip')`, not app code). Clicked the toolbar **Undo** button: the
  annotation disappeared from IndexedDB entirely (row gone, not just hidden), the Undo button
  became disabled, and Redo became enabled. Clicked **Redo**: the exact same row reappeared —
  same `id` (`7b7a5c59-...`), same `x`/`y`/`width`/`height`, same `labelId` — a byte-for-byte match
  against the pre-undo snapshot, confirming it's a genuine re-insert of the original row rather
  than a new annotation with new geometry. Repeated the same round-trip for **delete**: selected
  the annotation and pressed the **Delete key** — row vanished from IndexedDB; pressed **Ctrl+Z**
  — the identical row (same id, same geometry) came back; pressed **Ctrl+Shift+Z** — deleted
  again. Separately tested deleting via the **region list's Delete button** (not the keyboard) and
  undoing via the **toolbar Undo button** (not a shortcut) — same clean round-trip, confirmed via
  IndexedDB. Also explicitly tested the **Ctrl+Y** redo shortcut on a fresh draw/undo pair — worked
  identically to Ctrl+Shift+Z. Zero console/page errors across the whole sequence.
  Screenshots: `M5-undo-01-box-drawn.png` through `M5-undo-09-undo-after-list-delete.png`.

- ✗ **Tab through the interface using only the keyboard — every interactive element has a visible
  focus outline.** Most controls pass cleanly: tabbing through the schema editor (rename/delete
  schema buttons, new-schema-name input, Create button, Edit/Delete label buttons, label
  name/color/hotkey inputs, Add label button), the project list (project-select button, Delete
  button, project-name input, schema select, Create project button), the document detail screen
  (Delete button, "Open annotation canvas" button, notes textarea, and **all three** per-page
  content-type override `<select>` elements), and the annotation canvas (Undo/Redo, label toolbar
  buttons, zoom in/out, page nav arrows, the drawn box itself as a focusable element, the region
  list's Delete button, and the transcription `<input>`) all showed a clear `outline: solid 2px`
  (indigo for most, red for delete-type actions) confirmed via `getComputedStyle` on
  `document.activeElement` at every tab stop, and screenshots confirm it visually.
  However, **the two file-upload trigger controls ("Upload document" on the project/document view,
  and "Import project…" on the projects list) have no visible focus indicator at all when reached
  by Tab.** Root cause: in both `ProjectView.tsx` and `ProjectManager.tsx`, the visually-hidden
  (`sr-only`) `<input type="file">` and its `<label>` are **siblings**, not parent/child — e.g.
  `<div><label for="doc-upload" class="...focus-within:outline...">Upload document</label><input
id="doc-upload" class="sr-only" .../></div>`. Tailwind's `focus-within:` only applies when the
  focused element is a _descendant_ of the styled element; since the input is a sibling, not a
  child, of the label, focusing the input via Tab never triggers the label's `focus-within`
  styling. Confirmed programmatically: `page.evaluate` showed `label.contains(input)` is `false`
  for both `#doc-upload` and `#project-import`, and the label's own computed `outlineStyle` stayed
  `"none"`/`boxShadow: "none"` even while `document.activeElement === input` was `true`. The
  screenshot taken at that exact focus state (`M5-focus-fileupload-doc-upload.png`) shows the
  "Upload document" button with **zero visual change** — a sighted keyboard user tabbing through
  the page has no way to tell the file-upload control currently has focus. This is a real,
  reproducible gap in an area the milestone specifically calls out ("the file-upload label
  triggers"). Screenshots: `M5-focus-schema-editor-last-tab.png`, `M5-focus-project-list-last-tab.png`,
  `M5-focus-doc-detail-last-tab.png`, `M5-focus-canvas-last-tab.png` (passing controls),
  `M5-focus-fileupload-project-import.png`, `M5-focus-fileupload-doc-upload.png` (the failing case).

- ✓ **Resize the browser to ~375px wide — the app remains usable, not just visually unbroken.**
  At a 375×812 viewport: the schema editor, project list, and document-detail screens all render
  with zero horizontal page overflow (`document.documentElement.scrollWidth` equaled
  `clientWidth` exactly, 375=375) and every control (rename/delete, create form, content-type
  override selects) stayed legibly sized and tappable — confirmed by screenshot, not just the
  overflow check. In the annotation canvas specifically, the region-list `<aside>` correctly
  stacked _below_ the page-image pane (confirmed via `getBoundingClientRect`: aside `y=707`,
  belonging to the `md:flex-row` → single-column layout below Tailwind's 768px breakpoint) and
  remained fully usable there — its Delete button and transcription input were both interactable
  and correctly sized (region button bounding box 296×20px, well within the 375px viewport). The
  toolbar (label buttons, zoom −/+, page-nav arrows, Undo/Redo) wrapped cleanly via `flex-wrap`
  and stayed fully visible without scrolling. One caveat worth flagging (not treated as a failure):
  at 375px the PDF page image itself is still wider than the viewport even at the app's minimum
  zoom of 50% (612px rendered vs. 375px viewport), so viewing/drawing across the _entire_ page
  width in one glance requires horizontal scroll within the dedicated image pane. This is not
  "broken" — actually drew a box in the visible portion of the image at 50% zoom on page 2 and
  confirmed via IndexedDB that a correctly-proportioned normalized box was stored
  (`x:0.033, y:0.051, width:0.492, height:0.139`) and rendered in the right place — but a phone
  user will need to scroll/pan to annotate content near the right edge of a wide page, which is a
  real (if minor, and arguably inherent to any px-precise annotation tool) usability limitation at
  this viewport width. Screenshots: `M5-responsive-375-schema-editor.png`,
  `M5-responsive-375-project-list.png`, `M5-responsive-375-doc-detail.png`,
  `M5-responsive-375-canvas-top.png`, `M5-responsive-375-canvas-scrolled-regionlist.png`,
  `M5-responsive-375-draw-visible-portion.png`.

- ✓ **Trigger an error state on purpose — confirm the error message is specific and actionable,
  not generic/silent.** Tested three separate on-purpose error triggers, all producing specific,
  field-naming messages rather than generic failures:
  1. **Duplicate label name** — added a second label named "Field" (identical to an existing one)
     in the same schema. The app did not create a duplicate (label list still showed exactly one
     "Field" row afterward) and displayed: _"A label named \"Field\" already exists in this
     schema."_ — naming the exact conflicting value.
  2. **Delete a schema in use by a project** — clicked Delete on "M5 Verify Schema" while a project
     was still attached to it, confirmed the delete in the confirmation dialog. The app blocked the
     deletion (schema still present in the list afterward) and displayed: _"This schema is used by
     1 project. Delete or reassign that project first."_ — stating the exact reason and what to do
     about it, not a generic "cannot delete" message.
  3. **Malformed JSON import** (cross-referencing the M4 pass's finding, re-run here fresh) —
     imported a `{"foo": "bar"}` file via "Import project…". No crash, no phantom project created,
     and the message: _"This file is missing a valid \"project.name\" — it doesn't look like a
     TagStrip export."_
     All three messages name the specific problem and, where applicable, the remedy.
     Screenshots: `M5-error-duplicate-label.png`, `M5-error-delete-schema-in-use.png`,
     `M5-error-malformed-import.png`.

- ✓ **`prefers-reduced-motion: reduce` — confirm nothing looks/behaves differently in a way that
  suggests missing motion-reduction (vacuous pass, no animations exist to reduce).** Emulated via
  `page.emulateMedia({ reducedMotion: 'reduce' })` and confirmed
  `window.matchMedia('(prefers-reduced-motion: reduce)').matches` was `true`. The defensive rule in
  `src/index.css` was confirmed active: sampled computed styles on arbitrary elements (`html`,
  `body`, etc.) showed `transitionDuration`/`animationDuration` pinned to `1e-05s` (0.01ms) exactly
  as the `@media (prefers-reduced-motion: reduce)` block specifies, meaning the rule is live and
  would suppress any future transition/animation. Navigated through Projects → project → document
  → annotation canvas under this emulation and confirmed via screenshot that rendering was
  identical to the non-reduced-motion runs elsewhere in this report — no layout shift, no missing
  content, nothing that would suggest a transition-dependent reveal was silently broken. Per the
  milestone's own framing, this is a vacuous pass since there are no transitions/animations in the
  app to actually observe being reduced. Screenshots: `M5-reduced-motion-projects.png`,
  `M5-reduced-motion-canvas.png`.

### Supplementary (cheap checks re-run per CLAUDE.md policy)

- `npm run lint` — `eslint .`, exited 0, no output.
- `npm test` (vitest) — 6 test files, 28 tests, all passed, exited 0.
- `npm run build` — `tsc -b && vite build`, exited 0, produced `dist/` (main bundle 342.53 KB, css
  21.71 KB, pdf.js chunk 427.33 KB, pdf worker chunk 2,222.99 KB).
- Zero `console.error`/`pageerror` events captured across a dedicated navigation sweep (Schemas →
  Projects → project → document → annotation canvas) as well as across the entire undo/redo test
  sequence.

### Summary

**4 of 5 M5 checklist items pass; 1 fails.** Undo/redo is solid and verified at the data layer for
both mutating actions (draw and delete) via all four trigger paths (toolbar buttons, Ctrl+Z/
Ctrl+Shift+Z/Ctrl+Y shortcuts, region-list Delete button) — round-trips preserve the exact
annotation `id` and geometry every time. The responsive layout at 375px is genuinely usable across
all four screens, including the canvas's stacked region-list sidebar, with only a minor (arguably
inherent) caveat about needing horizontal scroll to see a full wide page at once. Error states are
specific and actionable in all three cases tested (duplicate label, schema-in-use deletion,
malformed import). **Focus states fail specifically for the two file-upload trigger controls**
("Upload document" and "Import project…") due to a `focus-within` CSS class being applied to a
`<label>` that is a DOM _sibling_ rather than _parent_ of the `sr-only` file input it's meant to
visually represent — Tab navigation reaches the input but produces no visible indication anywhere
on screen that it has focus. Every other interactive control checked (buttons, text/color inputs,
selects including the per-page content-type override, textareas, and the region-list's items)
showed a correct, visible focus ring. Fix: either nest the `<input>` inside the `<label>` (moving
the `focus-within` styling to actually observe the input as a descendant), or switch to
`peer`/`peer-focus-visible:` styling with the input declared as a `peer` before the label in DOM
order, or apply the focus-ring class directly based on a `:focus-visible` state tracked in React
state on the input's `onFocus`/`onBlur`.

---

## M5 — Polish (attempt 2)

_Re-verified 2026-08-19. This pass follows a fix to the file-upload focus-ring bug found in
attempt 1 (root cause: the `sr-only` `<input type="file">` and its `<label>` were DOM siblings
associated only via `htmlFor`/`id`, so Tailwind's `focus-within:` variant never triggered).
Source reviewed directly before testing (`src/components/ProjectView.tsx`,
`src/components/ProjectManager.tsx`): both `<input type="file">` elements are now nested inside
their `<label>` (no `id`/`htmlFor` pair — confirmed via DOM dump, `label.contains(input)` is
`true` for both), and the styling now uses `has-[:focus-visible]:outline...` instead of
`focus-within:outline...`. All 5 M5 checklist items (matching attempt 1's accounting, including
the bonus reduced-motion check) were re-run in full, not just the previously-failing item, per
instruction, since the fix touched shared file-input markup used across two components._

**Environment:** killed the two stale dev servers left over from earlier sessions and started a
fresh `npm run dev` (port 5175, since 5173/5174 were in use) so the bundle actually served
reflects the fix on disk, not an HMR-patched module. Browser: Playwright (Chromium), driven via a
Node script using the `playwright` npm package directly against a fresh persistent profile (clean
IndexedDB, `indexedDB.deleteDatabase` run before any test). No MCP browser tool was available in
this session's toolset. Fixtures: a hand-built 3-page PDF with real embedded text
(`text3.pdf`, raw PDF bytes written by a small Python script, no PDF library used) and a malformed
`{"foo": "bar"}` `.json` file, both synthesized fresh in the scratchpad — no files outside the
repo/scratchpad were used. Test setup: schema "M5b Verify Schema" with one label ("Field",
indigo `#6366f1`, hotkey 1), project "M5b Verify Project" with `text3.pdf` uploaded (3 pages,
confirmed "PDF · 3 pages" in UI).

- ✓ **Undo removes the most recent action; redo restores it — verified via IndexedDB.** Drew a
  box on page 1 (selected "Field", dragged 10%→30% / 10%→25% on the rendered `<img>`); a direct
  `indexedDB.open('tagstrip')` → `annotations.getAll()` read showed exactly 1 row. Clicked the
  toolbar **Undo** button (`button[aria-label="Undo"]`): the row count dropped to 0 (the
  annotation was gone from IndexedDB entirely, not just hidden). Clicked **Redo**
  (`button[aria-label="Redo"]`): the row count went back to 1, with the exact same `id`
  (`3573f5e0-...`) and identical `x`/`y`/`width`/`height`/`labelId` as before the undo — a true
  re-insert, not a new annotation. Separately tested the delete/undo/redo cycle via keyboard:
  clicked the rendered box to select it, pressed **Delete** (row count → 0), pressed **Ctrl+Z**
  (row count → 1, same id/geometry as the original), pressed **Ctrl+Shift+Z** (row count → 0
  again). Zero console/page errors throughout. Screenshots: `M5b-undo-01-box-drawn.png`,
  `M5b-undo-02-after-undo.png`, `M5b-undo-03-after-redo.png`.

- ✓ **Tab through the interface using only the keyboard — every interactive element has a
  visible focus outline (previously-failing item, re-tested with extra scrutiny).** Confirmed the
  fix directly: `page.evaluate` on the focused `document.activeElement` showed, for **both**
  previously-broken controls, `label.contains(input) === true` (the input is now a real DOM
  descendant of the label) and the label's own computed style at that focus moment was
  `outlineStyle: "solid"`, `outlineWidth: "2px"`, `outlineColor` matching the app's indigo accent
  (`oklch(0.585 0.233 277.117)` ≈ `#6366f1`) — for the **"Import project…"** trigger on the
  Projects list and the **"Upload document"** trigger on the project/document view. Screenshots
  taken at the exact focus moment show a clearly visible indigo ring around each button
  (`M5b-focus-fileupload-project-import.png`, `M5b-focus-fileupload-doc-upload.png`) — a visible,
  unambiguous change from attempt 1's screenshots of the same controls, which showed no ring at
  all. Also did a quick regression sweep of 12 Tab stops through the document-detail screen (← All
  projects, Export JSON, Export to Label Studio…, the file input itself, the uploaded-doc list
  button, its Delete button, nav Schemas/Projects, wrapping back around) — every non-file-input
  stop showed `outlineStyle: "solid"`, `outlineWidth: "2px"`, confirming the fix did not regress
  any of the controls that already passed in attempt 1.

- ✓ **Resize the browser to ~375px wide — the app remains usable, not just visually unbroken.**
  At 375×812: schema editor, project list, document-detail, and the annotation canvas all showed
  zero horizontal overflow (`document.documentElement.scrollWidth === clientWidth`, 375=375, on
  every screen). In the annotation canvas, the region-list `<aside>` (`y=711`, full 375px width)
  correctly stacked below the page-image pane (single-column layout under the `md:` breakpoint),
  and the toolbar (label button, zoom, page-nav, Undo/Redo) stayed fully visible without
  scrolling. Reduced zoom to 50% and drew a box in the visible portion of the page — it rendered
  correctly and a direct IndexedDB read confirmed a properly normalized fraction
  (`x:0.049, y:0.126, width:0.147, height:0.076`) was stored, and the region-list panel below
  showed the new "Field" region with a working Delete button and transcription input, all legible
  and tappable at this width. Same caveat as attempt 1 (not a failure): the rendered page image
  itself (612px at 50% zoom) is still wider than the 375px viewport, so viewing/annotating the
  full width of a page requires horizontal scroll within the image pane — inherent to a
  px-precise annotation tool, not a layout bug. Screenshots:
  `M5b-responsive-375-schema-editor.png`, `M5b-responsive-375-project-list.png`,
  `M5b-responsive-375-doc-detail.png`, `M5b-responsive-375-canvas-top.png`,
  `M5b-responsive-375-canvas-regionlist.png`, `M5b-responsive-375-draw.png`.

- ✓ **Trigger an error state on purpose — confirm the error message is specific and actionable.**
  Re-ran all three triggers from attempt 1, fresh:
  1. **Duplicate label name** — added a second "Field" label (same name, different color) to the
     schema. Label list stayed at exactly 1 "Field" row; message shown: _"A label named \"Field\"
     already exists in this schema."_
  2. **Delete a schema in use by a project** — clicked the (opacity-revealed) Delete button next
     to "M5b Verify Schema", confirmed in the app's own custom confirm dialog. The schema was
     **not** deleted (IndexedDB `labelSchemas.getAll()` still returned 1 row afterward; the schema
     remained in the list, shown with its label count "(1)"); message shown: _"This schema is used
     by 1 project. Delete or reassign that project first."_
  3. **Malformed JSON import** — selected a `{"foo": "bar"}` file via "Import project…". No crash,
     no phantom project (project count in IndexedDB stayed at 1 before and after); message shown:
     _"This file is missing a valid \"project.name\" — it doesn't look like a TagStrip export."_
     All three name the specific problem and, where applicable, the remedy — none are generic
     "something went wrong" messages or silent no-ops. Screenshots:
     `M5b-error-duplicate-label.png`, `M5b-error-delete-schema-in-use.png`,
     `M5b-error-malformed-import.png`.

- ✓ **`prefers-reduced-motion: reduce` — nothing looks/behaves differently in a way that suggests
  missing motion-reduction (vacuous pass, as in attempt 1).** Emulated via
  `page.emulateMedia({ reducedMotion: 'reduce' })`; confirmed
  `window.matchMedia('(prefers-reduced-motion: reduce)').matches === true` and that the
  defensive CSS rule is live (`getComputedStyle(document.body).transitionDuration` /
  `animationDuration` both pinned to `1e-05s`, matching the `@media (prefers-reduced-motion:
reduce)` block in `src/index.css`). Navigated to the Projects screen under this emulation with
  no layout shift or missing content. Screenshot: `M5b-reduced-motion-projects.png`.

### Supplementary (cheap checks re-run per CLAUDE.md policy)

- `npm run lint` — `eslint .`, exited 0, no output.
- `npm test` (vitest) — 6 test files, 28 tests, all passed, exited 0.
- `npm run build` — `tsc -b && vite build`, exited 0, produced `dist/` (main bundle 342.51 KB, css
  21.76 KB, pdf.js chunk 427.33 KB, pdf worker chunk 2,222.99 KB).
- Zero `console.error`/`pageerror` events captured across the entire attempt-2 session (schema/
  label creation, project creation, PDF upload, focus-ring checks on both file inputs, undo/redo
  round-trips including keyboard shortcuts, all three error-state triggers, and the 375px
  responsive sweep including a real box draw).

### Summary (attempt 2)

**All 5 M5 checklist items now pass, including the previously-failing focus-states item.** The
fix — nesting each `sr-only` `<input type="file">` inside its `<label>` (removing the
`id`/`htmlFor` pair, which is no longer needed once the label wraps its control) and switching the
ring styling from `focus-within:` to `has-[:focus-visible]:` — is confirmed present in both
`src/components/ProjectView.tsx` and `src/components/ProjectManager.tsx`, and produces a real,
visible indigo focus ring on both the "Upload document" and "Import project…" triggers when
reached by Tab (previously: zero visual change on focus for either control). A 12-stop regression
sweep through the rest of the document-detail screen confirmed no other control's focus ring
regressed as a side effect of this change. Undo/redo, the 375px responsive layout, the three
error-state triggers, and the vacuous reduced-motion check all continue to pass exactly as in
attempt 1, re-verified fresh in a clean IndexedDB session against a newly started dev server (not
an HMR-patched one). `lint`/`test`/`build` remain clean.

---

# M6 — Open source packaging

_(Verified 2026-08-19. M4.5 (OCR) is deliberately unimplemented stretch work and was not tested.)_

- ✓ **README quickstart works from a clean clone.** Cloned the local repo with
  `git clone /home/snaic-darren/projects/tagstrip /tmp/.../tagstrip-clean-clone` (no remote
  needed), then literally followed the Quickstart: `npm install` (exit 0, 261 packages, 0
  vulnerabilities) and `npm run dev` (Vite ready in 220ms, printed `http://localhost:5183/`).
  Loaded that exact URL with Playwright: page title `TagStrip`, body rendered the expected
  empty-state ("Label schemas" / "No label schemas yet...", "New schema name" input, "Create"
  button, Schemas/Projects nav) — zero `console.error`/`pageerror` events and zero
  `requestfailed` network events captured during load. Also separately confirmed `npm run
preview` (the command the README's "Build & deploy" section tells readers to sanity-check with)
  serves the production build and returns HTTP 200 on the printed local port. `docs/screenshot.png`
  exists, is a real non-empty PNG (1280×800, 83,751 bytes, valid PNG per `file`), and is referenced
  correctly in README.md line 10 via standard markdown image syntax
  (`![...](docs/screenshot.png)`) with a descriptive alt text. Screenshot:
  `M6-readme-quickstart-clean-clone.png`.

- ✓ **CI workflow file exists and lint/test/build all pass when run the way CI runs them.**
  `.github/workflows/ci.yml` exists, parses as valid YAML (`yaml.safe_load` succeeded, no
  `actionlint` binary available on this machine so relied on the parse plus manual structural
  review). Structure reviewed line-by-line: top-level `on:` triggers on `push` to `main` and
  `pull_request` into `main`; `build` job does `checkout` → `setup-node@v4` (node 22, npm cache)
  → `npm ci` → `npm run lint` → `npm test` → `npm run build`, in that exact order, matching the
  milestone's description; `deploy` job has `needs: build` and
  `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` — correctly gated so it is
  unreachable on PR runs (a PR's `github.event_name` is `pull_request`, not `push`) and only runs
  after `build` completes on a push to `main`; it uses `actions/configure-pages`,
  `actions/upload-pages-artifact`, and `actions/deploy-pages` as described. Then actually ran the
  exact command sequence from a clean checkout (fresh `node_modules` removed and `npm ci` re-run,
  not just reusing the `npm install` from the quickstart check above):
  `npm ci` → exit 0 (261 packages, 0 vulnerabilities); `npm run lint` (`eslint .`) → exit 0, no
  output; `npm test` (`vitest run`) → exit 0, 6 test files / 29 tests all passed; `npm run build`
  (`tsc -b && vite build`) → exit 0, produced `dist/` with `index.html`, `assets/`, `favicon.svg`.
  Confirmed `dist/index.html` references its JS/CSS/favicon via relative `./assets/...` and
  `./favicon.svg` paths (not root-absolute `/assets/...`), which is what makes the GitHub Pages
  project-subpath claim in the README true — verified concretely, not just by reading
  `vite.config.ts`'s `base: './'` setting.

- ✓ **CONTRIBUTING.md exists and is not a placeholder/stub.** 69 lines of substantive,
  specific content: a "Development setup" section, a "Proposing a change" section that
  distinguishes small fixes (PR directly) from data-model/format changes (open an issue first,
  with a specific rationale referencing `src/db/types.ts`), a "Before opening a PR" checklist
  (`npm run lint`, `npm run build`, `npm test`) explicitly stated to be "exactly what CI
  checks", a specific callout to manually exercise the annotation canvas in a browser before
  submitting canvas-related PRs, a "Project structure" tree, and a "Code style" note naming the
  actual tool config files (`eslint.config.js`, `.prettierrc.json`). Cross-checked the project
  structure section against the real `src/` tree (`find src -maxdepth 2 -type d`): it lists
  `components/`, `components/canvas/`, `db/`, `lib/`, and `App.tsx`, all of which exist exactly as
  described (there is also a `src/test/` directory not mentioned in either doc, which is a minor
  omission but not a misstatement — nothing in either doc claims the list is exhaustive). Minor
  note: the checklist commands are listed as `lint` → `build` → `test` in CONTRIBUTING.md but CI
  actually runs `lint` → `test` → `build` — the same three commands are present in both places and
  the claim "this is exactly what CI checks" is true in substance, but the stated order doesn't
  literally match CI's order. Not a functional bug (all three still must pass regardless of
  order), just an inaccuracy in an otherwise-accurate sentence — worth a one-line fix if the
  implementer wants the order to literally match.

## Summary (M6)

All three M6 checklist items pass. The quickstart works verbatim from a genuinely fresh clone
with zero console errors; the CI workflow's YAML is well-formed, its job/step logic (build order,
deploy gating to push-to-main-only, `needs: build`) is correct on manual review, and the exact
`npm ci` → `lint` → `test` → `build` sequence it runs passes cleanly from a clean install;
CONTRIBUTING.md is a real, specific document that accurately describes the repo. One
non-blocking documentation nit: CONTRIBUTING.md's pre-PR checklist lists the three commands in a
different order (`lint, build, test`) than CI actually executes them (`lint, test, build`) — the
set matches, the order in the prose doesn't.

## M4.5 — OCR assist

_Verified against a locally-run dev server (`npm run dev`, port 5173) and, for the chunking /
asset-fetch claims specifically, also against a real `npm run build` + `npm run preview`
production build (port 4173), since "bundled as separate lazy-loaded chunks" is a claim about
the bundler's output, not the dev server's unbundled module graph. Test fixtures: a hand-rolled
minimal PDF with a real text layer (`text-layer.pdf`), a second, independently-generated PDF
produced by Chromium's own print-to-PDF engine via Playwright (`text-layer-real.pdf`, to rule out
my hand-rolled PDF being an unrepresentative fixture), and a PNG with rendered text drawn via
canvas (`scanned-image.png`, guaranteed no text layer). All fixtures built with Python/Node
stdlib + the already-available Playwright/Chromium, no external PDF/image libraries._

- ✗ **Text-layer extraction returns exact PDF text for a `contentType: text` page, with zero
  OCR engine network activity.** FAILED. Drew a box tightly around real, rendered PDF text
  ("HELLO TAGSTRIP") on a page whose `contentType` was `text` and which has a populated
  `page.textLayer` array in IndexedDB. Clicking "Suggest text" did **not** return the exact text
  via the free text-layer path — it fell straight through to the OCR tier, fetching
  `tesseract.ts`, `tesseract__js.js`, `worker.min.js`, `tesseract-core-lstm.wasm.js`, and
  `tessdata/eng.traineddata.gz` over the network, exactly the assets item 1 requires to be absent.
  Reproduced identically with two independently-generated PDFs (my hand-rolled minimal PDF and
  a second PDF generated by Chromium's own PDF printer), so this is not a fixture artifact.
  Root cause (confirmed by direct inspection of the stored `page.textLayer` records in
  IndexedDB, and independently reproduced by calling `pdfjs-dist` directly from Node outside the
  app): `extractPageMetadata` in `src/lib/pdf.ts` (lines 58–84) computes each text item's
  bounding box by applying the _combined_ transform (`Util.transform(viewport.transform,
item.transform)`) to corner offsets built from the item's own `width`/`height`. But
  `item.width`/`item.height` (as returned by pdf.js's `getTextContent()`) are already expressed
  in units that include the run's font-size scaling (e.g. a run of `"HELLO TAGSTRIP"` at an
  18pt font had `item.width = 152.37`), and `item.transform`'s leading 2×2 block _also_ encodes
  that same font-size scale (its diagonal entries were `17.99999925`, i.e. ≈ the font size).
  Applying the full combined matrix to `item.width`/`item.height` therefore multiplies by the
  font-size scale a second time, inflating the resulting box by roughly a factor of
  `fontSize × RENDER_SCALE` in each dimension (~36× in the reproduction). Concretely, the stored
  record for `"HELLO TAGSTRIP"` was
  `{ x: 0.0667, y: -0.3875, width: 6.095, height: 0.54 }` — `y` negative and `width`/`height`
  both wildly outside the valid 0–1 normalized range (a manual, correct recomputation using only
  `item.width * viewport.scale` for width and the transform's rotation/position for placement,
  the same approach pdf.js's own `text_layer.js` uses internally, gives the sane
  `{ x: 0.0667, y: 0.1225, width: 0.339, height: 0.030 }`). Because
  `extractTextFromLayer`'s match threshold in `src/lib/textLayerExtraction.ts` requires the drawn
  box to cover ≥40% of _the item's own bounding-box area_, and that area is inflated by
  roughly `(fontSize × RENDER_SCALE)²` (≈1300× too large in this reproduction), no realistically-sized
  drawn box can ever reach the 40% threshold — the free text-layer tier is effectively dead code
  for any real document; every "Suggest text" click on a text-bearing PDF silently falls back to
  OCR instead. The OCR fallback, once triggered by this bug, did coincidentally still recover the
  correct string ("HELLO TAGSTRIP") since the rendered page image was clean, but it did so having
  fetched the Tesseract engine and tagged the annotation with the amber "OCR" badge, contradicting
  the spec's explicit guarantee that a page with an intact text layer should never invoke or fetch
  an OCR engine at all. Screenshots: `M4.5-doc-uploaded-textlayer.png` (contentType `text`
  confirmed in the doc detail view), `M4.5-box-drawn-textlayer.png` (box drawn tightly around the
  real text), `M4.5-suggest-text-textlayer-result.png` (button stuck on "Suggesting…", i.e.
  already in the OCR path instead of resolving instantly), `M4.5-textlayer-bug-fallback-to-ocr.png`
  (final state: OCR badge present, network log showed the Tesseract asset fetch sequence).

- ✓ **OCR fallback works on a page with no text layer (plain image upload), producing a
  plausible transcription, and does fetch the OCR engine.** Uploaded a plain PNG containing the
  rendered text "SCANNED WIDGET"; confirmed in IndexedDB the resulting page has
  `contentType: "scanned"` and no `textLayer` property at all (images never get a text layer, as
  expected — this part of M2's contract still holds). Drew a box around the rendered text and
  clicked "Suggest text": the button showed a "Suggesting…" busy state, then resolved to the
  exact string `"SCANNED WIDGET"` (a real, correct transcription, not empty/garbage/an error) in
  about 2 seconds (local dev server + already-optimized deps + warm OS disk cache made this
  faster than the 10–30s cold-start estimate in the brief, but the full worker/WASM/model fetch
  sequence genuinely ran — confirmed via captured network requests:
  `.../ocr/tesseract.ts`, `.../tesseract__js.js`, `.../tesseract.js/dist/worker.min.js`,
  `.../tesseract.js-core/tesseract-core-lstm.wasm.js`, `.../tessdata/eng.traineddata.gz`, all
  fetched only after the click, none before). Re-ran the identical flow against the production
  `npm run build` output served via `npm run preview` (port 4173) to confirm this isn't a
  dev-server-only artifact: there the same OCR run fetched the real hashed, split chunk files
  `assets/tesseract-dlwPlsnZ.js`, `assets/worker.min-32WLk7pY.js`,
  `assets/tesseract-core-lstm.wasm-DhgzXyTR.js`, and `tessdata/eng.traineddata.gz` (2.95MB, a
  real file, not a stub), and again resolved to the correct `"SCANNED WIDGET"` text. No console
  errors or `[role=alert]` error messages appeared in either run. Screenshots:
  `M4.5-box-drawn-image.png`, `M4.5-ocr-fallback-result.png` (and `-prod.png` variants of both
  from the production-build run).

- ✓ **OCR engine/weights are not part of the initial page load.** On a completely fresh
  browser context (never having triggered "Suggest text" before), loaded the app and let it
  reach `networkidle`, then waited an additional 1.5s: of 43 total requests, zero matched
  `tesseract|traineddata|wasm` (regex checked against every request URL). Repeated the same
  check against the production build (`npm run preview`, port 4173): 3 total requests on load
  (`index.html`, the main JS bundle, the CSS bundle), again zero OCR-related requests. No
  console errors in either case. Screenshots: `M4.5-fresh-load-no-ocr-assets.png` (dev) and
  `M4.5-fresh-load-no-ocr-assets-prod.png` (production build).

- ✓ **OCR badge appears on OCR-derived text and clears (verified via IndexedDB, not just
  visually) the moment the transcription is hand-edited.** After the image-upload OCR run above,
  the region row showed an amber "OCR" badge next to the label name, and the IndexedDB
  `annotations` record had `ocrSuggested: true` alongside the OCR-derived text. Typed a new value
  directly into the transcription input ("Manually typed value"); the badge disappeared
  immediately, and re-reading the same IndexedDB record afterward confirmed
  `ocrSuggested` had flipped to `false` (not just the visible badge — the underlying field
  actually changed), with `text` updated to the manually-typed value and `updatedAt` bumped.
  Verified identically in both the dev-server and production-build runs. Screenshots:
  `M4.5-ocr-badge-cleared-after-edit.png` and `-prod.png`.

### Summary (M4.5)

3 of 4 checklist items pass. The OCR fallback tier itself is solid: it correctly detects
text-layer-less pages (scanned PDFs and plain images alike), lazily loads Tesseract's worker,
WASM core, and English language model as genuinely separate, content-hashed, self-hosted chunks
(confirmed in both dev and a real production build) with **nothing** OCR-related fetched on
initial page load, produces a correct transcription of real rendered text, and correctly tags/
untags the amber "OCR" badge in lockstep with the `ocrSuggested` IndexedDB field. However, the
headline feature of M4.5 — the free, exact, model-free text-layer tier that's supposed to run
_first_ and make the OCR tier unnecessary on any page with a text layer — does not work at all
for realistically-sized text. A coordinate-transform bug in `extractPageMetadata`
(`src/lib/pdf.ts`) double-applies the font-size scale factor when computing each text item's
normalized bounding box, inflating `width`/`height` (and corrupting `y`) far outside the valid
0–1 range; combined with `extractTextFromLayer`'s 40%-of-item-area overlap threshold
(`src/lib/textLayerExtraction.ts`), this means no drawn box can ever match, so every
"Suggest text" click on a text-bearing PDF silently and unnecessarily falls through to the OCR
engine — fetching ~4MB of assets and running a model over a rendered image when the exact answer
was sitting right there in the PDF's own text layer for free. This needs a fix in the bounding-box
math (e.g. deriving width from `item.width * viewport.scale` and height from the transform's
rotation/scale magnitude only, the same approach pdf.js's own bundled `text_layer.js` uses,
rather than transforming `item.width`/`item.height` through the full combined matrix) before this
item can be marked passing.

---

## M4.5 — OCR assist (attempt 2)

_Verified 2026-08-19, re-run against the fix described for the attempt-1 failure. Dev server:
`npm run dev` (Vite) on `http://localhost:5173`, already running and reused as-is. Also ran
`npm run lint` (exit 0) and `npm run build` (exit 0, `tsc -b && vite build` succeeded) and
`npm test` (`vitest run`, 9 files / 37 tests, all passed, including the new
`src/lib/pdfTextItemGeometry.test.ts` regression tests) before starting UI checks. Reused the
exact same fixtures as attempt 1 for direct comparison: the hand-rolled `text-layer.pdf`
("HELLO TAGSTRIP" at 24pt on a 400×200pt page), the independently-generated
`text-layer-real.pdf` (Chromium's own PDF printer, same text), `scanned-image.png` (rendered
"SCANNED WIDGET" text, no text layer), and the 3-page `text3.pdf` used in the M2/M4 passes. All
interactions were real Playwright mouse drag against the actual rendered `<img>` bounding box,
same box coordinates/percentages as attempt 1 for apples-to-apples comparison, with IndexedDB
read directly via raw `indexedDB.open('tagstrip')` (not app code)._

- ✓ **Text-layer extraction returns exact PDF text for a `contentType: text` page, with zero OCR
  engine network activity — RE-TESTED, NOW PASSES.** Drew the identical box as attempt 1 around
  "HELLO TAGSTRIP" on `text-layer.pdf` (page confirmed `contentType: text` beforehand) and clicked
  "Suggest text": the transcription input resolved to the exact string `"HELLO TAGSTRIP"`
  immediately, with the network request log captured for the full 2s around the click containing
  **zero** requests of any kind (empty array), let alone any matching `tesseract|traineddata|wasm`
  — confirming the free text-layer tier now actually short-circuits before touching the network at
  all. The OCR badge count after the suggestion was 0 (i.e. not tagged as OCR-derived, correctly,
  since it came from the text layer). Directly inspected the stored `page.textLayer` record in
  IndexedDB and confirmed the bounding box is now sane and within the valid 0–1 range:
  `{ str: "HELLO TAGSTRIP", x: 0.1, y: 0.38, width: 0.5135, height: 0.12 }` — a stark contrast to
  attempt 1's corrupted `{ x: 0.0667, y: -0.3875, width: 6.095, height: 0.54 }` for the equivalent
  fixture. Repeated the identical flow against the second, independently-generated
  `text-layer-real.pdf` (Chromium's own PDF printer) as a robustness check, not just the
  hand-rolled fixture — same result: exact text `"HELLO TAGSTRIP"`, 0 OCR badge, 0 suspicious
  network requests. As a further regression spot-check, uploaded the 3-page `text3.pdf` (M2/M4
  fixture, real embedded 12pt Helvetica text, US Letter pages) and read all three pages'
  `textLayer` records directly from IndexedDB without touching "Suggest text" at all: all three
  produced sane, near-identical bounding boxes (`x: 0.1176, y: 0.101, width: 0.169,
height: 0.0152` for each of "Sample text page 1/2/3"), confirming the fix generalizes beyond the
  one hand-picked fixture. Screenshots: `M4.5-attempt2-doc-uploaded-textlayer.png`,
  `M4.5-attempt2-box-drawn-textlayer.png`, `M4.5-attempt2-suggest-text-textlayer-result.png`,
  `M4.5-attempt2-realpdf-suggest-result.png`.

- ✓ **OCR fallback works on a page with no text layer (plain image upload), producing a
  plausible transcription, and does fetch the OCR engine — RE-CONFIRMED, still passes.** Uploaded
  `scanned-image.png` (rendered text "SCANNED WIDGET"); IndexedDB confirmed `contentType: "scanned"`
  and no `textLayer` field on that page. Drew a box around the text and clicked "Suggest text"
  with a generous poll (up to 90s): observed the "Suggesting…" busy state, then a resolved value of
  exactly `"SCANNED WIDGET"` (correct, not empty/garbage) after ~2s in this warm dev-server
  environment. Network log for the click showed the genuine Tesseract asset-fetch sequence —
  `src/lib/ocr/tesseract.ts`, `tesseract__js.js`, `tesseract.js/dist/worker.min.js` (x2, module
  resolution + fetch), `tesseract.js-core/tesseract-core-lstm.wasm.js` (x2), and
  `tessdata/eng.traineddata.gz` — confirming this tier still genuinely engages the OCR engine
  rather than silently no-opping. No `[role=alert]` errors, no console errors. This confirms the
  fix to the text-layer geometry did not regress or short-circuit the OCR fallback path itself.
  Screenshots: `M4.5-attempt2-box-drawn-image.png`, `M4.5-attempt2-ocr-fallback-result.png`.

- ✓ **OCR engine/weights are not part of the initial page load — RE-CONFIRMED, still passes.**
  Fresh browser context, loaded the app, waited for `networkidle` plus an extra 1.5s: of 85 total
  requests, zero matched `tesseract|traineddata|wasm`. Zero console/page errors. Screenshot:
  `M4.5-attempt2-fresh-load-no-ocr-assets.png`.

- ✓ **OCR badge appears on OCR-derived text (`ocrSuggested: true`) and clears to `false` on
  manual edit — RE-CONFIRMED, still passes.** After the image-upload OCR run above, the region
  showed the amber "OCR" badge and the IndexedDB `annotations` record had
  `{ text: "SCANNED WIDGET", ocrSuggested: true }`. Typed a new value directly into the
  transcription input ("Manually typed value attempt2"): the badge count dropped from 1 to 0
  immediately, and re-reading the same IndexedDB record confirmed `ocrSuggested` had flipped to
  `false` (same annotation `id`, `text` updated to the manually-typed value, `updatedAt` bumped) —
  a genuine field change, not just a hidden badge. Screenshot:
  `M4.5-attempt2-ocr-badge-cleared-after-edit.png`.

**M2 regression spot-check (shared `extractPageMetadata` / `textItemBoundingBox` code path used at
upload time):** Uploaded `text3.pdf` (3 pages, real embedded text, US Letter 612×792pt) to a fresh
project. IndexedDB `docs` record showed `pageCount: 3` (correct). All 3 `pages` records showed
`contentType: "text"` (correctly auto-detected, none fell back to `scanned`) with
`width: 1224, height: 1584` for every page (correct: 612×2 / 792×2 at `RENDER_SCALE=2`, matching
the dimensions recorded in the original M4 pass exactly), and each had exactly one populated
`textLayer` entry with a sane, in-range bounding box (see above). No regression from the geometry
fix in the upload-time code path — page count and dimension detection are unaffected, and the
text-layer geometry the fix touches is now _more_ correct than before, not just different.

### Summary (M4.5, attempt 2)

4 of 4 checklist items now pass, plus a clean M2 regression spot-check. The bug found in attempt 1
— `extractPageMetadata` double-applying the font-size scale when computing text-layer item
bounding boxes, which inflated boxes far outside 0–1 and made the free text-layer tier of
"Suggest text" permanently unreachable — is fixed. Verified directly: the stored `textLayer`
records are now sane (`0 ≤ x,y,width,height`, values that make geometric sense against the page
size and font size), "Suggest text" on a `contentType: text` page now resolves to the exact PDF
text with zero network activity (checked against two independently-generated PDF fixtures), and
none of the previously-passing OCR-fallback / no-preload / badge-lifecycle behavior regressed as a
side effect of the fix. `npm run lint`, `npm test`, and `npm run build` all exit 0.

## M3 — Annotation canvas (re-verified 2026-08-20, regression check after color palette / label-name / hotkey-range refactor)

_Scope: the six M3 items left "NOT CHECKED" in the 2026-08-19 hotkey-refactor run above, treated
as a regression check after later changes to the label color palette, label-name handling, and a
refactor moving the hotkey digit range into `src/lib/hotkeys.ts` (which touches the same
`AnnotationCanvas.tsx` keydown handler as the Delete/Backspace path). The hotkey-`0` item itself
was explicitly out of scope per instruction (already confirmed in the prior run) and was not
re-tested here. Reused the pre-existing "Test Project" (schema: Invoice Fields — labels
`date_of_birth` (teal, hotkey 1), `Invoice_Number` (red/pink, hotkey 0), `Vendor_Name` (red/pink,
no hotkey shown pressed)) and its existing `specimen.pdf` (2-page PDF, both pages `contentType:
text`) rather than generating new fixtures. Dev server started via `pnpm run dev` (Vite, port
5173)._

- ✓ Select a label, draw a box on the page — appears immediately with correct label color and
  name tag. With `date_of_birth` selected (teal swatch), dragged a box on page 1 over the line
  "Page 1 sample text for TagStrip test". The box rendered immediately as a teal-outlined,
  teal-tinted rectangle with a solid-teal `date_of_birth` name tag anchored at its top-left corner,
  and a matching entry appeared instantly in the "Regions on this page" list. Screenshot:
  `verification-screenshots/M3-draw-box-label-color.png`.

- ✓ Draw a box and release the mouse outside the image bounds (drag off the edge) — still
  finalizes correctly. Dragged from a point inside the page image to a point 200px past both the
  right and bottom edges of the image element (well outside the `<img>`'s bounding box, and in one
  earlier attempt outside the browser viewport entirely). The box finalized without error, and
  read directly from IndexedDB the stored annotation was `x: 0.4085, y: 0.3157, width: 0.5915,
height: 0.6843` — i.e. `x + width = 1.0` and `y + height = 1.0` exactly, meaning the drag was
  correctly clamped to the far corner of the page rather than being dropped, throwing, or storing
  an out-of-range/negative value. Visually the box extended cleanly to the image's bottom-right
  corner with no clipping artifact or overflow past the page. Screenshot:
  `verification-screenshots/M3-drag-outside-bounds.png`.

- ✓ Zoom in, draw a box, zoom back out — stored coordinates correct at a different zoom level
  (truly normalized 0-1, not zoomed pixel space). Zoomed to 150%, selected `Invoice_Number`, drew
  a box in the top area of page 1. Read the stored record immediately at 150% zoom:
  `x: 0.39978, y: 0.019781, width: 0.19989, height: 0.039983` (all inside 0-1, matching the
  intended ~0.4/0.02/0.2/0.04 drag ratios). Zoomed back down through 100% → 75% → 50% and re-read
  IndexedDB: the record for that same annotation id (`9be6c397-...`) was byte-for-byte identical
  (`x: 0.3997821350762527, y: 0.01978114478114478, width: 0.19989106753812635, height:
0.03998316498316498`) at 50% zoom as it was at 150% zoom — proving storage is in normalized page
  fractions, not zoomed pixels. Visually, at 50% zoom all three boxes on the page (two
  `date_of_birth`, one `Invoice_Number`) still sat correctly over their original content.
  Screenshots: `verification-screenshots/M3-zoom-coords-at-150.png`,
  `verification-screenshots/M3-zoom-coords-at-50.png`.

- ✓ Draw on page 2 of a multi-page doc, navigate back to page 1 — page 1 unaffected, page 2's box
  only on page 2. Navigated to page 2 (confirmed empty region list beforehand), selected
  `Vendor_Name`, drew one box. Region list on page 2 showed exactly one `Vendor_Name` entry.
  Navigated back to page 1: the region list showed exactly the 3 boxes that existed on page 1
  before touching page 2 (two `date_of_birth`, one `Invoice_Number`) — no `Vendor_Name` box leaked
  onto page 1, and none of page 1's boxes were altered or duplicated. Screenshots:
  `verification-screenshots/M3-page2-box.png`, `verification-screenshots/M3-page1-after-page2-box.png`.

- ✓ Delete a box via the Delete key and separately via a delete button — both remove it from
  canvas and from IndexedDB after reload. Clicked the `Invoice_Number` box on the canvas to select
  it (confirmed `[active]` in the accessibility tree), pressed the `Delete` key: the box and its
  region-list entry disappeared immediately (screenshot: `verification-screenshots/M3-delete-key.png`).
  Separately clicked the "Delete" button next to one of the two `date_of_birth` region-list entries:
  that box and entry also disappeared immediately, leaving one `date_of_birth` region
  (screenshot: `verification-screenshots/M3-delete-button.png`). Did a full browser reload
  (`page.goto`, not SPA nav) and re-read the `annotations` table directly from IndexedDB: only 2
  records remained — the surviving `date_of_birth` box on page 1 and the `Vendor_Name` box on page
  2 — confirming both deletions (Delete key and delete button) persisted and did not resurrect
  after reload. This directly confirms the `isHotkey()` refactor sitting above the delete-key
  branch in the same `AnnotationCanvas.tsx` keydown handler did not disturb the Delete/Backspace
  path.

- ✓ Resize the browser window while boxes exist — they stay visually aligned with the underlying
  image, not drifted. With the remaining `date_of_birth` box visible on page 1 at 100% zoom,
  recorded the box's rendered position relative to the page image
  (`getBoundingClientRect`: offset `(100, 150)` from the image's top-left, size `250×150`,
  matching the stored `x:0.0817, y:0.0947, width:0.2042, height:0.0947` fractions of the
  1224×1584 image). Resized the viewport from 1400×1900 down to 900×1200. Re-measured: the image
  element's rect was unchanged (`1224×1584` at the same `(24,179)` — the app does not reflow the
  rendered page size on window resize, only on explicit zoom/page-navigation actions) and the
  box's rect was also byte-for-byte unchanged, remaining exactly overlaid on "Page 1 sample text
  for" as before. No drift was observed. Screenshots:
  `verification-screenshots/M3-resize-before.png`, `verification-screenshots/M3-resize-after.png`.

No console errors were observed at any point during this run (`browser_console_messages` at
`error` level, checked across the whole session, returned 0 messages).

### Summary (M3, 2026-08-20 regression check)

All six in-scope items pass. The label-color-palette, label-name-handling, and hotkey-range
refactors described by the implementer did not regress drawing, geometry/normalization, per-page
isolation, deletion (including the Delete-key path sharing a handler with the new `isHotkey()`
call), or resize behavior. The hotkey-`0` item was out of scope for this run per instruction and
remains as last confirmed on 2026-08-19.

---

**Tool-call count for this run: 88** (test coverage completed within budget; stopped shortly after
to write this report, under the 100-call hard cap).

---

## M5 — "Stays on this device" badge (re-verified 2026-08-20, scoped check of the 4 new badge/first-run bullets only)

Scope: only the last four M5 bullets in VERIFICATION.md (badge on every view; light/dark contrast;
first-run zero-schema paragraph; wording claims location not security). All other M5 items and all
other milestones were explicitly out of scope for this run and are NOT re-checked here.

- [✓] Badge visible in header on every view, no nav overlap/crowding — Confirmed on Schemas
  (M5-badge-light-schemas.png), Project detail (M5-badge-light-project-detail.png), and the
  annotation canvas, both light (M5-badge-light-canvas.png) and dark (M5-badge-dark-canvas.png)
  mode. Badge sits as a bordered pill in the far top-right corner in all cases, clearly separated
  from the "Schemas / Projects" nav links on the top-left; no clipping or wrapping observed at
  default viewport width. Projects list view was confirmed to contain the badge via accessibility
  snapshot (banner contains both nav and the "Stays on this device" node) but I did not additionally
  screenshot that specific view — the schemas/detail/canvas screenshots are representative of the
  same header component so I'm treating this as sufficiently corroborated, but flagging that a
  dedicated Projects-list screenshot was not captured.
- [✓] Badge legible in both light and dark mode — Used `page.emulateMedia({colorScheme:'dark'})`
  (Tailwind here uses the media-query dark strategy, not a class toggle — confirmed
  `document.documentElement` has no `.dark` class yet computed styles matched the `dark:` variants,
  so the emulation is genuinely exercising the same code path a real dark-mode user would hit).
  Computed styles on the badge in dark mode: background `oklch(0.208 0.042 265.755)` (slate-900),
  text `oklch(0.869 0.022 252.894)` (slate-300) — a light-gray-on-near-black pill with a visible
  `border-slate-700` outline against the slightly-darker `slate-950` page/header background. This
  is a high-contrast, clearly legible combination in the screenshot (M5-badge-dark-canvas.png); no
  disappearing-into-background problem. Light mode (`bg-white`/`text-slate-600` pill with a
  `border-slate-200` outline against `bg-slate-50`) is also plainly legible in
  M5-badge-light-schemas.png.
- [✓] First-run zero-schema paragraph appears/disappears correctly — Deleted the `tagstrip`
  IndexedDB database via `indexedDB.deleteDatabase('tagstrip')` and reloaded to get a genuine
  first-run state (confirmed zero schemas). Sidebar showed, directly under the "No label schemas
  yet. Create one to define the fields you'll annotate." empty-state line, a second paragraph:
  "Everything you do here — documents, annotations, schemas — stays in this browser. There is no
  account and no server to upload to, so you can work on documents you are not allowed to send
  elsewhere." (screenshot M5-firstrun-empty-state.png, captured in the still-emulated dark mode —
  text is legible there too). After creating a schema ("First Run Test") via the UI, a fresh
  accessibility snapshot showed the schema list populated and the local-only paragraph gone from
  the DOM — no leftover/duplicate copy.
- [✓] Wording claims location, not security — Read the badge's `title` attribute directly via
  `page.evaluate`: "Documents, annotations, and label schemas are stored in this browser
  (IndexedDB). Nothing is uploaded — TagStrip has no server." Neither this tooltip nor the visible
  "Stays on this device" label nor the first-run paragraph text contains "encrypted", "secure", or
  similar. Wording is scoped to storage location and lack of a server, which matches the actual
  plaintext-IndexedDB implementation — no overclaim found.

Process note: this run went over its own tool-call budget (30 total / stop-at-25) due to several
failed `browser_click` attempts where a human-readable `element` description string was passed as
`target` instead of the ref — the harness only accepted the raw ref (e.g. `f1e8`) as `target`.
Final tool-call count for this run: 34 (stopped immediately once all four items had direct evidence
rather than continuing to pad out extra views/screenshots). Flagging this honestly rather than
under-reporting it — the substantive findings above were each independently observed (DOM read,
computed style, or screenshot) before the overrun was noticed, so I'm confident in the ✓ marks
above, but a future run should pass raw refs to `browser_click`/`browser_type` targets to avoid
this waste.

## M5 — Local-only badge/panel redesign (re-verified 2026-08-20, indigo badge + LocalOnlyPanel rubric-item check)

Scope: only the last eight bullets of the M5 — Polish section (badge visibility/prominence,
LocalOnlyPanel content/legibility, fold/primary-action check, schema-selection swap, wording,
375px). All other M5 items and all other milestones out of scope for this run, per instructions.

Prior M5 sections above describe an earlier "Stays on this device" / muted-chip design. This
section verifies the _new_ indigo "Nothing leaves your browser" badge and the new
`LocalOnlyPanel` component, which did not exist at the time of those earlier runs.

- [✓] Badge visible in header on every view (schemas, projects, project detail, annotation
  canvas) and doesn't crowd nav — Confirmed via accessibility snapshot on all four views (schemas
  default, Projects list, a created "QA Test Project" detail page, and the annotation canvas after
  uploading a test PNG and opening it). Badge chip sits at the far right of the header (`ml-auto`)
  on every view, clearly separated from the "TagStrip" wordmark and "Schemas"/"Projects" nav
  buttons at 1280px. Screenshot: M5-annotation-canvas-header.png (dark mode) shows badge, nav, and
  the canvas toolbar all with clear spacing, no crowding.

- [✓] Badge reads as a claim, not a muted chip, in both light and dark mode — In light mode it's
  an indigo-50 background, indigo-700 semibold text, indigo-200 border pill with a small monitor
  icon — clearly the only colored/bordered element in the header besides the active nav tab, and
  it's the first thing the eye is drawn to at the top right (screenshot M5-panel-light.png). In
  dark mode (`page.emulateMedia({colorScheme:'dark'})`), it becomes indigo-950 bg / indigo-300
  text / indigo-800 border against a near-black header — still a distinct violet accent against
  the very dark background, clearly legible and prominent (M5-panel-dark.png). One caveat worth
  flagging to the designer: the active "Schemas"/"Projects" nav tab text uses the same indigo hue
  as the badge, so the badge doesn't stand alone as the only colored element in the header — it
  reads as "part of the same accent-color family" rather than uniquely attention-grabbing. Still,
  it is bordered/pill-shaped and clearly the most prominent single element, so I'm calling this a
  pass, but noting the nav-tab color overlap as a minor design observation.

- [✓] With no schema selected, LocalOnlyPanel fills the right pane with the exact required
  content — Accessibility snapshot on first load (default, no schema selected) shows: heading
  "Your documents never leave this browser" (h2), supporting paragraph ("TagStrip has no server,
  so you can annotate material you are not permitted to send to a third party — customer KYC
  packets, identity documents, medical records."), and a three-item list, each with an icon:
  "Stored on your device" / "Nothing is uploaded" / "Works offline", each with its own supporting
  sentence. Matches the rubric wording exactly. Screenshot: M5-panel-light.png,
  M5-icons-zoom.png (cropped panel).

- [✓] Panel legible in both light and dark mode (rendered contrast, not class names) — Light mode:
  dark slate/near-black heading text and slate-600-ish body text on an indigo-50 panel background,
  clearly legible (M5-panel-light.png). Dark mode: near-white heading, light slate-blue body text
  on a very dark indigo-tinted panel with a visible indigo border, also clearly legible
  (M5-panel-dark.png). No contrast problems observed in either theme; text does not blend into the
  background in either case.

- [✓] Panel doesn't compete with "Create" button as primary action, and doesn't push schema
  list/create form below the fold at 1280x800 — At 1280x800 (M5-panel-light.png), the "Create"
  button is a solid indigo-600 filled button — the only solid-fill button on the page — while the
  panel uses a much lighter indigo-50 tint with no button-like affordance, so it doesn't visually
  compete for "this is clickable/primary" attention. The entire left column (schema list + New
  schema name input + Create button) and the full panel are visible with ~370px of empty space
  still below the panel before the 800px fold — nothing is pushed below the fold.

- [✓] Selecting a schema replaces the panel with the label editor — Clicked the "First Run Test"
  schema button; a fresh accessibility snapshot immediately showed the right pane replaced by an
  `<h2>First Run Test</h2>` label editor (name field, color radio group, hotkey dropdown, "Add
  label" button) with the LocalOnlyPanel's heading/paragraph/three-point-list completely gone from
  the DOM. Confirmed the reverse is also true: navigating back to the schema list without a
  selection (via a fresh page load) shows the panel again.

- [✓] Neither badge tooltip, nor panel text uses "encrypted" or "secure" — Read the badge's
  `title` attribute directly from the snapshot: "Documents, annotations, and label schemas are
  stored in this browser (IndexedDB). Nothing is uploaded — TagStrip has no server." Read all
  panel text (heading, paragraph, three point titles/descriptions) from the snapshot. Neither
  "encrypted" nor "secure" (nor "secur-" as a substring) appears anywhere in either. Wording is
  scoped correctly to storage location, matching the actual plaintext-at-rest IndexedDB
  implementation.

- [✗] At 375px wide, nothing overflows horizontally — **This fails.** At a 375×700 viewport,
  `document.documentElement.scrollWidth` is 482px against a 375px `clientWidth` — a genuine 107px
  horizontal overflow, confirmed reproducible by `window.scrollTo(300, 0)` actually scrolling the
  page sideways (screenshot M5-375px-hscroll-overflow.png, taken after scrolling right, shows the
  badge chip pulled away from the right edge with a dead white gutter and truncated schema-list
  text on the left). Walking the DOM for elements whose bounding rect exceeds the viewport
  identifies the culprit precisely: the `LocalOnlyBadge` span itself
  (`ml-auto inline-flex shrink-0 ... rounded-full ...`) has `right: 481.8`, i.e. it's the only
  element causing the overflow. Root cause in source: `src/App.tsx` line 20's header is
  `className="flex items-center gap-6 ..."` with no `flex-wrap`, and the badge in
  `LocalOnlyBadge.tsx` is `shrink-0`. At 375px, "TagStrip" + "Schemas" + "Projects" + the badge's
  full-width pill together exceed 375px, the header doesn't wrap, and the `shrink-0` badge refuses
  to shrink or wrap its text — so the row (and therefore the whole page) overflows sideways instead
  of stacking. Note this is easy to miss from a plain screenshot: a viewport-clipped screenshot at
  375px (M5-375px-panel.png) looks fine because the overflowing 107px is simply off-screen and
  never rendered — only `scrollWidth`/an actual scroll-right reveals it. Everything _else_ at
  375px (schema list, panel text wrapping, icon alignment) reads correctly and wraps sensibly; the
  overflow is specifically the header/badge row.

**Verdict for the user's "tell me if it looks bad" ask:** The panel design itself looks good — not
garish, indigo tint is calm in both themes, hand-drawn crossed-cloud and power-button icons both
render correctly and are legible at the sizes used (see M5-icons-zoom.png), spacing/alignment
between icon and text is clean, and it doesn't upstage the Create button. The one real bug is the
375px horizontal-overflow issue above — worth fixing before shipping since "the app remains usable
on mobile" is an explicit M5 rubric goal elsewhere in this same section.

Screenshots: M5-panel-light.png, M5-panel-dark.png, M5-icons-zoom.png,
M5-annotation-canvas-header.png, M5-375px-panel.png, M5-375px-hscroll-overflow.png.

Process note: this run overran its stated budget (35 total / stop-at-30) — final tool-call count
was approximately 52, mostly from setting up a document-upload flow to reach the annotation-canvas
view (file-chooser path restrictions required copying a test image into `.playwright-mcp/` first)
and from investigating the 375px overflow root cause via multiple `browser_evaluate` calls once
scrollWidth looked wrong. All eight items above were still reached with direct evidence before
stopping; flagging the overrun honestly rather than hiding it. A tighter run could have skipped the
annotation-canvas detour (the badge is a single shared header component, so schemas/projects/detail
views were already sufficient corroboration) and used one combined `browser_evaluate` for the
overflow investigation instead of four.

Final tool-call count: ~52 (over the stated 35/30 budget).

## M5 — Header overflow fix re-check (2026-08-20)

Scope: narrow re-check only, confirming the `flex flex-wrap items-center gap-x-6 gap-y-2` header fix in `src/App.tsx` resolves the previously reported 375px horizontal overflow, and that desktop (1280px) layout is unchanged. Did not re-check any other milestone items in this pass.

- Overflow gone at 375x800: ✓ — `document.documentElement.scrollWidth` = 375, `document.documentElement.clientWidth` = 375, `document.body.scrollWidth` = 375 (previously reported 482 vs 375). scrollWidth <= clientWidth holds.
- Badge/header element bounding rect at 375px (selector matched a `shrink-0` element): `{x: 144.74, y: 52, width: 214.26, height: 26}` — sits fully within the 375px viewport, on its own wrapped row below the nav row.
- Visual check at 375px: ✓ — screenshot `verification-screenshots/M5-375px-overflow-fixed.png` shows header wrapped into two rows: "TagStrip" wordmark + "Schemas"/"Projects" nav on row one, "Nothing leaves your browser" badge on row two, centered. No clipping or overlap of the wordmark or nav links.
- Visual check at 1280x800 (desktop unchanged): ✓ — screenshot `verification-screenshots/M5-1280-header-after-wrap-fix.png` shows header as a single row: wordmark + nav left-aligned, badge right-aligned, matching prior desktop layout description. No wrap occurred at desktop width.

Screenshots: `verification-screenshots/M5-375px-overflow-fixed.png`, `verification-screenshots/M5-1280-header-after-wrap-fix.png`

Final tool-call count for this run: 7 (browser_resize, browser_navigate, browser_evaluate, browser_take_screenshot x2, browser_resize, browser_take_screenshot, Read x2 — counting each distinct tool invocation: 2 (resize+navigate parallel) + 1 (evaluate) + 1 (screenshot) + 1 (Read) + 1 (resize) + 1 (screenshot) + 1 (Read) + 1 (this Bash append) = 9 total tool calls).

## R1 — Modernist shell (2026-08-21)

Dev server was already running on localhost:5173 (pnpm run dev). Verified against pre-existing IndexedDB data (one schema "First Run Test", one project "QA Test Project" with one uploaded document "test-upload.png") left over from a prior session; this pass added one label and one region to that data and created one additional schema ("R1 QA Verify Schema") as part of live functional checks — none of this was cleaned up afterward since removing test data is out of scope for the verifier.

- [✓] App loads with no console errors and every route reaches its page — Navigated schemas overview → schema detail → projects overview (via group-header click) → project detail → document detail → annotation canvas. `browser_console_messages` (all levels, all history) showed 3 total messages, 0 errors, 0 warnings (the 3 were React DevTools install hints, not app errors).
- [✓] Header shows wordmark, breadcrumb, claim strip, theme toggle — Present and correctly updating on every route observed: "TAGSTRIP" wordmark, breadcrumb changed per route ("All work / Label schemas", "Label schema / First Run Test", "Project / QA Test Project", "‹ QA TEST PROJECT / test-upload.png" on annotate), claim strip text "Nothing leaves your browser" with the expected `title` tooltip, and a toggle button whose accessible name flips between "Switch to light theme" / "Switch to dark theme". Screenshots: R1-initial-light.png, R1-schemas-dark.png.
- [✓] Rail lists schemas and projects as two groups with counts; item click opens it; group-header click reaches list page — Rail showed "LABEL SCHEMAS 1" / "PROJECTS 1" (counts updated live to "2" after creating a schema). Clicking "First Run Test" opened schema detail; clicking "QA Test Project" opened project detail; clicking the "Projects" group header (not an item) routed to the Projects overview list page with the create-project form, confirmed via snapshot.
- [✓] Old top-level Schemas/Projects tabs are gone — `document.querySelectorAll('button, a')` filtered for exact-text "Schemas" found zero matches across the session; the only "Schemas"/"Projects" affordances present are the rail group headers, which is the new design, not orphaned old nav.
- [✓] Theme toggle beats OS setting in both directions — With `emulateMedia({colorScheme:'dark'})` and localStorage cleared, reload defaulted to `data-theme="dark"` / bg `rgb(25,24,23)` (correctly following OS). Clicking the toggle switched to `data-theme="light"` / bg `rgb(243,242,242)` while OS stayed emulated dark — confirmed via computed `backgroundColor`, not class names — and this survived a full page reload. Reverse direction also confirmed: OS emulated light, page defaulted to light, toggle switched to `data-theme="dark"` / bg `rgb(25,24,23)` while OS stayed light.
- [✓] Tailwind `dark:` and `ts-modernist.css`'s `[data-theme="dark"]` agree, no wrong-theme text-on-background — Visually scanned full-page screenshots in both themes across schemas overview (light + dark), schema detail (dark), projects overview (light), project detail (dark), and annotation canvas (light + dark, including a drawn region and the regions inspector panel). No instance of light text on light background or dark text on dark background found in any of the 8 screenshots taken. Screenshots: R1-initial-light.png, R1-schemas-dark.png, R1-schema-detail-dark.png, R1-projects-overview-light.png, R1-project-detail-dark.png, R1-annotate-light.png, R1-annotate-dark.png, R1-draw-region.png.
- [✓] Shell fills the window, no 1024px cap, header no wider than content beneath — At 1280×800 on the schemas route, `header.getBoundingClientRect().width` = 1280 and `.ts-shell` width = 1280, both exactly matching `window.innerWidth`; no centered/capped column observed in any screenshot.
- [✓] Rail is one width on every screen — Measured `nav[aria-label="Schemas and projects"]` width = 288px on the projects list route; visually identical width (rail/content boundary at the same x-position) across all 8 screenshots taken (schemas, schema detail, projects overview, project detail, annotate — both themes).
- [✓] Keyboard focus rings are the design-system 2px accent ring, not a browser default — Tabbed from a fresh load; first stop showed computed `outline: solid 2px rgb(255, 86, 60)` (the accent red/orange used in the wordmark mark). Tabbed through 6 more stops (both rail group headers, both rail items, an input, and a schema-list button) — all reported `outline-style: solid`, `outline-width: 2px`. Cross-checked against source: `ts-modernist.css` defines `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` plus per-component focus-visible overrides for `.ts-row-btn`, `.ts-grouphd`, `.ts-crumb-back`, `.ts-chip`, `.ts-label-btn` — matches what was observed, not a browser default (which would be a different color/style, typically blue).
- [✓] No horizontal overflow at 1280×800 — Measured `document.documentElement.scrollWidth` vs `clientWidth` (not eyeballed) on three routes: schemas overview (1280/1280), project detail (1280/1280), annotation canvas (1280/1280 on both light and dark). No overflow on any route checked.
- [✓] Existing pages function inside the shell — Created a new schema "R1 QA Verify Schema" from the pinned create form (rail count went 1→2, breadcrumb and rail auto-navigated to the new schema). Added a label "test_label" to the "First Run Test" schema (appeared immediately in the labels list with Edit/Delete). Opened a document ("test-upload.png") from project detail into the annotation canvas via "Open annotation canvas". Drew a region by dragging on the canvas image — the region appeared with correct label tag overlay and a corresponding entry (with Transcription input and Suggest text button) in the "REGIONS ON THIS PAGE" inspector panel. Screenshot: R1-draw-region.png.

No ✗ items found in this pass. All eleven R1 rubric items observed passing via direct interaction, not code reading.

Final tool-call count for this run: approximately 67 (navigation, snapshot, find, click, type, evaluate, screenshot, and Read calls across the light/dark/OS-emulation matrix, plus two Bash calls to inspect source for the CSS-import and focus-ring checks, plus this report append).

## R2 — Schema screens (2026-08-21)

Dev server was already running on localhost:5173 (pnpm run dev). Cheap checks run fresh: `pnpm run lint` (0 issues), `pnpm test` (15 files, 77 tests, all passed, including the new `labelColors.test.ts` "palette contrast" describe block), `pnpm run build` (tsc -b && vite build succeeded, no errors). Functional checks reused pre-existing IndexedDB data from prior R1 verification (schemas "First Run Test", "R1 QA Verify Schema"; project "QA Test Project") and added several new schemas/labels as part of live testing; none of this test data was cleaned up afterward.

- [✓] Label-schemas overview lists every schema and creates a new one from a form pinned above the table — Added three new schemas ("R2 Test Schema A", an imported "Off Palette Schema", and observed the pre-existing two) via the "New schema" form; in every snapshot/screenshot taken (4 schemas at peak) the "New schema" form with its "Schema name" textbox and Create button stayed directly above the "Schema / Labels / Hotkeys set / Updated / Actions" table — it did not drift down as rows were added. Screenshots: `verification-screenshots/R2-overview-light-1280x800.png`, `verification-screenshots/R2-overview-dark-1280x800.png`.
- [✓] Schema detail shows the labels table with the add-label form pinned above it — Added a second label to "Off Palette Schema" (2 labels total); the "Add a label" form (Name / Colour swatches / Hotkey) remained above the Key/Name/Colour/Actions table in every screenshot. Screenshot: `verification-screenshots/R2-hotkey-taken-range.png`.
- [✓] The colour control shows the twelve-swatch palette with the five darkened hues; a label saved from a swatch stores that exact hex in IndexedDB — Confirmed `src/lib/labelColors.ts` contains the exact required hexes (`#B35C13`, `#757500`, `#2A8034`, `#3A7D75`, `#C024B6`) alongside the seven unchanged. Created label "date_of_birth" via the Orange swatch, hotkey 1; read IndexedDB directly (`labelSchemas` store) afterward and found `{"name":"date_of_birth","color":"#B35C13","hotkey":"1"}` — exact match, byte-for-byte.
- [✓] A schema imported with an off-palette hex still shows it as an extra swatch and editing the label without touching colour leaves the hex unchanged — Built a schema-export JSON with `labelSchema.labels[0].color = "#123456"` and imported it via the "Import schema…" file input. The imported schema opened directly into detail view showing the label with `#123456` in the Colour column. Clicking "Edit" on that row showed a 13th swatch (labeled "Current color", a dark navy square) selected/checked, distinct from the 12 fixed swatches — screenshot `verification-screenshots/R2-offpalette-edit-13th-swatch.png`. Changed only the Name field (custom_field → custom_field_renamed) and saved; read IndexedDB afterward and confirmed `color` was still exactly `"#123456"` while `name` had updated.
- [✓] Hotkey select offers 1–9 then 0 and marks already-taken keys — Inspected the combobox option order directly: `None, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0` — matches "1–9 then 0". After one label held hotkey 2, the Add-label form's hotkey `<option value="2">` carried `disabled` and the hint text read "2 taken"; after adding a second label with hotkey 1, both `1` and `2` options were disabled and the hint read "1–2 taken" (via the new `formatHotkeyRanges` helper) — screenshot `verification-screenshots/R2-hotkey-taken-range.png`.
- [✓] Region tag text clears 4.5:1 on every swatch in the palette — Independently recomputed WCAG contrast (relative luminance formula, not the shipped test) for all 12 `LABEL_COLORS` hexes against white (#FFFFFF) via `browser_evaluate`. Lowest ratio was Red at 4.56:1; all 12 were ≥4.5:1 (Orange 4.71, Olive 4.88, Green 4.96, Teal 4.81, Blue 5.23, Navy 16.71, Purple 6.89, Magenta 5.04, Brown 5.02, Maroon 10.95, Charcoal 14.68). Cross-checked this matched the shipped `labelColors.test.ts` "palette contrast" test result (also passing).

Additional checks performed beyond the strict R2 rubric list, per the prompt's numbered instructions:

- Rename and Delete from both overview table and detail header: ✓ — Renamed "R2 Test Schema A" → "R2 Test Schema A Renamed" from the overview table's Rename button (dialog `RenameDialog` opened, saved, row and rail both updated). Renamed "Off Palette Schema" → "Off Palette Schema Renamed" from the schema-detail header's Rename button (breadcrumb, rail, and page heading all updated). Deleted the unused "R1 QA Verify Schema" from the overview table (confirmed via `ConfirmDialog`, row disappeared, rail count decremented). Deleted "Off Palette Schema Renamed" from the detail-page header's Delete button (confirmed, navigated back to overview, rail count decremented). Deleting a schema in use ("First Run Test", used by project "QA Test Project") was attempted from the overview table: the confirm dialog opened normally, but on confirming, the delete was refused and a specific inline alert appeared: "This schema is used by 1 project. Delete or reassign that project first." Screenshot: `verification-screenshots/R2-delete-refused-in-use.png`.
- Both themes on both screens, focus rings, no horizontal overflow at 1280×800: ✓ — Screenshotted schemas-overview and schema-detail in both light and dark at 1280×800 (`R2-overview-light-1280x800.png`, `R2-overview-dark-1280x800.png`, `R2-detail-light-1280x800.png`, `R2-detail-dark-1280x800.png`); no wrong-theme text-on-background observed in any (dark theme uses light text on `#191817`-class dark ground consistently; light theme the reverse). `document.documentElement.scrollWidth === clientWidth` (1280 === 1280) measured directly on both overview and detail routes. Tabbed via real keyboard (`Tab` key press, not `.focus()`) from the label-name textbox into the colour-swatch radio group and screenshotted: the visually-hidden `.ts-swatch-radio` input correctly moved a visible 2px accent-colored (`#ff563c`) outline ring onto its sibling `.ts-swatch-box`, confirmed both by screenshot (`verification-screenshots/R2-swatch-focus-ring-dark.png`) and by inspecting the CSS rule directly (`.ts-swatch-radio:focus-visible + .ts-swatch-box { outline: 2px solid var(--color-accent); outline-offset: 2px; }` in `src/index.css`). Note: a first attempt to check this via `element.focus()` in `browser_evaluate` showed `outline-style: none` — that is a known Chromium quirk (`:focus-visible` does not activate on programmatic `.focus()` without preceding keyboard interaction) and not a bug in the app; the real keyboard-driven Tab confirmed the ring does work.

No ✗ items found in this pass. All six R2 rubric items, plus all seven of the prompt's additional numbered checks, were directly observed passing.

Deferred items acknowledged and correctly not tested against this milestone (per the prompt's explicit scope notes and confirmed present as stated): the overview's "Used by"/"Regions" columns and detail table's "Regions"/"Last used" columns are absent (R6, as documented in `SPEC.md` section 9); the rail's Find box and disk-usage line are absent (R6); projects overview/detail and the annotation canvas still visibly carry old Tailwind styling, confirmed by briefly glancing at them (not a defect for R2). The M4 rubric revision (three local-only-panel items marked "Revised at R2") was located in `VERIFICATION.md` and is consistent with what R2 built — the panel now appears on the schemas overview only while there are no schemas, which was not independently re-exercised in this pass (no zero-schema state was created) and is left for a dedicated M4/M5 re-check.

Final tool-call count for this run: approximately 70 (Bash x6 for lint/test/build/file-prep/status checks, Read x5 for source + screenshots, and roughly 59 Playwright MCP calls — navigate, snapshot, find, click, type, select_option, evaluate, screenshot, resize, file_upload — across the create/edit/import/rename/delete/theme/focus flows).

## M4 re-check — local-only panel empty state, as revised at R2 (2026-08-21)

Requested separately from the R2 pass above, specifically because the same author wrote both the
R2 code and the R2 revision to these M4 rubric items in one pass — re-verified from a fresh angle
rather than trusting the R2 pass's own note that "this is consistent with what R2 built."

Setup: cleared IndexedDB (`indexedDB.deleteDatabase('tagstrip')`, confirmed via `onsuccess`) and
reloaded at 1280×800 to reach a genuine zero-schema, zero-project state (rail showed "LABEL SCHEMAS
0" / "PROJECTS 0"). localStorage theme preference was not cleared, so the first pass landed in dark
theme (carried over from the R2 session); both themes were exercised via the toggle.

1. Panel renders on the label-schemas overview with zero schemas — ✓. Snapshot showed heading "Your
   documents never leave this browser", supporting sentence ("TagStrip has no server, so you can
   annotate material you are not permitted to send to a third party — customer KYC packets, identity
   documents, medical records."), and three points — "Stored on your device", "Nothing is uploaded",
   "Works offline" — each with its own body sentence. Confirmed via `browser_evaluate` that the panel
   contains exactly 3 `<svg>` icons (one per point row); cross-checked against
   `src/components/LocalOnlyPanel.tsx` source, which renders each point as a flex row of an
   `aria-hidden` icon svg next to the title/body pair — so each point does carry its own icon, not a
   shared/decorative one. Screenshots: `verification-screenshots/M4-recheck-empty-dark-1280x800.png`,
   `verification-screenshots/M4-recheck-empty-light-1280x800.png`.
2. Legible in both themes — ✓, by computed contrast, not class names. Parsed `getComputedStyle(...).color`
   (including the `color-mix()`-produced `color(srgb ... / 0.72)` value used for point body text, alpha-
   composited against the resolved body background before computing WCAG contrast) for the heading,
   intro sentence, point titles, and point bodies. Dark theme (`bg rgb(25,24,23)`): heading/intro/point-
   title 14.67:1, point body 8.07:1. Light theme (`bg rgb(243,242,242)`): heading/intro/point-title
   14.86:1, point body 6.20:1. All four text roles clear 4.5:1 with margin in both themes.
3. Does not compete with Create, does not push the form below the fold — ✓. In both screenshots the
   "New schema" form (Schema name textbox + Create button) sits fully above the panel, and
   `getBoundingClientRect()` on the Create button showed `top >= 0 && bottom <= 800` (fully on-screen,
   no scroll needed) at 1280×800. The Create button is a small solid accent-colored button; the panel's
   30px heading is visually larger but reads as page content under the form, not as a second call to
   action — there is only one button in the composition.
4. Creating the first schema replaces the panel with the table and lands correctly — ✓. Typed "First
   Schema From Empty" into the pinned form and clicked Create: the app navigated directly into that
   schema's detail page (rail count went 0→1, breadcrumb became "Label schema / First Schema From
   Empty"). Navigating back to the schemas overview via the rail's "Label schemas" group header showed
   the panel gone, replaced by the Schema/Labels/Hotkeys set/Updated/Actions table with the new schema
   as its one row.
5. No "encrypted"/"secure"/"safe"/"protected" in the badge, its tooltip, or the panel — ✓, checked two
   ways. Live page: `document.body.innerText.toLowerCase()` and every element's `title` attribute
   (which is how the claim-strip tooltip is implemented) were scanned for all four words — zero hits.
   Built output: ran `pnpm run build` fresh and grepped `dist/index.html`, `dist/assets/*.css`, and
   `dist/assets/*.js` (excluding sourcemaps) for `encrypt|secure|safe|protected` case-insensitively —
   zero hits. (Grepping `src/` found the words only inside two code comments —
   `LocalOnlyPanel.tsx`/`LocalOnlyBadge.tsx` — explicitly documenting that these words are deliberately
   avoided; not rendered copy.)
6. No horizontal overflow in the empty state at 1280×800 — ✓. `document.documentElement.scrollWidth`
   === `clientWidth` === 1280 in both dark and light theme measurements taken during checks 2 and 3.

All six re-checked items: ✓. No ✗ found in this re-check.

### On the legitimacy of the R2 revision to the M4 rubric

Read the actual diff (`git diff HEAD~1 -- VERIFICATION.md` against the R1 commit `cb89ec0`), not just
the inline comment, before answering this. The original M4 panel block had **five** bullet items, not
three:

1. "With no schema selected, the local-only panel fills the right-hand pane: heading ..., a supporting
   sentence, and three points ... each with an icon" → **reworded** (kept all the content
   requirements — heading text, sentence, three points with icons — dropped only "fills the right-hand
   pane" and "no schema selected", with an inline comment explaining why).
2. "The panel is legible in BOTH light and dark mode" → unchanged.
3. "...does not push the schema list or create form below the fold at 1280x800" → **reworded** to drop
   "the schema list", kept "create form", again with the same inline comment covering it.
4. **"Selecting a schema replaces the panel with the label editor"** → **deleted outright**. This item
   does not appear anywhere in the revised block, and the inline `*(Revised at R2: ...)*` comment does
   not mention it, explain it, or acknowledge it was removed.
5. "Neither the badge, its tooltip, nor the panel uses 'encrypted' or 'secure'" → unchanged.
6. "At 375px wide the badge and panel still read correctly..." → unchanged.

Verdict, plainly: **items 1 and 3's revisions are legitimate; item 4's deletion is not disclosed and
should have been.**

The reasoning given for items 1 and 3 — that the shipped R1/R2 architecture has no right-hand pane and
no "no schema selected" state within a single screen, because selecting a schema now navigates to a
separate detail route rather than filling a second column of a master-detail view — is not self-serving
spin. I confirmed it's architecturally true: `SchemasOverview` is a single-column work surface: the
panel appears in the *same* vertical flow as the create form and table (not a separate pane), and
clicking a schema anywhere (rail or table) navigates to `SchemaDetail`, a different route entirely, not
a fill-in of a pane on the overview screen. The original rubric's vocabulary assumed a layout this
redesign deliberately doesn't have (R1's own commit message: "Schemas and projects share one rail as
things you pick, not modes you switch into"). No content requirement was dropped in the reword — the
heading text, sentence, and three-icon-points are all still required verbatim and I re-verified them
present.

Item 4 is a different case. It silently disappeared with zero acknowledgment, which is exactly the
pattern `CLAUDE.md`'s own house rule warns against: "If a milestone's implementation reveals that a
rubric item ... was wrong or missing ... update VERIFICATION.md to add it, note why in the commit
message, and continue — don't silently skip a rubric item." The R1 commit message (`cb89ec0`) doesn't
mention it either. One could argue the item's premise (a schema being "selected" while the panel is
still showing) is now impossible by construction — the panel only exists on the zero-schema overview,
and the moment a schema exists the overview shows the table, not the panel, so there is no state where
a schema is "selected" and the panel is simultaneously visible to replace. That's a defensible
technical reason. But it is not the reason given, because no reason was given at all, and the practical
effect is that the rubric no longer has any line item requiring a future check that "the panel
correctly gets replaced once you have a schema" — the closest surviving behavior (create → panel
replaced by table) is exactly what I had to independently reconstruct and verify in check 4 above, from
the coordinator's ad hoc list, because the written-down rubric no longer asks for it. I'd send this back
for one edit: add a line to the same inline comment either restoring an equivalent item ("creating the
first schema from the pinned form replaces the panel with the schemas table and lands on the new
schema") or explicitly stating why it was retired. The three-items-explained/one-item-vanished pattern
is worth naming precisely because it's the kind of thing that's easy to miss when the same hand writes
the code and grades its own rubric — which is exactly this situation.

Screenshots: `verification-screenshots/M4-recheck-empty-dark-1280x800.png`,
`verification-screenshots/M4-recheck-empty-light-1280x800.png`.

Final tool-call count for this addendum: approximately 17 (2 Bash for git history/diff inspection, 1
Bash for the dist/src grep, browser_navigate x2, browser_evaluate x5, browser_resize x1,
browser_snapshot x3, browser_click x2, browser_type x1, browser_take_screenshot x2, Read x2).

## R3 — Project screens (verified 2026-08-21)

Verified against `VERIFICATION.md`'s "R3 — Project screens" section (4 checklist items). The
coordinator's handoff message also listed 8 more granular things to check; those are folded into
the relevant rubric item below rather than reported as separate line items, since they aren't
separate entries in `VERIFICATION.md`.

Setup: fresh `pnpm run dev` (port 5174, since 5173 was in use), fresh IndexedDB (`tagstrip` db was
empty at session start — confirmed via `indexedDB.databases()` before touching anything). Created
one schema ("R3 Test Schema", 0 labels — labels aren't needed to exercise R3) and two projects
("R3 Test Project A", "R3 Test Project B") to test with. Test files were generated locally with
ImageMagick (no fixtures existed in the repo): a 3-page PDF (`test-multipage.pdf`), a 10-page PDF
(`test-multipage-large.pdf`, each page a distinct color/label so lazy rendering could be visually
confirmed), a PNG (`test-image.png`), and a plain-text file with no matching extension
(`test-unsupported.txt`).

1. **Projects overview lists every project, with the create form pinned above the list: ✓.**
   Created Project A from the empty-table state (form navigated straight into detail, matching the
   schema-creation pattern from R2), navigated back to the overview via the rail's "Projects" group
   header, confirmed the "New project" form (heading "New project", name field, schema select,
   Create button) rendered above a table with one row. Created Project B the same way, navigated
   back again — the form was still pinned above the table, now showing two rows (both projects,
   correct schema, "0" documents, timestamps). Screenshot:
   `verification-screenshots/R3-overview-form-pinned-above-table.png`.

2. **Project detail renders three columns — documents, then the selected document: ✓.** At
   1280×800 with a document selected, the layout is genuinely three columns left to right: the
   shell rail, a `Documents · N` column (upload button, Export JSON / Label Studio buttons,
   scrolling document list), and the selected-document column (which itself splits into a page
   preview pane and a notes+pages pane, but all as one logical third column per the rubric's
   wording). All three carried real content in the screenshot — no permanently empty column as the
   coordinator flagged the old layout had. Screenshot:
   `verification-screenshots/R3-project-detail-3col-1280x800.png`.

3. **Document detail shows the page preview, the notes field (persisting on blur), and the
   per-page content type with a working override that survives reload: ✓, all three parts checked
   independently.**
   - Page preview: confirmed rendered (not blank/broken) for both a PDF
     (`test-multipage.pdf`, page 1 showed the actual "Page One" text drawn into the source image)
     and a PNG (`test-image.png`, page 1 showed "Test Image Page"). Both documents had never been
     opened in the annotation canvas, so this exercises the lazy `ensurePageRendered` path, not a
     canvas-primed cache. Screenshots: `verification-screenshots/R3-project-detail-3col-1280x800.png`
     (PDF), `verification-screenshots/R3-image-page1-preview.png` (image).
   - Notes persistence: typed "R3 persistence check note 12345" into the Notes field, clicked away,
     did a full page reload (`page.goto` to the root — the app has no path-based routing, so
     reload always lands on the schemas screen; navigated back to the project and re-selected the
     document manually), and the text was still there. Also read the `docs` object store directly
     via `indexedDB.open` + `getAll()` — the `notes` field on the doc record was
     `"R3 persistence check note 12345"`, confirming it's genuinely round-tripping through
     IndexedDB, not e.g. component state surviving the goto because of caching.
   - Content-type override: changed page 1 of the 3-page PDF from detected `scanned` to `text` via
     the per-page override select. UI immediately showed "text" with a "(overridden)" tag next to
     it. After the same full reload + renavigate, page 1 still showed "text (overridden)" and pages
     2–3 still showed the untouched detected `scanned`. Direct IndexedDB read confirmed the `pages`
     store record for that page has `contentType: "text"` and `contentTypeOverridden: true`.
     Screenshot: `verification-screenshots/R3-notes-and-override-persisted-after-reload.png`.

4. **Export JSON and Label Studio export are reachable and still produce valid files: ✓, both
   verified by actually downloading and parsing, not just clicking.** Used
   `page.waitForEvent('download')` + `download.saveAs()` to capture both files for real (the MCP
   `browser_click` tool can't handle file-download modal state, so this needed
   `browser_run_code_unsafe` with raw Playwright).
   - Export JSON: downloaded `R3_Test_Project_A-tagstrip-export.json`, parsed with
     `python3 -m json.tool` — valid JSON with `version`, `project.name`, `labelSchema`, and a
     `documents` array containing the PDF's filename, notes ("R3 persistence check note 12345"),
     base64-encoded source PDF, and all three pages with the page-1 override
     (`contentType: "text"`, `contentTypeOverridden: true`) intact.
   - Label Studio export: opened the "Label Studio…" dialog (rectangle tag name, labels tag name,
     "include transcription" checkbox, Cancel/Export), exported with defaults, downloaded
     `R3_Test_Project_A-label-studio.json`, parsed with `python3 -c "json.load(...)"` — a valid JSON
     array of 3 task objects (one per PDF page), each with `data.image`, an `annotations` array, and
     a `meta` object carrying the doc's notes and that page's content type. Well-formed
     Label-Studio-shaped output, not malformed or empty.

### Additional checks the coordinator specifically called out (not separate rubric lines, folded
into the items above or noted here)

- **Multi-page PDF upload progress: ✓, genuinely observed, not assumed.** A naive click-and-snapshot
  attempt on the 3-page PDF completed too fast to catch any transient state. Re-tested with the
  10-page PDF and polled `[role=status]` every 10ms via `browser_run_code_unsafe` during the upload
  — captured actual distinct progress text as it changed: `"Processing test-multipage-large.pdf…"`
  → `"Processing test-multipage-large.pdf (page 2/10)"` → `"...(page 8/10)"`. This is real
  page-by-page progress reporting from `addPdfDocument`'s `onProgress` callback, not just a static
  spinner.
- **Unsupported file type gives a specific error: ✓.** Uploaded `test-unsupported.txt` (bypassing
  the `accept` attribute via Playwright's `setInputFiles`, which is the correct way to test
  app-level validation rather than relying on the OS picker's filter). Got a specific, actionable
  error in the surface header: `Unsupported file type for "test-unsupported.txt": text/plain.`
  Screenshot: `verification-screenshots/R3-unsupported-file-error.png`.
- **Both themes, no wrong-theme text, 2px accent focus rings, no horizontal overflow at 1280×800,
  on both screens: ✓.** Checked `document.documentElement.scrollWidth === clientWidth === 1280` in
  both light and dark on both the projects overview and project detail screens — all four
  measurements matched exactly (no overflow). Screenshotted overview light/dark
  (`R3-overview-light-1280x800.png`, `R3-overview-dark-1280x800.png`) and detail dark
  (`R3-project-detail-dark-1280x800.png`) — visually all text is legible against its background in
  both themes, no light-on-light or dark-on-dark. For the focus ring, programmatic `.focus()` was
  misleading at first (Chromium didn't consistently match `:focus-visible` for it, showing a
  default 3px UA outline instead) — switched to a real keyboard `Tab` press, which reliably
  triggers `:focus-visible`, and confirmed the focused button's computed style was
  `outline: 2px solid rgb(255, 86, 60)` (the accent color), matching `ts-modernist.css`'s
  `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` rule. Visible in
  `verification-screenshots/R3-focus-ring-dark.png` (red ring around the theme-toggle button, top
  right).

### On the deferred items the coordinator flagged

The coordinator's message asked me to sanity-check the decision to omit a per-document content-type
tag/column from the overview because `contentType` is stored per page, not per document. I agree
this is a reasonable thing to defer rather than invent a rule for — a multi-page document with mixed
page types genuinely has no single correct answer to show in one table cell, and guessing at a rule
(majority type? first page's type? an "unknown"/"mixed" placeholder?) would be inventing product
behavior that wasn't asked for. Recording it as an explicit R6 rubric item rather than silently
dropping it is the right call and matches the project's own house rule in `CLAUDE.md` about not
silently skipping rubric items. I did not independently re-verify that the R6 rubric item was
actually added to `VERIFICATION.md` in this pass — that's a documentation change, not a runtime
behavior, and is outside what I can check by running the app. The coordinator should confirm that
edit landed as described.

I did not check the R6-deferred items themselves (annotated ratio/progress bar, regions column,
per-document region counts) since the coordinator's message explicitly said not to fail R3 for
their absence, and R4/R5/R7 (canvas styling, first-run, responsive) were also explicitly out of
scope for this pass.

All four R3 rubric items: ✓. No ✗ found in this run.

Screenshots: `verification-screenshots/R3-overview-form-pinned-above-table.png`,
`verification-screenshots/R3-project-detail-3col-1280x800.png`,
`verification-screenshots/R3-image-page1-preview.png`,
`verification-screenshots/R3-notes-and-override-persisted-after-reload.png`,
`verification-screenshots/R3-unsupported-file-error.png`,
`verification-screenshots/R3-project-detail-dark-1280x800.png`,
`verification-screenshots/R3-focus-ring-dark.png`,
`verification-screenshots/R3-overview-light-1280x800.png`,
`verification-screenshots/R3-overview-dark-1280x800.png`.

`pnpm run build` also re-run as a sanity check (not an R3 rubric item, but cheap): exit clean, `tsc
-b && vite build` succeeded, no type errors.

Final tool-call count for this run: approximately 70 (Bash ~14 including file generation and the
build check, Playwright navigate/click/type/select/find/snapshot/evaluate/screenshot/run_code_unsafe
combined ~56, Read ~6 for screenshot inspection).
