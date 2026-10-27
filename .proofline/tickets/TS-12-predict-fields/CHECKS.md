# tagstrip checks (ticket TS-12-predict-fields)

Agreed with the human on: not yet agreed

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.
Output varies run to run: also `noise-floor-before-credit`.

M1 adds a dev-only harness page that runs the model on a list of pages with the schema's fields
and prints, per field, an id, the box verdict with its overlap, the value verdict and the time:
never the text. A synthetic set in `test-fixtures/predict-fields/` (generated forms with known
field positions and values) is committed. The evaluation set is Darren's, outside the repo
(TICKET.md Q2). The model loads from a local path outside the repo.

M2 and M3 checks are written before those milestones start.

## Checks: M1, feasibility and measurement

### M1-1: the model runs in Chromium on WebGPU

- Action: open the harness in Chromium, load the model, run it on the synthetic set.
- Observable outcome: every page returns a parseable list of fields with boxes in 0..1, and the
  harness reports the WebGPU backend was used.
- Broken by: forcing the WASM backend.

### M1-2: no network once loaded

- Action: block every request not to the dev server's origin, then run M1-1.
- Observable outcome: the same verdicts as M1-1, and no blocked request is logged.
- Broken by: letting transformers.js fetch the processor config from the Hugging Face Hub.

### M1-3: the scorer is right

- Action: run the scoring on the synthetic set with the model's output replaced by the fixture's
  own true boxes and values, then with every box shifted by half its width.
- Observable outcome: the first scores every field as box hit and value match; the second scores
  every box as a miss and leaves the value verdicts unchanged. The fixture is unchanged after.
- Broken by: computing overlap as intersection over the predicted box only.

### M1-4: the comparison run

- Action: run the model twice in Chromium on the evaluation set, and once in Python on the GPU
  in lfm-extract-test with the same pages, prompt and image size.
- Observable outcome: a table of box hits, value matches, wrong values, blanks, unstable fields
  and median time per page, per run; and the verdict under the TICKET.md decision rule as agreed.
  The evidence holds counts only: no text, no filenames.
- Broken by: scoring against the first labelled region of each page regardless of its label.

### M1-5: lint, build, test

- Run: pnpm install --frozen-lockfile && pnpm run lint && pnpm run build && pnpm test
- Observable outcome: exit 0.
- Broken by: any lint error, type error or failing test.

## Known non-failures

<!-- Starts empty. -->

## Changes after a run

<!-- Starts empty. -->
