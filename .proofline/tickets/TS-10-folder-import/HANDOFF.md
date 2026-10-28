# Handoff — M10: import a folder of documents, folder tree intact

**Written:** 2026-09-19
**Repo state at handoff:** branch `main`, clean, level with `origin/main` at `cc2f6be`.
**Remote:** `kinwahlai/tagstrip`. Commits in this run were authored as `Darren Lai <kinwah.lai@gmail.com>`.

This document exists so the work can be picked up on another machine without replaying the
investigation. Everything below marked **established** was read out of the code or observed in a
browser during the session that produced M7–M9; everything marked **open** genuinely has not been
decided and should not be guessed at.

---

## 1. Read these first

- `CLAUDE.md` — the working policy. It governs how a milestone gets built here and is not
  optional: implement → run `pnpm run lint` / `pnpm run build` / `pnpm test` yourself → invoke the
  `verifier` subagent against `VERIFICATION.md` → fix what it reports → at most three attempts,
  then stop and ask. A milestone is never "done" because the code looks right.
- `SPEC.md` section 10 — the feature round that produced M7, M8 and M9, and the deferred
  table-aware extraction item.
- `VERIFICATION.md` sections M7, M8, M9 — the rubric style M10's will need to match.
- `FORMATS.md` — the export contract, which M10 touches.

## 2. Where things stand

Shipped and verified in browser, all pushed:

| Milestone | What it did | Commit |
|---|---|---|
| M7 | Export without the source document — "Export JSON" is now a dialog with an annotations-only mode | `0abe577` |
| M8 | Move and resize regions; arrow-key nudge; Esc deselects before leaving the canvas | `9472b28` |
| M9 | Fit / 100% zoom buttons, Ctrl+wheel zoom about the pointer, document progress checkmarks | `e045e1f` |
| docs | README, FORMATS compatibility note, fresh `docs/screenshot.png` | `cc2f6be` |

Test suite at handoff: **182 passing across 23 files**. Lint and build clean.

## 3. The feature

Let someone pick a **folder** and have TagStrip import every document beneath it, preserving the
folder structure in the document list rather than flattening it into one long list.

The motivating problem, in the words it was raised in: working through sixteen documents out of
order and losing track of which had been touched. M9's checkmarks answered half of that. Real
source material arrives already organised in folders — one per customer, per case, per batch — and
throwing that structure away at the door is the other half.

### Decided

- **One folder makes one project**, named after the folder.
- **The tree is derived, not stored.** Each document gets an optional `path` string; the tree is
  produced by splitting it. No folder table, no folder entities. Folder records would only buy
  rename and move, which nobody has asked for, at the cost of a second source of truth about where
  a document lives.
- **Use `<input type="file" webkitdirectory>`, not `showDirectoryPicker()`.** The File System
  Access API is Chrome/Edge only. This project already turned down a more accurate OCR engine
  specifically to keep Firefox and Safari working (`SPEC.md` section 2, the Donut/Tesseract
  reasoning) — picking a Chrome-only API here would contradict a decision the project has already
  taken and written down. `webkitdirectory` is supported everywhere and gives each file a
  `webkitRelativePath`, which is exactly the tree.
- **A pre-flight step before anything is written.** Count of documents by type, count and reason
  for skipped files, total bytes needed against bytes available. Then Cancel or Import.
- **The import is batched and cancellable, and keeps what already landed.** Cancelling or running
  out of quota half way must leave a usable partial project, not a corrupt one and not nothing.
- **Folder rows show a rollup, never a checkmark** — `3/9`, meaning documents with at least one
  region. A folder is not something you annotate, so giving it the same marker as a document would
  claim something untrue.
- **M9's fixed-position checkmark column survives.** That column exists so gaps are found by
  scanning rather than by reading each row's count; indenting it per tree depth would undo the
  entire point. Indent the filename, not the marker column.

### Open — answer before building

1. **Can an existing project absorb a second folder?** Or is folder import only ever how a project
   comes into existence? This changes the entry point (projects overview only, versus also inside
   project detail), what happens to `path` collisions between two imports, and whether the project
   name stays tied to the original folder. This was asked and not answered.
2. **What counts as a document worth importing?** The current upload input accepts
   `.pdf, application/pdf, image/png, image/jpeg, image/webp` (`src/components/ProjectDetail.tsx:122`).
   A real folder also contains `.DS_Store`, Office files, archives. Silently skipping is probably
   right, but the pre-flight has to *say* what it skipped and why, and someone should decide
   whether an unrecognised extension is skipped silently or listed individually.
