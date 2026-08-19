#!/usr/bin/env bash
# Convenience script to run TagStrip locally for manual testing.
# Sources nvm (needed since node/npm aren't on PATH by default in this env),
# installs dependencies if node_modules is missing or stale, then starts the
# Vite dev server.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

source ~/.nvm/nvm.sh

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting dev server — open the printed URL in your browser (Ctrl+C to stop)."
npm run dev
