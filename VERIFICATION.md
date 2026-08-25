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
- [ ] Add a label by typing only a name; it appears in the label list with a colour swatch and a
      hotkey the app assigned, and both persist to IndexedDB after reload
- [ ] Add a second label without touching anything — confirm it gets a different colour and a
      different hotkey from the first
- [ ] Delete a label; it's gone from the list and from IndexedDB after reload
- [ ] Attempt to add two labels with the same name in one schema — confirm the app either
      prevents this or handles it sensibly (does not silently create a broken/duplicate state)
- [ ] Delete an entire schema that's in use by a project — confirm the app handles this
      explicitly (blocks deletion, or clearly warns, or reassigns) rather than leaving the
      project pointing at a nonexistent schema
- [ ] The label color control is a fixed palette of selectable swatches — confirm there is no
      native `<input type="color">` anywhere in the DOM (the OS picker was replaced because it
      was hard to operate and allowed colors invisible against white paper)
- [ ] Pick a non-default palette color (e.g. Teal), save the label, reload — the list swatch and
      the hex stored in IndexedDB both match the palette entry that was clicked
- [ ] Add several labels in a row without touching the color control — confirm each gets a
      different palette color rather than all defaulting to the first
- [ ] Reach the swatches by keyboard alone (Tab to the group, then arrow keys) — confirm the
      focused swatch is visibly indicated and arrow keys change the selection (they are
      visually-hidden radio inputs, a common accessibility trap)
- [ ] Edit a label whose color is outside the palette (import a schema with e.g. `#123456`) —
      confirm an extra swatch appears showing that current color as selected, and saving without
      touching the color leaves the hex unchanged in IndexedDB
- [ ] Type a label name containing spaces (e.g. `date of birth`) — confirm the field itself shows
      `date_of_birth` as you type, with no error message shown, and the name stored in IndexedDB
      uses underscores
- [ ] The add form shows no colour swatches and no hotkey picker — a name is the only input
- [ ] Edit a label: the hotkey picker offers `a`–`z` in addition to `1`–`9` and `0`; assign one and
      confirm it persists to IndexedDB after reload
- [ ] Edit a label and pick an off-palette colour with the colour wheel; confirm that exact hex
      persists, and that a pale pick (e.g. `#FFFF00`) shows the low-contrast warning

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
- [ ] Assign hotkey `0` to a label, then press `0` with the canvas focused — confirm that label
      actually becomes the selected label. (The picker and the canvas key handler used to hold
      separate copies of the allowed digit range, so a hotkey could be assignable but dead;
      pressing the key is the only way to catch that.)
- [ ] Do the same with a letter hotkey (e.g. `d`) — confirm it selects the label, and that holding
      Ctrl while pressing it does NOT (bare letters would otherwise swallow browser shortcuts)

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
- [ ] The "Nothing leaves your browser" badge is visible in the header on every view (schemas,
      projects, project detail, annotation canvas) and does not crowd the nav
- [ ] The badge reads as a claim, not a muted status chip — it should be one of the first things
      the eye lands on in the header, in both light and dark mode
- [ ] The local-only panel shows heading "Your documents never leave this browser", a supporting
      sentence, and three points (stored on your device / nothing is uploaded / works offline)
      each with an icon. *(Revised at R2, updated at R5: the redesign has no right-hand pane to
      fill and no "no schema selected" state — the rail holds the schema list now. The panel lived
      on the label-schemas overview as a placeholder through R2–R4; as of R5 it is part of the
      first-run screen, which is where the R2 note said it was going. The claim itself is in the
      header strip on every view, unconditionally. No check was dropped in either edit.)*
- [ ] The panel is legible in BOTH light and dark mode — check rendered contrast, not class names
- [ ] The panel does not compete with the "Create" button as the page's primary action, and does
      not push the create form below the fold at 1280x800 — the create form is pinned above it
- [ ] Leaving the empty state replaces the panel with the label editor: creating the first schema
      from the pinned form, or opening any schema from the rail, lands on schema detail with the
      add-label form. *(Reworded at R2 from "Selecting a schema replaces the panel with the label
      editor". Selecting is now navigation to a route rather than a pane swap, and the panel only
      exists while there are no schemas at all — but the behaviour it checks still has to hold, so
      the item stays. It was dropped outright in the first R2 edit; that was a silent skip and the
      verifier caught it.)*
- [ ] Neither the badge, its tooltip, nor the panel uses "encrypted" or "secure" (IndexedDB is
      plaintext at rest; overclaiming here is a bug)
- [ ] At 375px wide the badge and panel still read correctly and nothing overflows horizontally

## M6 — Open source packaging

- [ ] `README.md` includes what the tool does, a quickstart, and how to build/deploy — confirmed
      by actually following the quickstart steps from a clean clone
- [ ] CI workflow file exists and, when checked (or manually triggered), lint/test/build all pass
- [ ] `CONTRIBUTING.md` exists and is not a placeholder/stub

---

## R1 — Modernist shell

*(Checkpoint milestone — every later screen sits inside this. Stop for human review after it passes.)*

- [ ] The app loads with no console errors and every existing route still reaches its page:
      schemas, projects, a project's detail, and the annotation canvas