3. **Depth limit.** Full depth was assumed, indenting further each level. Deeply nested trees may
   want flattening past some depth, or a breadcrumb instead of indentation. Untested.
4. **Empty folders.** Shown as empty rows, or omitted entirely?

## 4. Shape of it

```
SELECTING
──────────────────────────────────────────────────────────────

  Projects overview
      │
      └─▶ [ + New project from folder… ]
               │
               ▼
          OS folder picker
          <input type="file" webkitdirectory>
          returns every file beneath it, each carrying
          its own webkitRelativePath
               │
               ▼
          SCAN + PRE-FLIGHT          ← nothing written yet
          ┌────────────────────────────────────────────┐
          │  214 PDFs, 38 images                       │
          │  11 files skipped  (.DS_Store, .xlsx, .zip)│
          │  1.9 GB needed  ·  4.2 GB free             │
          │                     ↑ storage.estimate()   │
          │            [ Cancel ]   [ Import ]         │
          └────────────────────────────────────────────┘
               │
               ▼
          IMPORT — batched, cancellable
          ████████████░░░░░░░░  118 / 252
          keeps whatever already landed if you cancel
          or the quota runs out mid-way
               │
               ▼
          Project "kyc-batch-2026-09"


SHOWING
──────────────────────────────────────────────────────────────

  PROJECT  kyc-batch-2026-09                    schema: KYC v1
  ┌────────────────────────────────────────────┐
  │ DOCUMENTS                          12/252  │ ← project rollup
  ├────────────────────────────────────────────┤
  │ ▾ acme-ltd                            3/9  │ folder: rollup only
  │     ✓   1  cert-inc.pdf                 4  │ ✓ then region count
  │     ✓   2  passport.png                 2  │
  │         3  utility.pdf                  0  │ ← dimmed, empty slot
  │ ▸ brightwater-plc                    0/14  │ collapsed
  │ ▾ northgate-energy                   9/11  │
  │     ✓   4  statement.pdf                6  │
  │         5  invoice.pdf                  0  │
  │ ▾ acme-ltd / archive                  0/3  │ deeper nesting just
  │         6  scan-2019.pdf                0  │ indents further
  └────────────────────────────────────────────┘
             ▲
             └── the ✓ column stays fixed-position, as M9 built it,
                 so gaps are still found by scanning not reading
```

## 5. What the code already tells us

All **established** by reading the current tree. These are the findings that make this feature
cheaper or more expensive than it looks, and they are the reason this handoff exists.

### The expensive part is ingestion, not the tree

`addPdfDocument` (`src/db/docs.ts:28-67`) loops every page of every document **serially**, calling
`extractPageMetadata`, which calls pdf.js `getTextContent()` (`src/lib/pdf.ts:44`). Page
rasterisation is lazy — that part is fine — but **text-layer extraction is not**. A folder of 300
ten-page statements is 3,000 serial pdf.js parses behind a single progress bar.

This is the milestone's real work. Batching, a cancel path, and progress that reflects documents as
well as pages all have to be built. The existing `onProgress?: (pagesProcessed, pageCount)` callback
reports per document only.

### Storage will be the failure mode

Source PDFs are stored whole as blobs on the `Doc` record (`Doc.sourceBlob`, `src/db/types.ts`),
deliberately — that is what lets unvisited pages rasterise lazily after a reload, and what the M7
full export round-trips. A folder of real documents is easily gigabytes, and the browser quota is
finite.

`navigator.storage.estimate()` is already wired up and already used — see
`src/lib/useWorkspaceStats.ts:38` and `src/lib/formatBytes.ts`. Use it in the pre-flight, before
writing, not as a post-mortem after a quota error.

### Filenames stop being unique — and one export already assumes they are

`src/lib/labelStudioExport.ts:110-113` uses `doc.filename` directly as the task's `data.image`.
Two documents named `invoice.pdf` in different folders collide silently in that export today; you
would have to work at it to hit that. **With folder import it becomes the normal case.** Making
that export path-aware belongs inside M10, because that is where the bug stops being theoretical.

### The export format changes again — do not bump the version

