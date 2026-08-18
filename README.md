# TagStrip

A browser-based tool for drawing labeled bounding boxes on document pages (PDFs or images), with
per-box text transcription — built for preparing training/test data for document-understanding
pipelines (KYC field extraction, ID parsing, invoice parsing, etc.).

100% client-side: no backend, no accounts. All data lives in your browser (IndexedDB). No data
leaves the browser.

**Status:** early scaffold, under active development. See `SPEC.md` for the full product spec and
milestone plan.

## Quickstart

```bash
npm install
npm run dev
```

Then open the printed local URL in your browser.

## Scripts

- `npm run dev` — start the local dev server
- `npm run build` — type-check and produce a production build in `dist/`
- `npm run lint` — run ESLint
- `npm run format` — format the codebase with Prettier
- `npm test` — run the test suite (Vitest)

## License

MIT — see `LICENSE`.
