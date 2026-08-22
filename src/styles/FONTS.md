# Archivo — self-hosted

**Status: done.** The four woff2 files sit beside `ts-modernist.css` and are
declared there. What follows records why, and what to do if the set ever needs
changing.

## What is here

| File                | Weight | Used by                                                                                                      |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `archivo-400.woff2` | 400    | body text, table cells, captions                                                                             |
| `archivo-600.woff2` | 600    | filenames, names in tables, region names, `.ts-kbd`                                                          |
| `archivo-700.woff2` | 700    | table column headers — `.table th` names no weight, so the UA default bold applies over an inherited Archivo |
| `archivo-800.woff2` | 800    | headings, `.btn`, `.ts-eyebrow`, `.ts-grouphd`, wordmark                                                     |

Latin + latin-ext, no italics — the app contains none. 88KB in total, and Vite
fingerprints each file into `dist/assets/`.

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

## Licence

Archivo is SIL Open Font License 1.1 (Omnibus-Type). The licence text is in
`OFL.txt` beside these files, and `README.md` names the font alongside the
project's own MIT licence.

OFL permits bundling and redistribution freely, but only if the copyright notice
and licence travel with the font files. This repository is distributed, so that
clause is live: if you move these `.woff2` files somewhere else, `OFL.txt` goes
with them. google-webfonts-helper does not ship it, so it was fetched separately
from https://github.com/Omnibus-Type/Archivo.

---

# Original notes — self-hosting

The Modernist stylesheet upstream begins with an `@import` that pulls Archivo
from the Google Fonts CDN. That is removed in `ts-modernist.css`, because a
third-party request on this page would falsify the page's own central claim.

`"Archivo"` is still first in `--font-heading` / `--font-body`, so the real
typeface appears the moment the files exist. Until then a local grotesque
resolves and nothing is fetched.

## Why self-hosting is allowed here

The constraint is no **external** requests. A self-hosted font ships inside the
app and is served from your own origin, exactly like the JS bundle — the page
still makes zero third-party calls, and a viewer with the network unplugged
still gets Archivo. The forbidden thing was specifically the request to
`fonts.googleapis.com` on every load.

Latin subset is roughly 20–40KB. Archivo is OFL (Omnibus-Type), so bundling it
is permitted.

## Getting the files

Google Fonts, "Download family" — or `github.com/Omnibus-Type/Archivo`.
Put the woff2 beside `ts-modernist.css`.

## What to paste into ts-modernist.css

Replace the "Self-hosted Archivo" comment near the top with ONE of these.

### A. One variable file, covers 400–800

    @font-face {
      font-family: "Archivo";
      src: url("archivo-latin-var.woff2") format("woff2-variations");
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }

### B. Three static weights

    @font-face { font-family: "Archivo"; src: url("archivo-400.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
    @font-face { font-family: "Archivo"; src: url("archivo-600.woff2") format("woff2"); font-weight: 600; font-style: normal; font-display: swap; }
    @font-face { font-family: "Archivo"; src: url("archivo-800.woff2") format("woff2"); font-weight: 800; font-style: normal; font-display: swap; }

The weights are the three the system actually uses: 400 body, 600 semibold
rows, 800 headings and button labels.
