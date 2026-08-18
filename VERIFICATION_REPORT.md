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
