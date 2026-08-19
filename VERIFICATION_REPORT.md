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
