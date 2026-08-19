# TagStrip — Verification Rubric

This file is the contract between the implementer and the `verifier` subagent (see
`.claude/agents/verifier.md`). Every item below must be checked by actually running the app —
not by reading the code and reasoning that it should work. Reading code tells you what was
*intended*; running it tells you what *happens*.

**Policy for whoever is implementing (see also CLAUDE.md):**
1. Implement a milestone.
2. Run the cheap checks yourself: `pnpm run lint`, `pnpm run build`, `pnpm test`.
3. Invoke the `verifier` subagent with the milestone number and this file.
4. If it reports any ✗, fix the specific failure and re-invoke the verifier. Repeat up to 3 times.
5. If still failing after 3 attempts, stop and report to the human with the verifier's actual
   report attached — do not keep looping silently, and do not report success anyway.

**Policy for the verifier subagent:**
- You did not write this code. Approach it the way a skeptical QA reviewer would, not the way its
  author would. Your job is to find out what's actually true, not to confirm what's claimed.
- For every item, actually perform the action (via Playwright) or actually run the command (via
  Bash) and report the observed result. "Should work based on the code" is not a pass.
- Take a screenshot at each ✓/✗ decision point and save it to `verification-screenshots/`. Name
  files `M<milestone>-<criterion-slug>.png`.
- Produce `VERIFICATION_REPORT.md` at the end: one line per criterion, ✓ or ✗, with the screenshot
  filename and a one-sentence note on what you actually observed.
- If a criterion can't be checked for a reason unrelated to the feature (e.g. `pnpm install` itself
  fails), report that plainly as a blocker — don't mark surrounding items ✓ by assumption.

---

## M0 — Scaffold

- [ ] `pnpm install && pnpm run dev` starts without errors; the app loads in a browser at the
      printed local URL
- [ ] `pnpm run build` exits 0 and produces a `dist/` (or equivalent) folder
- [ ] `pnpm run lint` exits 0
- [ ] The empty-state screen is visible on first load (no console errors in the browser devtools)
- [ ] `LICENSE` file exists and its content matches the MIT license text with a real year/holder,
      not a placeholder

## M1 — Schema management

- [ ] Create a new label schema via the UI; reload the page; the schema is still there
      (confirm via Playwright's `page.evaluate` reading IndexedDB directly, not just visually)
- [ ] Add a label with a name, color, and hotkey to a schema; it appears in the label list with
      the correct color swatch
- [ ] Delete a label; it's gone from the list and from IndexedDB after reload
- [ ] Attempt to add two labels with the same name in one schema — confirm the app either
      prevents this or handles it sensibly (does not silently create a broken/duplicate state)
- [ ] Delete an entire schema that's in use by a project — confirm the app handles this
      explicitly (blocks deletion, or clearly warns, or reassigns) rather than leaving the
      project pointing at a nonexistent schema

## M2 — Projects & documents

- [ ] Create a project, attach a schema, upload the multi-page specimen PDF from the earlier
      prototype (or any multi-page PDF) — confirm the correct page count is detected
- [ ] Reload the page fully (not SPA navigation — an actual browser reload) — the project,
      its documents, and all pages are still present, sourced from IndexedDB
- [ ] Upload a plain image (PNG/JPG) as a document — confirm `contentType` is `scanned` (never
      `text`, since no text layer can exist for a raster image)
- [ ] Upload a PDF with real embedded text (not a scanned/rasterized one) — confirm at least one
      page is auto-detected as `contentType: text`, and manually override it to `scanned` —
      confirm the override persists after reload
- [ ] Upload a large-ish PDF (15+ pages if you can find or generate one) — confirm the UI doesn't
      freeze/hang during upload and page navigation stays responsive

## M3 — Annotation canvas

*(Highest-risk milestone — spend real effort here, not a quick pass.)*

- [ ] Select a label, draw a box on the page — it appears immediately with the correct label
      color and name tag
- [ ] Draw a box, then release the mouse outside the image bounds (drag off the edge) — confirm
      it still finalizes correctly (this broke in the original HTML prototype and was fixed;
      confirm the fix survived the port)
- [ ] Zoom in, then draw a box — confirm the box's stored coordinates are correct at a *different*
      zoom level after zooming back out (i.e. coordinates are truly normalized 0–1, not
      accidentally stored in zoomed pixel space)
- [ ] Navigate to page 2 of a multi-page document, draw a box there, navigate back to page 1 —
      confirm page 1's boxes are unaffected and page 2's box only shows on page 2
- [ ] Select an existing box, delete it via the Delete key and separately via a delete button —
      both remove it from the canvas and from IndexedDB after reload
- [ ] Resize the browser window while boxes exist — confirm they stay visually aligned with the
      underlying image (not drifted)

## M4 — Import / export

- [ ] Export a project's annotations to TagStrip's native JSON — confirm the file contains the
      label schema, all annotations with correct page indices, and any transcription text
- [ ] Import that same file into a fresh project — confirm all annotations reappear correctly
      positioned
- [ ] Export to Label Studio format — confirm paired `bbox`/`label` result entries share the same
      `id`, coordinates are 0–100 (not 0–1), and `original_width`/`original_height` match the
      actual page dimensions
- [ ] If any annotation has transcription text, confirm the Label Studio export only includes a
      `textarea` result entry when that export option was explicitly enabled

## M4.5 — OCR assist (if built)

- [ ] On a page with `contentType: text`, draw a box around a known piece of text and click
      "Suggest text" — confirm the result is the *exact* text (this should come from the PDF text
      layer, not an OCR model — verify no OCR engine was loaded/network-fetched for this case by
      checking the browser's network tab)
- [ ] On a page with `contentType: scanned`, do the same — confirm an OCR engine actually loads
      and produces a plausible (if imperfect) transcription
- [ ] Confirm OCR engine code/weights are not part of the initial page load (check the network
      tab on first load — no Tesseract/Transformers.js assets should fetch until "Suggest text"
      is actually clicked on a scanned page)

## M5 — Polish

- [ ] Undo removes the most recent action; redo restores it
- [ ] Tab through the interface using only the keyboard — every interactive element has a visible
      focus outline
- [ ] Resize the browser to ~375px wide (phone-sized) — the app remains usable, not just visually
      unbroken
- [ ] Trigger an error state on purpose (e.g. import a malformed JSON file) — confirm the error
      message is specific and actionable, not a generic failure or a silent no-op

## M6 — Open source packaging

- [ ] `README.md` includes what the tool does, a quickstart, and how to build/deploy — confirmed
      by actually following the quickstart steps from a clean clone
- [ ] CI workflow file exists and, when checked (or manually triggered), lint/test/build all pass
- [ ] `CONTRIBUTING.md` exists and is not a placeholder/stub
