---
name: verify-tagstrip
description: Run and drive TagStrip, a 100% client-side browser UI (Vite + React, data in IndexedDB) for drawing labeled boxes on PDF/image pages. Use when verifying a TagStrip milestone or check by running the app in a real browser (Chromium, Firefox, WebKit), including network-blocked runs.
---

# verify-tagstrip

TagStrip has no backend. The "service" is the Vite dev server serving the app; all state is the browser's IndexedDB. Run it from a clean worktree of the commit under test. Feature map: `features/README.md`.

Every block below sources `scripts/env.sh` (each block runs in a fresh shell). Set `WORKTREE` (the checkout to run) and optionally `PORT` (default 5199). Run paths are relative to the skill folder, `<main checkout>/.claude/skills/verify-tagstrip` (the main checkout's copy is fine for a worktree of another commit). Runs on Linux and macOS: the scripts use `lsof`/`ps` where `ss`, `setsid` and `/proc` are missing.

## Launch

```bash
export WORKTREE=/path/to/clean/worktree PORT=5199
S=<main checkout>/.claude/skills/verify-tagstrip/scripts
$S/launch.sh && $S/pw-install.sh
```

`launch.sh` runs `pnpm install --frozen-lockfile` in `$WORKTREE` (a fresh worktree has no `node_modules`; no `.env` is needed), starts `node node_modules/vite/bin/vite.js --port $PORT --strictPort --host 127.0.0.1` detached, records that node pid in `$RUN_DIR/vite.pid` (`RUN_DIR=/tmp/verify-tagstrip-$PORT`), and waits up to 60 s for HTTP 200 with `id="root"` on `http://127.0.0.1:$PORT/`. On failure it exits non-zero with the log tail. `pw-install.sh` puts playwright 1.62.1 (library only, no download) in `$RUN_DIR/pw`; it matches the browsers already in `~/.cache/ms-playwright` (macOS: `~/Library/Caches/ms-playwright`) (chromium-1234, firefox-1538, webkit-2336). If those are absent the drive fails at browser launch; report that, do not install other versions.

Empty data directory: every drive run starts a fresh browser context (WebKit: a fresh temp profile), so IndexedDB is empty and the app shows first-run. There is no seed data and no migration step (Dexie creates the schema on open).

Two instances can run side by side on different `PORT`s (each has its own `RUN_DIR`). Never drive an instance you did not launch: if `launch.sh` says the port is in use, pick another port.

Ready means the app root answers; usability is proved by the drive, not by Launch.

## Doctor

```bash
export WORKTREE=/path/to/clean/worktree PORT=5199
$S/doctor.sh
```

Read-only. Checks the recorded pid is alive, owns `$PORT` (`lsof`, or `ss -ltnp`), has a working directory (`/proc` or `lsof`) equal to `$WORKTREE`, prints `git rev-parse HEAD` of the worktree (compare with the commit under test), and that `/` returns 200 with `id="root"`. Non-zero exit names the failed check. Run before the first drive and after any surprise.

## Drive

Scripted driver (repeatable, multi-browser, network-blocked):

```bash
export WORKTREE=/path/to/clean/worktree PORT=5199
S=<main checkout>/.claude/skills/verify-tagstrip/scripts
source $S/env.sh
NODE_PATH=$RUN_DIR/pw/node_modules node $S/drive.mjs --browser chromium --url http://127.0.0.1:$PORT/ \
  --journey suggest-text-ocr --evidence "$EVIDENCE_DIR" --check-id "$CHECK_ID" [--block-offsite]
```

`--browser` is `chromium|firefox|webkit`. Exit 0 only if the journey's own assertion passed; the JSON summary is printed to stdout. Journeys implemented: `ocr-harness` (below and in `features/ocr-harness.md`), `predict-harness` (see below) and `suggest-text-ocr` (empty browser, create schema with one label, create project, upload a generated PNG of "TAGSTRIP 2026", draw a region, press Suggest text, assert normalised transcription equals `tagstrip2026`). `ocr-harness` drives the dev-only OCR harness page (`/harness/ocr.html`) with `--engine tesseract`, `--set synthetic|eval`, `--eval-export <file>`, `--eval-docs <dir>`, `--runs N`; it records verdicts and timings only. See `features/ocr-harness.md`. `--block-offsite` aborts every http(s) request whose origin is not the app's and lists them in `<evidence>/<check-id>-blocked.txt` (empty means nothing left the origin). Other features have no scripted journey yet: drive them with the verifier's Playwright MCP (Chromium) using the handles in `features/<feature>.md`.

### predict-harness (TS-12, TS-16)

`predict-harness` drives the dev-only `/harness/predict.html` with `--set synthetic|eval`, `--eval-export`, `--eval-docs` (recursive, duplicate basenames refused, counts-only errors), `--arm all|A|B|C|T`, `--line-model all|florence|ppocr`, `--runs N`, `--predictions model|truth|shifted` (the last two replace the line models and LFM output with the ground truth, arms A and B only, for the scorer check, no GPU needed) and `--headed`. Details and handles are in `features/predict-harness.md`. Three things to know before running it:

- Precondition: `scripts/fetch-lfm-vl.sh`, `scripts/fetch-florence.sh` and `scripts/fetch-ppocr.sh` run once in the checkout (about 680 MB into the gitignored `predict-models/`, including the ONNX Runtime WASM). A fresh worktree has none; run the script there or symlink the main checkout's folder. Nothing may be fetched from the network at run time.
- Adapter caveat: the driver launches Chromium with `--enable-unsafe-webgpu --use-angle=metal --ignore-gpu-blocklist` on macOS (`--enable-features=Vulkan` instead elsewhere; env `WEBGPU_ARGS` overrides). The evidence JSON records the adapter. A software adapter (`isFallbackAdapter: true`, SwiftShader) cannot run the q4f16 model (no shader f16), so the run ends in error; the verifier never uses `--headed`; report the adapter either way. Never report a SwiftShader result as a WebGPU pass.
- WSL2 (the Windows machine, RTX 4070): WSL's own Chromium only gets SwiftShader, so drive a headless Windows Chrome instead. `$S/win-chrome.sh start` (after `launch.sh`, same `PORT`) starts it on a throwaway profile with `--force_high_performance_gpu` (without it Chrome picked the Intel iGPU) plus `win-cdp-relay.mjs` (WSL in NAT mode cannot reach Windows' 127.0.0.1, so a PowerShell pump connects out from Windows), and prints a `ws://` endpoint; pass it as `drive.mjs --cdp <ws>` with `--browser chromium`. Expect adapter `nvidia`/`lovelace`, `isFallbackAdapter: false`. `$S/win-chrome.sh stop` before `cleanup.sh`. Files reach that browser as data, which Playwright allows up to 50 MB per `setInputFiles`.
- Real data: the eval set (`~/projects/pai-extract/...`) is run by the verifier only. Evidence holds counts, ids, verdicts, IoUs and times; no values, no filenames, no screenshots.

