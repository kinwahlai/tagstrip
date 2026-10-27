# TS-10: import a folder of documents, folder tree intact

## What is asked, and by whom

Asked by Darren (raised during the M7 to M9 round; written up in `HANDOFF-M10-folder-import.md`,
2026-09-19). Let someone pick a folder and have TagStrip import every document beneath it, keeping
the folder structure in the document list instead of flattening it.

The problem, in the words it was raised in: working through sixteen documents out of order and
losing track of which had been touched. M9's checkmarks answered half of that. Real source material
arrives already organised in folders (one per customer, per case, per batch), and throwing that
structure away at the door is the other half.

## Decided (Darren, via the handoff, 2026-09-19)

- **One folder makes one project**, named after the folder.
- **The tree is derived, not stored.** `Doc` gains an optional `path` string; the tree comes from
  splitting it. No folder table or folder entities.
- **`<input type="file" webkitdirectory>`, not `showDirectoryPicker()`.** The latter is
  Chrome/Edge only, and the project already turned down a better OCR engine to keep Firefox and
  Safari working (`SPEC.md` section 2).
- **A pre-flight step before anything is written**: documents by type, skipped files by count and
  reason, bytes needed against bytes available. Then Cancel or Import.
- **The import is batched and cancellable, and keeps what already landed.** Cancelling, or running
  out of quota part way, leaves a usable partial project.
- **Folder rows show a rollup (`3/9`, documents with at least one region), never a checkmark.**
- **M9's fixed-position checkmark column survives.** Indent the filename, not the marker column.
- **Native export gains an optional `path`; `NATIVE_EXPORT_VERSION` stays 1**, as M7 did for the
  annotations-only shape. Files without `path` import with their documents at the tree root.
- **The Label Studio export becomes path-aware**, inside this ticket, since folder import makes
  duplicate filenames the normal case.

## Re-checked against the code (HEAD 58cbd4e, 2026-10-27)

The handoff's code findings hold. Differences and additions:

- `navigator.storage.estimate()` is called only for `usage` today (`src/lib/useWorkspaceStats.ts:49`).
  The pre-flight also needs `quota`; nothing reads it yet.
- `addPdfDocument` (`src/db/docs.ts:28-69`) writes the doc and all its pages in one transaction
  after the per-page loop (63-66). A cancel between documents therefore cannot leave a half
  document, which is what makes the "usable partial project" decision cheap.
- `getTextContent()` is now at `src/lib/pdf.ts:59`. The per-page loop is serial (49-61), and
  `onProgress` reports pages within one document only.
- `addImageDocument` (`src/db/docs.ts:71-100`) does no per-page work, so images are cheap.
- `importNativeExport` builds each `Doc` field by field (`src/lib/nativeImport.ts:124-134`), so
  `path` is dropped on import unless added there. The parser tolerates unknown fields, so older
  builds read newer files and drop `path` silently.
- The Label Studio image name is `filename` with `.pdf` swapped for `.png`, or
  `filename#page-N.png` for multi-page docs (`src/lib/labelStudioExport.ts:108-111`). No path.
- No folder or path concept exists anywhere in `src/` today.

## Scope

**In scope**: folder picker on the projects overview, pre-flight, batched cancellable import,
`Doc.path`, the tree in the document list with folder rollups, path-aware native and Label Studio
exports, `FORMATS.md` updated to match.

**Out of scope**
- Adding a folder to an existing project. Reason: not asked; it raises path-collision and
  project-naming rules nobody has decided (pending Q1).
- Renaming or moving folders. Reason: the tree is derived; folder records would be a second source
  of truth about where a document lives.
- The three adjacent issues in the handoff's section 7 (zoom carry-over on document switch, no
  re-labelling, no URL routing). Reason: each pre-dates this work and is its own ticket. Zoom
  carry-over gets more visible with mixed folders; worth taking next.

## Milestones

Riskiest first: ingestion and storage, then display, then exports. Checks for M2 and M3 are written
before each starts.

- **M1. Folder ingestion.** Picker, pre-flight, batched cancellable import, `Doc.path` stored.
  Demoable as: pick a folder, see the pre-flight, import, cancel part way, documents land with
  their paths.
- **M2. The tree.** Document list grouped by path, collapsible, folder rollups, the checkmark
  column fixed at every depth, rollups updating live.
- **M3. Exports.** Native export round-trips `path`; pre-M10 files still import; Label Studio
  export has no collisions for duplicate filenames; `FORMATS.md` says so.

Checkpoints: Darren decides (Q6).

## Before M1 can be verified

The verifier drives the app only through `.claude/skills/verify-tagstrip/`, which does not exist
yet. create-verify-skill runs first. It must prove the verifier can feed a folder to a
`webkitdirectory` input through Playwright; if it cannot, M1's live checks cannot run, and that is
a blocker to raise, not to work around.

Fixtures are synthetic, never real documents: a small committed folder under `test-fixtures/` with
a known tree, plus a script that generates a few hundred small PDFs for the large-import check.

## Open questions

Each carries Claude's recommendation; Darren answers all of them.

- **Q1. Can an existing project absorb a second folder?** Recommend no, for this ticket: folder
  import only creates a project. Blocks: the entry point and M1-3's wording.
- **Q2. What happens to files that are not documents?** Recommend: accept exactly what the upload
  button accepts; skip everything else; the pre-flight groups skips by reason (hidden or system
  files such as `.DS_Store`, then unsupported types by extension), with a count per group, not a
  file-by-file list. Blocks: M1-1.
- **Q3. Depth limit?** Recommend none: indent per level, no flattening. The fixture goes four deep.
  Blocks: M2's checks.
- **Q4. Empty folders?** Recommend omitted. This falls out of the derived tree: a folder with no
  imported document under it has no path to derive it from. Blocks: M2's checks.
- **Q5. Pre-flight says needed exceeds available. Block or warn?** Recommend warn and still allow
  Import: browser estimates are approximate, and the batched import keeps what lands if the quota
  runs out. Blocks: M1-6.
- **Q6. Which milestones are checkpoints?** Recommend M1 and M2: M1 sets the data model every later
  milestone reads, and M2 is the interactive part. M3 is mechanical against agreed checks.

## Falsification tests for the design

- **Derived tree.** Shown wrong if two folders with the same name at different depths merge, or a
  folder holding only skipped files gets a row. M2's checks cover both.
- **Per-document transactions give a clean partial import.** Shown wrong if, after a cancel or a
  quota error, any document has fewer page rows than its `pageCount`. M1-4 and M1-7 count them.
  Safe direction: losing the document in flight is fine; a half-written one is not.
- **`webkitdirectory` keeps Firefox and Safari working.** Shown wrong if the picker returns no
  relative paths in Firefox. This is the decision's whole reason, and the verifier's browser is
  Chromium only, so it is a manual check for Darren before M1 is called done. Unconfirmed until
  then.
- **No version bump.** Shown wrong if a pre-M10 export fails to import after M3. M3 covers it.
