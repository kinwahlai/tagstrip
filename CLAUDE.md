# TagStrip — Project Instructions

See `SPEC.md` for the full product spec and milestone plan, and `VERIFICATION.md` for the
per-milestone acceptance rubric.

## Working policy: implement → verify → fix, per milestone

Work through the milestones in `SPEC.md` in order (M0, M1, M2, ...). For each milestone:

1. **Implement** it fully before moving on to the next one. Don't start M2 with M1 half-working.
2. **Run the cheap checks yourself**: `pnpm run lint`, `pnpm run build`, `pnpm test`. Fix anything
   these catch before going further — don't hand a broken build to the verifier.
3. **Invoke the `verifier` subagent**, telling it which milestone to check against
   `VERIFICATION.md`. This subagent has its own context and a real browser (Playwright) — it will
   actually run the app rather than reading the code and assuming it works.
4. **If the verifier reports any ✗:** fix the specific issue it described, then invoke it again
   for the same milestone. Repeat up to 3 times total.
5. **If still failing after 3 attempts:** stop. Do not report the milestone as done, and do not
   keep looping. Summarize what's failing and what you tried, and wait for guidance — this is a
   sign the milestone needs a design decision, not another fix attempt.
6. **Only once the verifier reports all ✓** for a milestone: report it as complete, and — per the
   checkpoints called out in `SPEC.md` section 8 — **stop after M1 and after M3 specifically** for
   human review, even if the verifier passed everything. Those two are flagged as worth a second
   set of eyes beyond automated verification: M1 because the schema data model is foundational to
   everything after it, M3 because it's the highest-risk, most-interactive part of the app.

## Ground rules

- Never mark a milestone done based on "the code looks right" — only the verifier's actual
  run-it-and-see report counts.
- The verifier subagent doesn't have `Edit`/`Write` access on purpose. Don't ask it to fix things;
  it reports, you fix.
- Keep `VERIFICATION_REPORT.md` (written by the verifier) and `verification-screenshots/` in the
  repo as you go — don't delete them between milestones. They're the audit trail for a human
  reviewing this later without having watched every step.
- If a milestone's implementation reveals that a rubric item in `VERIFICATION.md` was wrong or
  missing (e.g. an edge case neither of us thought of), update `VERIFICATION.md` to add it, note
  why in the commit message, and continue — don't silently skip a rubric item that no longer
  seems to make sense.
