# Annotation canvas

The page view where the user picks a label, drags on the page to draw a region, selects, moves, resizes and deletes regions, zooms, and pages through the document. The right panel ("Regions on this page") lists the regions with transcription fields.

## Sub-features

- draw: drag on the page with a label active
- select-move-resize: click a region, drag its body or a corner handle
- delete / undo / redo
- zoom: in, out, fit, 100%, Ctrl+wheel
- page-nav: previous and next page
- label-hotkeys, arrow-key nudge, Esc to leave
- doc-switching: toolbar "← Prev doc" / "Next doc →", `]` / `[` keys, mini rail, documents overlay
- region-order: the region list follows schema label order, then draw order (TS-14)
- field-focus: selecting a region focuses and outlines its transcription field (TS-14)
- label-click: clicking a label in the Labels picker selects that label's next region on the page (cycling) and focuses its field; hotkeys only set the drawing label (TS-14)

## How to get to it

- ProjectDetail: select a document, "Open annotation canvas".
- Sample document button on the first-run page.
- Breadcrumb back button or Esc returns to the project, with the document last open selected and scrolled into view.

## Driving it

No scripted journey yet for the whole feature; draw is scripted inside `suggest-text-ocr`.

Preconditions: a project with an uploaded document (projects-and-documents.md).

1. Labels: `getByRole('group', {name:'Labels'})` holds chip buttons with `aria-pressed`; the first label is active by default.
2. Draw: `img[alt="Page 1"]` is the stage's box; `boundingBox()`, then `mouse.move/down/move(steps)/up` inside it. Result: heading "Regions on this page · 1", and the new region is selected (tag text ends " · selected").
3. Select/move: a region is a button over the stage; dragging its body moves it, the four `ts-handle` spans resize. Delete via button `Delete region for <label>` or the Delete key.
4. Toolbar buttons (aria-labels): `Undo`, `Redo`, `Zoom out`, `Zoom in`, `Fit page to available width`, `Zoom to 100%`, `Previous page`, `Next page`; the primary button "Next doc →" (no aria-label, disabled on the last document); readout `data-testid="zoom-readout"`.
5. Scroll container: `data-testid="canvas-scroll-area"`.

## Gotchas

- A drag must start on the stage itself (not on an existing region) to draw; boxes smaller than the minimum are discarded silently.
- The box must be inside the viewport: scroll the stage into view first.
- Regions beyond MIN_BOX_SIZE only; use `steps` on mouse moves so mousemove handlers fire.
- Keyboard shortcuts are window-level: typing in a transcription field must not be mistaken for a hotkey press.
- Selecting, clicking or drawing a region moves focus into its transcription field one animation frame later, and the field gets `data-selected="true"`. Label hotkeys, `]` / `[`, arrows and Delete then type into the field: press Esc once to leave the field before using them, and a second time to deselect.
- The mini rail's "Next document" button and the toolbar's "Next doc →" do the same thing; match the toolbar one with the exact name `'Next doc →'`; a regex like `/Next doc/` also matches the rail's "Next document" and fails strict mode.