`NativeExportDoc` (`src/lib/nativeFormat.ts`) carries `filename` and would gain `path`. Note what
M7 already established and what `FORMATS.md`'s Compatibility section now states outright:
`NATIVE_EXPORT_VERSION` stayed at **1** when the annotations-only variant was added, deliberately,
because bumping it would make older builds reject every newer file including ones they could read
perfectly well. Version 1 already describes two shapes. Adding an optional `path` follows the same
reasoning — add it optional, leave the version alone, and update `FORMATS.md` to say so.

`src/lib/nativeImport.ts` must accept files with no `path` (everything exported before M10) and
place those documents at the tree root.

### The data model addition is genuinely small

`Doc` gains `path?: string`. It is **not** indexed, so no Dexie version bump — compare M7, which
added `Doc.sourceMissing?: boolean` the same way and left `src/db/db.ts` untouched.

### The document list and its counts

Rows are rendered at `src/components/ProjectDetail.tsx:181` onward. Region counts come from
`stats.regionsByDoc`, a `Map<docId, count>` built in `src/lib/stats.ts:48-51` from an index-only
scan — deliberately, so counting does not pull every stored PDF into memory. Folder rollups should
be derived from that same map by grouping on `path`, for the same reason. `useWorkspaceStats` is
backed by Dexie's `useLiveQuery`, so rollups update live with no extra plumbing — this was
confirmed by test during M9.

## 6. Suggested milestone shape

Write it into `SPEC.md` as **M10** in the same voice as section 10's existing entries: decisions
with their reasons, and anything ruled out stated as ruled out rather than left ambiguous. Then
write the `VERIFICATION.md` rubric **before** building, since under `CLAUDE.md`'s policy a
milestone with no rubric cannot be reported done.

The rubric needs at minimum:

- A folder with nested subfolders imports with the tree intact, expandable and collapsible.
- Documents sitting loose at the folder root appear at the tree root.
- Non-document files are skipped, and the pre-flight names how many and why.
- The pre-flight reports a size against available space, and nothing is written until Import is
  pressed — check by cancelling and confirming no project, documents or pages were created.
- Cancelling an import mid-way leaves a usable partial project, and what landed is genuinely
  usable: open one of those documents and annotate it.
- Folder rows show a rollup that matches the documents beneath them, including nested ones.
- M9's checkmark column is still in a fixed x-position across every row at every tree depth —
  measure it, do not eyeball it. This is the item most likely to be quietly broken by indentation.
- Drawing a first region updates both the document's checkmark and every ancestor folder's rollup,
  live, with no reload.
- Two documents with the same filename in different folders export to Label Studio without
  colliding.
- A native export round-trips `path`, and a pre-M10 export file without `path` still imports, with
  its documents at the tree root.
- A large import — some hundreds of documents — reports progress that moves and can be cancelled.

## 7. Adjacent issues, deliberately not in this milestone

Recorded so they are not rediscovered as surprises. None are M10's, none are fixed.

- **Document-switch zoom carry-over.** `AnnotationCanvas` is never remounted when you switch
  documents (no `key={docId}` in `App.tsx`) and `didAutoFitZoom` is a ref that fires once per
  mount, so paging between documents carries the previous one's zoom over verbatim instead of
  re-fitting. Found three times by the verifier during M9, pre-dates that work, and Fit corrects
  it by hand. Suggested fix: reset the ref on a `docId` change. **This gets worse with M10** — a
  folder of mixed page sizes makes the carry-over much more visible.
- **No re-labelling of an existing region.** `src/db/annotations.ts` can update a region's
  geometry and its text but never its `labelId`; the label chips and hotkeys only choose the label
  for the *next* box drawn. A real gap, its own milestone.
- **No URL routing at all.** `App.tsx` holds view state in plain `useState`, so a browser reload
  always returns to the project list rather than the document you were on. Pre-existing; noted in
  `VERIFICATION_REPORT.md` during M7.

## 8. Still open elsewhere

**Table-aware / structure-aware extraction** is written up in `SPEC.md` section 10 as deferred,
deliberately with no rubric so it cannot be picked up as though settled. The open question is not
how to build it but which feature it is: extraction into a box the user drew (inside v1 scope, an
extension of the existing "Suggest text"), or detecting tables and drawing the boxes automatically
(model-assisted pre-labeling, which `SPEC.md:75` puts out of v1 scope). Settle that before writing
anything into the rubric.
