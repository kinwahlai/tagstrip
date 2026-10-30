# TS-19: click on text to box it

## What is asked, and by whom

Asked by Darren, 2026-10-30: 'new feature "click to box the text"'. Nothing else written yet.
Read as: click once on printed text and get a region drawn snugly around it, instead of dragging
the box by hand. Darren accepted every proposal below, 2026-10-30: "accept what you proposed. then
i check later and try manually".

## Found in the code (main 8d5d28c, 2026-10-30)

- A click that does not move the pointer creates nothing today (`PageStage.tsx:172`): a drag
  below `MIN_BOX_SIZE` writes nothing. So a plain click on empty page is free.
- Text-layer PDF pages store every pdf.js text item with its box, normalised to the page
  (`Page.textLayer: PdfTextItem[]`, `db/types.ts:50`). A pdf.js item is usually a run of text on
  one line in one font: often a phrase or a value, sometimes a whole line.
- Image pages (and scanned PDFs) have no text layer. PP-OCRv6's detector finds line boxes
  (`detectLines`, `ocr/ppocr.ts:271`), internal to that module today. It shrinks the input so its
  long side is at most `DET_MAX_SIDE`, so on a full page small print may be missed.
- Drawing a region needs a selected label; a new region is selected and its field focused (TS-14).
- Fixture ground truth: `test-fixtures/ocr-pages-zh/expected.json` has fields with boxes per page.

## Decided (Darren accepted the proposals, 2026-10-30)

1. **Gesture: a plain click** on the page where there is no region, with a label selected. Drag
   still draws a box by hand. Clicking an existing region still selects it.
2. **Text-layer pages: the text item under the click**, its stored box with a small margin. No
   model, instant.
3. **Image pages: the detector line under the click.** Crop a window around the click (not the
   whole page, so small print is not shrunk away), run the detector on it, take the line box
   that contains the click. Loads the same OCR files as Suggest text (about 57 MB, cached).
4. **Nothing under the click** (blank area, or no line found): nothing is created, and a short
   message says so.
5. **Fill the text too**: the new region gets its transcription as Suggest text would (free on
   text-layer pages; one OCR read on image pages). Focus stays in its field.
6. **Undo** removes a clicked box, like a drawn one.

## Amended (Darren, 2026-10-30, after trying M1 by hand)

Darren: "it works well. i wonder if we need to add hint to use the hotkey like the suggest text ->
Ctrl+Alt+S and now i wonder if i want to make it Alt+click, leave the drawing as it is". Agreed:

7. **Alt+click** (Option+click on Mac) boxes the text. Replaces decision 1's plain click. A plain
   click goes back to what it did before TS-19: deselects, creates nothing. Drag and Alt+drag
   draw by hand as before.
8. **A visible hint** in the canvas panel footer names both shortcuts: Alt+click to box, Ctrl+Alt+S
   to suggest text (Option on Mac).

Risk: some Linux desktops take Alt+drag to move windows. Not tested; TagStrip is desktop, used on
macOS and Windows here.

## Scope

**Out of scope**: snapping or tightening a box drawn by hand; boxing a word inside a pdf.js item;
multi-line selection (click-drag across lines); auto-boxing a whole page. Reason: not asked.

## Milestones

- **M1. Click to box, text-layer and image pages.** Checkpoint: yes, Darren tries it by hand
  before merge.

## Open questions

None. Q1 to Q4 answered 2026-10-30 by accepting the proposals: the item or detector line under
the click; a plain click; fill the text; image pages in M1.

## Falsification test

On the bundled sample PDF, click inside a known line: the new box's Suggest text must return
exactly that text item's string, and the box must not overlap the neighbouring line. On
`p09.png`, click inside the first field from `expected.json`: the box must overlap that field's
box (IoU >= 0.5). A box that also takes in the next line, or that lands somewhere the click was
not, shows the design wrong. Safe direction: when unsure what is under the click, create nothing.
