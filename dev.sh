#!/usr/bin/env bash
# Convenience script to run TagStrip locally for manual testing.
# Installs dependencies if node_modules is missing, then starts the Vite dev server.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  pnpm install
fi

echo "Starting dev server — open the printed URL in your browser (Ctrl+C to stop)."
pnpm run dev
