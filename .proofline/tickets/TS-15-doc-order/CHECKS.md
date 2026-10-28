# tagstrip checks (ticket TS-15-doc-order)

Agreed with the human on: 2026-10-28

The verifier follows `fail-closed`, `run-it-dont-read-it`, `leave-it-as-you-found-it`,
`the-verifier-is-independent` and `evidence-holds-no-values` in full.
Output must be right, not merely present: also `presence-is-not-correctness`.

## Checks: M1

### M1-1: sort rule (command check)

- Run: `pnpm vitest run src/lib/docOrder.test.ts`
- Observable outcome: passes. Covers natural order (`p1, p2, p10`), case-insensitive, same
  filename ordered by `createdAt` then `id`.
- Broken by: comparing filenames with plain `<` (gives `p1, p10, p2`).

### M1-2: native import keeps export order (command check)

- Run: `pnpm vitest run src/lib/nativeImport.test.ts`
- Observable outcome: passes, including a test that imports 8 docs with identical filenames
  except a suffix, 3 times, and reads them back in export order every time.
- Broken by: reverting `createdAt` to the same `now` for every doc.

### M1-3: same order before and after reload, everywhere (verifier check)

- Action: in Chromium via the verify skill, fresh profile. Upload `p10.png`, `p2.png`, `P1.png`
  in that order. Read the project list. Reload, read again. Open annotate on the first doc; step
  with `]` to the end and note the order. Import a native export of the project; read its list.
- Observable outcome: every read gives P1, p2, p10, identical before and after reload, in the
  rail and with `]`, and in the imported project.
- Broken by: removing the shared sort from the annotate rail query only (`App.tsx`).

### M1-4: lint, build, full test suite (command check)

- Run: `pnpm run lint && pnpm run build && pnpm test`
- Observable outcome: all three exit 0.
- Broken by: any type error in the new sort module.
