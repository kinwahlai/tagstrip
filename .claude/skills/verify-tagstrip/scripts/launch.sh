#!/usr/bin/env bash
# Start Vite from $WORKTREE on $PORT. Records the Vite node pid in $RUN_DIR/vite.pid.
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
: "${WORKTREE:?set WORKTREE to the checkout to run}"
mkdir -p "$RUN_DIR"
if [ -s "$RUN_DIR/vite.pid" ] && kill -0 "$(cat "$RUN_DIR/vite.pid")" 2>/dev/null; then
  echo "launch: an instance is already recorded for port $PORT; run cleanup.sh first" >&2; exit 1
fi
if ss -ltn "sport = :$PORT" | grep -q LISTEN; then
  echo "launch: port $PORT is already in use; pick another PORT or run cleanup.sh" >&2; exit 1
fi
cd "$WORKTREE" || exit 1
pnpm install --frozen-lockfile > "$RUN_DIR/install.log" 2>&1 || { tail -n 30 "$RUN_DIR/install.log" >&2; echo "launch: pnpm install failed" >&2; exit 1; }
setsid nohup node node_modules/vite/bin/vite.js --port "$PORT" --strictPort --host 127.0.0.1 \
  > "$RUN_DIR/vite.log" 2>&1 < /dev/null &
echo $! > "$RUN_DIR/vite.pid"
for _ in $(seq 1 60); do
  body="$(curl -s -m 2 -w '\n%{http_code}' "http://127.0.0.1:$PORT/" || true)"
  if [ "$(printf '%s' "$body" | tail -n1)" = 200 ] && printf '%s' "$body" | grep -q 'id="root"'; then
    echo "launch: ready at http://127.0.0.1:$PORT/ (pid $(cat "$RUN_DIR/vite.pid"), worktree $WORKTREE)"; exit 0
  fi
  kill -0 "$(cat "$RUN_DIR/vite.pid")" 2>/dev/null || break
  sleep 1
done
echo "launch: not ready; log tail:" >&2; tail -n 30 "$RUN_DIR/vite.log" >&2; exit 1
