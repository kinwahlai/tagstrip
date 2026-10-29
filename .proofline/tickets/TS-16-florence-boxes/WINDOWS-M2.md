# TS-16 M2: prompt for the Windows (WSL) machine

Paste the block below into a new Claude Code session in the tagstrip checkout on the WSL machine.

---

Run TS-16 M2 for tagstrip: the real-set test of PP-OCRv6 boxes with browser LFM values.

1. Use the proofline-mode skill first. Then `git fetch && git switch TS-16-florence-boxes && git
   pull`. Read in full: `.proofline/tickets/TS-16-florence-boxes/TICKET.md` (design, decision
   rule, "M1 results", "M2 decided") and `CHECKS.md` (M2-1, M2-2).
2. **Stop and get my agreement on the M2 checks** before any run. Record the date in CHECKS.md.
3. Setup: `pnpm install --frozen-lockfile`, then `scripts/fetch-ppocr.sh` and
   `scripts/fetch-lfm-vl.sh` (Florence-2 is not needed). Models go to the gitignored
   `predict-models/`.
4. **Hardware WebGPU first, before any real document is opened.** WSL Chromium only sees
   SwiftShader (TS-12 M1 findings). Find a route to a Windows-side browser that reports the RTX
   4070 (for example: the Vite dev server in WSL, driven from Windows-side Playwright, or
   Windows Chrome with remote debugging reached from WSL). Prove it on the synthetic set
   (`--set synthetic --line-model ppocr`) and check the adapter is not a fallback. Headless or a
   browser driven only through Playwright; no keystrokes into my desktop. At most 3 attempts per
   route, 60 minutes in all for this step. If none works, stop and tell me the exact errors; do
   not run on SwiftShader.
5. Commit any harness or skill change needed for that route on the branch, green first (lint,
   build, test). Run M2-1 with `ledger.py run`.
6. Make the M2-2 mutant (Broken by line) on a local `mutant/TS-16-florence-boxes/M2-2` branch.
   Spawn the verifier subagent with the proofline verifier brief: base SHA, mutant SHA, M2-2, the
   method files, and the real set:
   `~/projects/pai-extract/.proofline/ground-truth/pai-extract-marriage-cert-v2-tagstrip-annotations-only.json`
   plus `~/projects/pai-extract/samples/sharepoint/Marriage Cert/`. The verifier runs the real
   set; builders do not open it.
7. Real data rules: evidence and anything committed hold counts, ids, verdicts, IoUs and times
   only. No values, no filenames, no screenshots of real pages.
8. When it passes and counts, run `ledger.py check --rerun` on M2-1 and M2-2. Delete the mutant
   branch. Add a "M2 results" section to TICKET.md in the same shape as "M1 results" (counts and
   verdicts only), commit and push the branch. Then stop: M2 is a checkpoint. Tell me the arm B
   verdict, PP-OCRv6 against Tesseract, and the share of wrong values.

Budget: 3 fix attempts per failing check, 3 hours in all. Stop every server and browser you
start, and leave no background command running.
