# TS-15: stable document order, by filename

## What is asked, and by whom

Asked by Darren, 2026-10-28: "it seems not by filename, it seems follow the order of import first
then reload the page the order changed." Then: "it is confusing when i see 1 order then refresh
change to another."

## Found in the code (2026-10-28)

- Every document list sorts by `createdAt` only: `ProjectDetail.tsx:37` (project list),
  `App.tsx:42` (annotate rail, Prev/Next doc, `[` `]`), `nativeExport.ts:27`,
  `labelStudioExport.ts:54`.
- `nativeImport.ts` gives every imported doc the same `createdAt: now`. Ties fall back to the
  random UUID primary key. Run 2026-10-28 (throwaway vitest, 8 docs a–h, 3 imports): orders
  `gbadcefh`, `chgabefd`, `cdahgfeb`.
- File upload stamps `Date.now()` per file, in the order the picker hands them over. Not run.
- Order changing on reload: inferred (live query shows insertion order first, a fresh read
  breaks ties by UUID). Not reproduced in a browser.

## Proposed (awaiting Darren)

1. **One shared sort for every document list**: filename, natural order (`p2` before `p10`,
   case-insensitive), then `createdAt`, then `id`. Used by the project list, the annotate rail and
   Prev/Next doc, and both exports.
2. **Native import keeps the export's document order** in `createdAt` (`now + index`), so the
   tiebreak means something.

## Scope

**Out of scope**: a user-facing sort toggle; reordering by drag; the order of pages or regions.
Reason: not asked. A toggle can follow if filename order turns out wrong for a real batch.

## Milestones

- **M1. Shared sort and import order.** Checkpoint: Darren decides.

## Open questions (Darren answers)

- **Q1.** Filename natural order, as proposed? Or import order kept exactly?
- **Q2.** Should exports follow the same order? Proposed: yes, so an export reads like the list.

## Falsification test

Upload `p10.png`, `p2.png`, `p1.png` in that order, reload twice: the list must read p1, p2, p10
each time. Any other order, or a change between reloads, and the sort is not applied everywhere.
Safe direction: if unsure, sort; never fall back to primary-key order.
