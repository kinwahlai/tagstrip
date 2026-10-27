# TagStrip — Project Instructions

## What this project is

A browser-based tool for drawing labeled bounding boxes on document pages (PDFs or images), with
a per-box text transcription field, for preparing training and test data for
document-understanding pipelines. 100% client-side static site: no backend, all data in the
user's browser (IndexedDB).

## How it is verified

- Runs as: browser UI
- Output must be right, not merely present: yes

## Commands

- Lint: `pnpm run lint`
- Build: `pnpm run build`
- Test: `pnpm test`
- Run: `pnpm run dev`

## Attention review

- Per-review cap: 20 Kiro credits. The reviewer model is chosen per run, from
  another family than the one that built the milestone.

## Conventions

- Commits: one plain-English imperative sentence as the subject, no type prefix.
- Team norms: lint, build and test must all pass before a PR; CI
  (`.github/workflows/ci.yml`) runs the same three. See `CONTRIBUTING.md`.

## Where things live

- `SPEC.md`: the spec and milestone plan.
- `VERIFICATION.md`, `VERIFICATION_REPORT.md`, `verification-screenshots/`: the rubric and
  audit trail from before proofline. Kept as history.
- `.proofline/CHECKS.md`: the standing checks.
- `.proofline/OPEN-ITEMS.md`: open items. Read it first when coming back cold.
- `.proofline/ARCHIVE.md`: closed items and their reasoning.
- `.proofline/RULES.md`: each learned rule, its layer and what enforces it.
- `.proofline/tickets/<id>-<slug>/`: one folder per ticket.
  - `TICKET.md`: the ticket spec.
  - `CHECKS.md`: the ticket's checks.
- `.proofline/verification/`: never in the project's commits (gitignored). The ledger
  (`ledger.tsv`), `seen-failing.tsv`, and the verifier's reports and evidence, by ticket,
  milestone and commit.
- `.claude/agents/verifier.md`: the verifier subagent.
- `.claude/skills/verify-tagstrip/`: how to run and drive the project, once it is written.

Use the proofline-mode skill at the start of every task.
