# TS-14: annotation flow fixes before the 110-document batch

## What is asked, and by whom

Asked by Darren, 2026-10-28, before annotating 110 documents. Four raw notes, arranged and
answered in chat the same day:

1. "add the field show in random seq" → regions on a page list in random order.
2. "when done come back, show the selected before i go into annotation canvas" → returning
   from the canvas loses the selected document.
3. "direct go to next page in annotation page" → clarified: next **document**, not page.
4. "highlight the textfield when i click or select the label" → selecting a region should
   bring its transcription field forward.

## Found in the code (2026-10-28)

1. `AnnotationCanvas.tsx` reads a page's regions with `where('[documentId+pageIndex]')`, so they
   come back in primary-key order: random UUIDs (`lib/id.ts`). Hence the random order.
2. `ProjectDetail.tsx` holds `selectedDocId` in local state; it remounts on Back, so it starts
   at null.
3. Next document exists only as an unlabelled arrow icon in the 56px `MiniRail` strip. No
   keyboard route.
4. Selecting a region tints its row in `RegionList`; the field is not scrolled to or focused.

## Decided (Darren, 2026-10-28)

1. **Region list follows schema label order.** Same label twice: earlier `createdAt` first.
   A region whose label is no longer in the schema goes last.
2. **Back from the canvas selects the document last open there** (after Next document, that is
   the later one), and scrolls it into view in the project's document list.
3. **Next document is one obvious step from the canvas** (see Q1 for the form).
4. **Selecting a region scrolls its transcription field into view, highlights it, and focuses
   it.** Applies to: clicking a box on the canvas, clicking the region's label in the list, and a
   newly drawn box. Esc from the field returns focus to the canvas (hotkeys work again); a second
   Esc then deselects as today.

## Scope

**Out of scope**: order of the label picker (already schema order); changing page navigation;
the OCR tag on empty text (O6). Reason: not asked.

## Milestones

- **M1. All four changes.** One milestone; each is small and in the canvas or project list.
  Checkpoint: yes (Darren, 2026-10-28: build in one go, then try it).

## Answered (Darren, 2026-10-28)

- **Q1.** Next document form. The need, in Darren's words: continue to the next document without
  leaving the annotation canvas (today he goes back to the list and picks the next one). Agreed: a labelled "Next doc →" button in the canvas
  toolbar, right of the page controls, plus the shortcut **`]`** (and `[` for previous).
  Letters and digits are taken by label hotkeys, so the shortcut cannot be `N`.
- **Q2.** Focusing the field (decision 4) means label hotkeys, Delete and arrow-nudging
  go into the field until Esc. Accepted.

## Falsification tests

- Order: draw labels in reverse schema order on one page, reload; the list must read in schema
  order. If it reads in draw order or varies across reloads, the sort is not applied.
- Focus: after selecting a box, press a label hotkey letter; it must type into the field, not
  switch label. After Esc, the same letter must switch label. Either failing shows focus is not
  where the design says.