Handles are accessible names, labels and roles from the source; see `features/`.

## Evidence

Evidence goes to the folder the verifier's brief names, as `<check-id>-<slug>.<ext>` (`adhoc` outside a ticket), plus `before.txt` and `after.txt` state snapshots where a check needs them. The driver writes, per run:

- `<check-id>-<journey>-<browser>.png`: screenshot at the decision point (after Suggest text filled, or where the journey stopped on failure).
- `<check-id>-<journey>-<browser>.json`: `passed`, `match`, `ocrMs`, `ocrBadgeShown`, counts, timings, `blockedCount`, and on failure a one-line `error`. Never document text.
- `ocr-harness` writes `<check-id>-ocr-harness-<engine>-<set>-<browser>.json` instead (per-run summaries and per-region id, verdict, ms) and a `.png` only for `--set synthetic`.
- `predict-harness` writes `<check-id>-predict-harness-<set>-chromium.json` (per-run summaries, per-page `ms`, per-field id, box verdict, IoU, value verdict, and the WebGPU `adapter`) and a `.png` only for `--set synthetic`.
- `<check-id>-blocked.txt`: only with `--block-offsite`; one file per check id, so use a different `--check-id` per browser if you need them separately.

Side effect to capture for stored-state checks: the row in IndexedDB is observable through the UI (region count in "Regions on this page", the OCR tag, the transcription field). Use the real UI path; there is no test-only entry point. With real data, see "Real data" in `features/README.md`: no extracted text, no filenames, no screenshots.

Vite logs for the run are in `$RUN_DIR/vite.log` (removed by Cleanup; copy it to evidence first if needed).

## Cleanup

```bash
export WORKTREE=/path/to/clean/worktree PORT=5199
$S/cleanup.sh
```

Stops the recorded pid; if that is stale or missing, finds the process owning `$PORT`, confirms its cwd or command line is under `$WORKTREE`, and stops only that one. Then prints and removes `/tmp/verify-tagstrip-$PORT` (pid file, logs, scratch Playwright). It never touches evidence (which lives under `.proofline/verification/`, gitignored) and works after a failed launch. Afterwards confirm the port is free (`lsof -iTCP:$PORT -sTCP:LISTEN` prints nothing). Remove the worktree yourself (`git worktree remove --force <path>`); it is not the skill's to delete.
