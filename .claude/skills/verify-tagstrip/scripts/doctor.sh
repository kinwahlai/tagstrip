#!/usr/bin/env bash
# Read-only: is the instance on $PORT alive, ours, and serving the app?
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
: "${WORKTREE:?set WORKTREE}"
fail() { echo "doctor: FAIL - $*" >&2; exit 1; }
[ -s "$RUN_DIR/vite.pid" ] || fail "no pid file at $RUN_DIR/vite.pid (not launched?)"
pid="$(cat "$RUN_DIR/vite.pid")"
kill -0 "$pid" 2>/dev/null || fail "pid $pid is not alive"
[ "$(port_owner)" = "$pid" ] || fail "pid $pid does not own port $PORT"
cwd="$(pid_cwd "$pid")"
[ "$cwd" = "$(cd "$WORKTREE" && pwd -P)" ] || fail "pid $pid cwd is $cwd, expected $WORKTREE"
echo "doctor: commit $(git -C "$WORKTREE" rev-parse HEAD)"
out="$(curl -s -m 5 -w '\n%{http_code}' "http://127.0.0.1:$PORT/")" || fail "curl to root failed"
[ "$(printf '%s' "$out" | tail -n1)" = 200 ] || fail "root did not return 200"
printf '%s' "$out" | grep -q 'id="root"' || fail "root body lacks id=\"root\""
echo "doctor: OK pid=$pid port=$PORT cwd=$cwd"
