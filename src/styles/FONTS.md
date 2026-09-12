# Archivo — self-hosted

**Status: done.** The four woff2 files sit beside `ts-modernist.css` and are
declared there with `font-display: swap`. What follows records why, and what to
do if the set ever needs changing.

## What is here

| File                | Weight | Used by                                                                                                      |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `archivo-400.woff2` | 400    | body text, table cells, captions                                                                             |
| `archivo-600.woff2` | 600    | filenames, names in tables, region names, `.ts-kbd`                                                          |
| `archivo-700.woff2` | 700    | table column headers — `.table th` names no weight, so the UA default bold applies over an inherited Archivo |
| `archivo-800.woff2` | 800    | headings, `.btn`, `.ts-eyebrow`, `.ts-grouphd`, wordmark                                                     |

Latin + latin-ext, no italics — the app contains none. 88KB in total, and Vite
fingerprints each file into `dist/assets/`.

The constraint is no external request. These self-hosted faces are served from
the app's own origin, so they preserve the app's central claim; a request to
`fonts.googleapis.com` would not.

A caution for whoever edits this table next: work out which weights are needed
from the _rendered_ DOM, not by grepping for `fontWeight`. The first version of
this table credited weight 700 to the annotate toolbar's selected label chip.
That chip carries `.mono`, so its 700 bolds the system monospace face and never
touches Archivo — the real consumer was `<th>`, which names no weight at all and
inherits the browser's bold. Both mistakes are invisible to a grep.

Dropping a weight is a false economy: the browser synthesises a missing one by
smearing the 400 outlines, which shows up worst on the 600 filenames that fill
every document list. Unused weights would cost deploy size but not user
bandwidth, since browsers fetch only the faces text actually matches.

## Metric-matched fallback

`ts-modernist.css` also declares four `Archivo Fallback` faces and places that
family directly after `Archivo` in both `--font-heading` and `--font-body`.
They keep headings from changing width or line box when Archivo replaces the
system fallback: the measured unadjusted heading shift was about 2.2% (4.1px).

The faces use `local('Helvetica Neue')`, `local('Arial')`, and
`local('Liberation Sans')` at 400; `local('Helvetica Neue Medium')`,
`local('Arial Bold')`, and `local('Liberation Sans Bold')` at 600; and
`local('Helvetica Neue Bold')`, `local('Arial Bold')`, and
`local('Liberation Sans Bold')` at 700 and 800.

| Weight | Size adjust | Ascent override | Descent override | Line-gap override |
| ------ | ----------- | --------------- | ---------------- | ----------------- |
| 400    | 96.9%       | 90.61%          | 21.67%           | 0%                |
| 600    | 97.3%       | 90.27%          | 21.59%           | 0%                |
| 700    | 97.5%       | 90.06%          | 21.54%           | 0%                |
| 800    | 102.4%      | 85.73%          | 20.51%           | 0%                |

To add or retune a weight, calculate `size-adjust` as the frequency-weighted
average advance width for that Archivo weight divided by the same measure for
its paired fallback face. Use English frequencies for a-z plus space, read
advances from `hmtx` with fontTools, and normalise them by `unitsPerEm`.
Archivo's OS/2 `sTypoAscender` and `sTypoDescender` are 0.878em and 0.210em;
because Archivo sets `USE_TYPO_METRICS`, browsers honour them. Divide each by
that weight's `size-adjust` for the ascent and descent overrides. Its line gap
is zero, so `line-gap-override` is 0%.

The values are tuned to Helvetica Neue, the macOS fallback, and TagStrip is
desktop-only. Residual width error on Arial and the metric-compatible
Liberation Sans is about -1.2% at 400, +3.3% at 600, and 0.0% at 700 and 800.
Each is closer than an unadjusted fallback on both families.

`src/styles/fontFallback.test.ts` asserts these literal values. Retune the
whole set with that test when changing any one number.

## Licence

Archivo is SIL Open Font License 1.1 (Omnibus-Type). The licence text is in
`OFL.txt` beside these files, and `README.md` names the font alongside the
project's own MIT licence.

OFL permits bundling and redistribution freely, but only if the copyright notice
and licence travel with the font files. This repository is distributed, so that
clause is live: if you move these `.woff2` files somewhere else, `OFL.txt` goes
with them. google-webfonts-helper does not ship it, so it was fetched separately
from https://github.com/Omnibus-Type/Archivo.
