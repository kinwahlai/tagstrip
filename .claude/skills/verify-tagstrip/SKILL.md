---
name: verify-tagstrip
description: Run and drive TagStrip, a 100% client-side browser UI (Vite + React, data in IndexedDB) for drawing labeled boxes on PDF/image pages. Use when verifying a TagStrip milestone or check by running the app in a real browser (Chromium, Firefox, WebKit), including network-blocked runs.
---

# verify-tagstrip

TagStrip has no backend. The "service" is the Vite dev server serving the app; all state is the browser's IndexedDB. Run it from a clean worktree of the commit under test. Feature map: `features/README.md`.

Every block below sources `scripts/env.sh` (each block runs in a fresh shell). Set `WORKTREE` (the checkout to run) and optionally `PORT` (default 5199). Run paths are relative to the skill folder, `/home/snaic-darren/projects/tagstrip/.claude/skills/verify-tagstrip` (the main checkout's copy is fine for a worktree of another commit).

## Launch

```bash
export WORKTREE=/path/to/clean/worktree PORT=5199
S=/home/snaic-darren/projects/tagstrip/.claude/skills/verify-tagstrip/scripts
$S/launch.sh && $S/pw-install.sh
```

`launch.sh` runs `pnpm install --frozen-lockfile` in `$WORKTREE` (a fresh worktree has no `node_modules`; no `.env` is needed), starts `node node_modules/vite/bin/vite.js --port $PORT --strictPort --host 127.0.0.1` detached, records that node pid in `$RUN_DIR/vite.pid` (`RUN_DIR=/tmp/verify-tagstrip-$PORT`), and waits up to 60 s for HTTP 200 with `id="root"` on `http://127.0.0.1:$PORT/`. On failure it exits non-zero with the log tail. `pw-install.sh` puts playwright 1.62.1 (library only, no download) in `$RUN_DIR/pw`; it matches the browsers already in `~/.cache/ms-playwright` (chromium-1234, firefox-1538, webkit-2336). If those are absent the drive fails at browser launch; report that, do not install other versions.

Empty data directory: every drive run starts a fresh browser context (WebKit: a fresh temp profile), so IndexedDB is empty and the app shows first-run. There is no seed data and no migration step (Dexie creates the schema on open).

Two instances can run side by side on different `PORT`s (each has its own `RUN_DIR`). Never drive an instance you did not launch: if `launch.sh` says the port is in use, pick another port.

Ready means the app root answers; usability is proved by the drive, not by Launch.

## Doctor

```bash
export WORKTREE=/path/to/clean/worktree PORT=5199
/home/snaic-darren/projects/tagstrip/.claude/skills/verify-tagstrip/scripts/doctor.sh
```

Read-only. Checks the recorded pid is alive, owns `$PORT` (`ss -ltnp`), has `/proc/<pid>/cwd` equal to `$WORKTREE`, prints `git rev-parse HEAD` of the worktree (compare with the commit under test), and that `/` returns 200 with `id="root"`. Non-zero exit names the failed check. Run before the first drive and after any surprise.

## Drive

Scripted driver (repeatable, multi-browser, network-blocked):

```bash
export WORKTREE=/path/to/clean/worktree PORT=5199
S=/home/snaic-darren/projects/tagstrip/.claude/skills/verify-tagstrip/scripts
source $S/env.sh
NODE_PATH=$RUN_DIR/pw/node_modules node $S/drive.mjs --browser chromium --url http://127.0.0.1:$PORT/ \
  --journey suggest-text-ocr --evidence "$EVIDENCE_DIR" --check-id "$CHECK_ID" [--block-offsite]
```

`--browser` is `chromium|firefox|webkit`. Exit 0 only if the journey's own assertion passed; the JSON summary is printed to stdout. Journeys implemented: `ocr-harness` (below and in `features/ocr-harness.md`) and `suggest-text-ocr` (empty browser, create schema with one label, create project, upload a generated PNG of "TAGSTRIP 2026", draw a region, press Suggest text, assert normalised transcription equals `tagstrip2026`). `ocr-harness` drives the dev-only OCR harness page (`/harness/ocr.html`) with `--engine tesseract|indra`, `--set synthetic|eval`, `--eval-export <file>`, `--eval-docs <dir>`, `--runs N`; it needs the Indra weights fetched first (`scripts/fetch-indra-models.sh` in the checkout under test, which puts them in the gitignored `indra-models/`) and records verdicts and timings only. See `features/ocr-harness.md`. `--block-offsite` aborts every http(s) request whose origin is not the app's and lists them in `<evidence>/<check-id>-blocked.txt` (empty means nothing left the origin). Other features have no scripted journey yet: drive them with the verifier's Playwright MCP (Chromium) using the handles in `features/<feature>.md`.

Handles are accessible names, labels and roles from the source; see `features/`.

## Evidence

Evidence goes to the folder the verifier's brief names, as `<check-id>-<slug>.<ext>` (`adhoc` outside a ticket), plus `before.txt` and `after.txt` state snapshots where a check needs them. The driver writes, per run:

- `<check-id>-<journey>-<browser>.png`: screenshot at the decision point (after Suggest text filled, or where the journey stopped on failure).
- `<check-id>-<journey>-<browser>.json`: `passed`, `match`, `ocrMs`, `ocrBadgeShown`, counts, timings, `blockedCount`, and on failure a one-line `error`. Never document text.
- `ocr-harness` writes `<check-id>-ocr-harness-<engine>-<set>-<browser>.json` instead (per-run summaries and per-region id, verdict, ms) and a `.png` only for `--set synthetic`.
- `<check-id>-blocked.txt`: only with `--block-offsite`; one file per check id, so use a different `--check-id` per browser if you need them separately.

Side effect to capture for stored-state checks: the row in IndexedDB is observable through the UI (region count in "Regions on this page", the OCR tag, the transcription field). Use the real UI path; there is no test-only entry point. With real data, see "Real data" in `features/README.md`: no extracted text, no filenames, no screenshots.

Vite logs for the run are in `$RUN_DIR/vite.log` (removed by Cleanup; copy it to evidence first if needed).

## Cleanup

```bash
export WORKTREE=/path/to/clean/worktree PORT=5199
/home/snaic-darren/projects/tagstrip/.claude/skills/verify-tagstrip/scripts/cleanup.sh
```

Stops the recorded pid; if that is stale or missing, finds the process owning `$PORT`, confirms its `/proc` cwd or cmdline is under `$WORKTREE`, and stops only that one. Then prints and removes `/tmp/verify-tagstrip-$PORT` (pid file, logs, scratch Playwright). It never touches evidence (which lives under `.proofline/verification/`, gitignored) and works after a failed launch. Afterwards confirm the port is free (`ss -ltn "sport = :$PORT"`). Remove the worktree yourself (`git worktree remove --force <path>`); it is not the skill's to delete.
