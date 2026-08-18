# Contributing to TagStrip

Thanks for your interest in contributing! TagStrip is a small, focused tool — see `SPEC.md`
section 2 for what's explicitly in and out of scope before proposing a large feature.

## Development setup

```bash
npm install
npm run dev
```

## Before opening a PR

```bash
npm run lint
npm run build
npm test
```

All three must pass. Run `npm run format` if Prettier flags formatting issues.

## Project structure

- `src/db/` — Dexie (IndexedDB) schema and typed data-access functions
- `src/components/` — UI components
- `src/lib/` — PDF rendering, import/export, geometry helpers
- `src/state/` — app-level state
- `SPEC.md` — full product spec and milestone plan
- `VERIFICATION.md` — acceptance rubric used to verify each milestone

## Scope

Please read `SPEC.md` section 2 before proposing new annotation types (e.g. polygons),
classification features, or backend/multi-user functionality — these are explicitly out of scope
for v1.

## Reporting issues

Open a GitHub issue with steps to reproduce, expected vs. actual behavior, and your browser
version.
