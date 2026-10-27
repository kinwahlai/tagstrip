#!/usr/bin/env bash
# Scratch Playwright (library only) in $RUN_DIR/pw. Browsers come from ~/.cache/ms-playwright
# (chromium-1234, firefox-1538, webkit-2336), which match playwright 1.62.1. Idempotent.
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
mkdir -p "$RUN_DIR/pw"
if [ -f "$RUN_DIR/pw/node_modules/playwright/package.json" ] && grep -q '"version": "1.62.1"' "$RUN_DIR/pw/node_modules/playwright/package.json"; then
  echo "pw-install: playwright 1.62.1 already present"; exit 0
fi
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefix "$RUN_DIR/pw" playwright@1.62.1 --no-audit --no-fund
