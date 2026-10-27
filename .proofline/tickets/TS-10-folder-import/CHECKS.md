# tagstrip checks (ticket TS-10-folder-import)

Agreed with the human on: not yet agreed

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.

Every live check runs in a fresh browser context with empty IndexedDB, against the fixture folder
`test-fixtures/folder-import/` (synthetic; its expected tree, counts and byte totals are listed in
its `EXPECTED.md`, the ground truth). The verifier records IndexedDB counts before and after each
check and clears the context at the end. No check edits the fixture.

M2 and M3 checks are written before those milestones start.

## Checks: M1, folder ingestion

### M1-1: pre-flight counts match the folder

- Action: on the projects overview, choose "New project from folder" and pick the fixture folder.
- Observable outcome: the pre-flight shows the PDF count, image count and skipped counts by
  reason exactly as `EXPECTED.md` lists them, and a bytes-needed figure equal to the accepted
  files' total size within display rounding. Bytes available equals `quota - usage` from
  `navigator.storage.estimate()`, read in the same page.
- Broken by: counting a skipped file type (say `.txt`) as accepted.

### M1-2: nothing is written before Import

- Action: record the counts of projects, docs and pages in IndexedDB. Pick the fixture folder,
  reach the pre-flight, press Cancel.
- Observable outcome: all three counts are unchanged, and no new project appears in the list.
- Broken by: creating the project record when the scan starts instead of when Import is pressed.

### M1-3: every document lands with its path

- Action: pick the fixture folder and press Import; wait for it to finish; reload the page (a real
  browser reload).
- Observable outcome: one new project, named after the folder. Its doc count equals
  `EXPECTED.md`'s accepted total. The set of (path, filename) pairs read from IndexedDB equals the
  expected list exactly, with no extras and none missing. Files at the folder root have no path.
  The two same-named files in different subfolders are two separate docs with different paths. The
  path does not repeat the top folder's own name.
- Broken by: storing `webkitRelativePath` whole, so every path starts with the top folder's name.

### M1-4: cancelling part way leaves a usable partial project

- Action: generate the large fixture (a few hundred small PDFs) with the committed script, import
  it, read the progress twice a few seconds apart, then press Cancel before it finishes.
- Observable outcome: the two progress readings differ and count documents, not only pages. After
  cancel the project holds k docs, with k above 0 and below the total. Every one of those docs has
  exactly `pageCount` page rows. Open one landed doc, draw a region, reload: the region is still
  there.
- Broken by: ignoring the cancel flag, so the import runs to the end.

### M1-5: single-file upload still works

- Action: in an existing project, upload one PDF through the existing upload button.
- Observable outcome: it lands as before, with no path, and opens on the canvas.
- Broken by: making `path` required on the code path both uploads share.

### M1-6: pre-flight warns when space is short

- Action: pick a folder whose bytes needed exceed the bytes available. The verify skill names
  how the shortfall is produced (for example an overridden storage quota on the origin).
- Observable outcome: the pre-flight shows a warning naming both figures, and Import is still
  available (pending Q5).
- Broken by: dropping the comparison, so no warning shows.

### M1-7: a quota error part way keeps what landed

- Action: run the unit test that makes the Nth document write fail with `QuotaExceededError`.
- Run: `pnpm install --frozen-lockfile && pnpm exec vitest run src/db/folderImport.test.ts -t "quota"`
- Observable outcome: exit 0. The test asserts the first N-1 docs remain, each with all its page
  rows, and the project record survives.
- Broken by: deleting the project on any write error.

### M1-8: lint, build, test

- Run: `pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test`
- Observable outcome: exit 0.
- Broken by: any lint error, type error or failing test.

## Known non-failures

<!-- Starts empty. -->

## Changes after a run

<!-- Starts empty. -->
