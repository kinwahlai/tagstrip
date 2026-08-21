# Archivo — self-hosting

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