- [ ] Header shows the wordmark, a breadcrumb, the "Nothing leaves your browser" claim strip, and a
      theme toggle
- [ ] The rail lists label schemas and projects as two groups, each with a count; clicking a rail
      item opens that schema or project; clicking a group header reaches that list page
- [ ] The old top-level Schemas/Projects tabs are gone — confirm no orphaned nav remains
- [ ] Theme toggle flips light↔dark and **beats the OS setting in both directions**: with the OS in
      dark, choosing light must give a light page, and vice versa. Check the rendered result, not
      the class names
- [ ] Tailwind `dark:` utilities and `ts-modernist.css`'s `[data-theme="dark"]` rules agree — no
      element shows one theme's text on the other theme's background. Scan a page in each theme
- [ ] The shell fills the window with no 1024px centred cap, and the header no longer spans wider
      than the content beneath it (survey finding 2)
- [ ] The rail is one width on every screen (survey finding 3)
- [ ] Keyboard: tab through header and rail — every control has a visible focus ring, and it is the
      design system's 2px accent ring, not a browser default
- [ ] No horizontal overflow at 1280×800 — measure `scrollWidth` against `clientWidth`, do not judge
      from a screenshot
- [ ] Existing pages still function inside the surface: create a schema, add a label, open a
      document, draw a region. Mixed old/new styling is expected at this stage and is not a failure

## R2 — Schema screens

- [ ] Label-schemas overview lists every schema and creates a new one from a form pinned **above**
      the table (survey finding 5)
- [ ] Schema detail shows the labels table with the add-label form pinned above it
- [ ] The colour control shows the twelve-swatch palette with the five darkened hues
      (`#B35C13`, `#757500`, `#2A8034`, `#3A7D75`, `#C024B6`); a label saved from a swatch stores
      that exact hex in IndexedDB
- [ ] A schema imported with an off-palette hex still shows it as an extra swatch and editing the
      label without touching colour leaves the hex unchanged
- [ ] Hotkey select (edit mode only) offers a–z then 1–9 and 0, and marks already-taken keys
- [ ] Region tag text clears 4.5:1 on every named swatch AND on the colours generated past the
      twelfth label — add a 20-label schema and confirm no two labels share a colour

## R3 — Project screens

- [ ] Projects overview lists every project, with the create form pinned above the list
- [ ] Project detail renders three columns — documents, then the selected document
- [ ] Document detail shows the page preview, the notes field (persisting on blur), and the
      per-page content type with a working override that survives reload
- [ ] Export JSON and Label Studio export are reachable and still produce valid files

## R4 — Annotate

*(Checkpoint milestone — highest-risk screen. Stop for human review after it passes.)*

- [ ] Labels, undo/redo, zoom, page navigation and the layer tag all sit in the toolbar and work
- [ ] Rail is collapsed to 56px; the document overlay opens, picks a document without leaving the
      canvas, and closes
- [ ] The breadcrumb returns to the project, and Esc does the same
- [ ] The regions inspector lists every region on the page, each with its own transcription input
      and Suggest text button; a region whose text came from OCR is tagged
- [ ] Every M3 behaviour still passes: draw, drag off the edge, zoom-normalised coordinates, page
      isolation, delete by key and by button, resize alignment, and hotkeys a–z plus 1–9 and 0
- [ ] Empty page shows the source's own sentence rather than blank space

## R5 — First run

- [ ] With IndexedDB empty, the accent hero, the "What this is not" strip, the three points and the
      create form all render
- [ ] The strip states that IndexedDB is plaintext at rest; no instance of "encrypted", "secure",
      "safe" or "protected" anywhere in the shell or first-run copy
- [ ] Creating a schema from the hero leaves first run and lands on that schema

## R6 — Deferred aggregates

- [ ] Region counts per schema and per label, used-by, last used, annotated ratio with progress bar,
      and per-document region counts all show real numbers that match IndexedDB
- [ ] The document rows carry a content-type tag, as the mockups show. *(Added at R3: the mockup
      puts one tag per document row, but contentType is stored per PAGE, so a multi-page document
      has no stored answer and a mixed one has no obvious answer. Deriving it needs a product
      decision — all-text vs any-scanned vs most-common — which is why R3 ships the row without
      it rather than inventing the rule silently. Whatever rule is chosen, state it in SPEC.md
      and make the tag match it.)*
- [ ] Disk usage comes from `navigator.storage.estimate()` and degrades gracefully where the browser
      does not support it
- [ ] The rail's Find box filters both groups
- [ ] Opening a project with hundreds of documents stays responsive — the aggregates must not be
      recomputed per row on every render

## R7 — Responsive

- [ ] No horizontal overflow at 375, 768, 1024, 1440 and 1920 — measured via `scrollWidth`, since an
      off-canvas overflow is invisible in a screenshot (this exact bug shipped once already)
- [ ] Rail collapses to 56px then off-canvas; the middle column folds into the surface
- [ ] The annotation canvas remains usable at 375px, or degrades with an explicit message rather
      than silently breaking. *(Downgraded to informational: TagStrip is desktop-only — see SPEC.md
      section 9. Report what happens at 375px, but a phone-width shortcoming is not a ✗. The
      no-overflow checks above stay binding at every width, since an overflow at 375 usually means
      something is also wrong at 1440.)*
