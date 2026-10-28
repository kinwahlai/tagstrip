#!/usr/bin/env bash
# Stop this run's Vite and remove $RUN_DIR. Never touches evidence. Safe after a failed launch.
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
stop() { kill "$1" 2>/dev/null; for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$1" 2>/dev/null || return 0; sleep 0.5; done; kill -9 "$1" 2>/dev/null; }
pid=""
[ -s "$RUN_DIR/vite.pid" ] && pid="$(cat "$RUN_DIR/vite.pid")"
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
  stop "$pid"; echo "cleanup: stopped recorded pid $pid"
else
  owner="$(port_owner)"
  if [ -n "$owner" ]; then
    : "${WORKTREE:?set WORKTREE so the port owner can be confirmed as ours}"
    wt="$(cd "$WORKTREE" && pwd -P)"
    cwd="$(pid_cwd "$owner")"; cmd="$(pid_cmd "$owner")"
    case "$cwd $cmd" in
      *"$wt"*) stop "$owner"; echo "cleanup: stopped port owner pid $owner (confirmed under $wt)";;
      *) echo "cleanup: port $PORT is owned by pid $owner which is not under $wt; leaving it alone" >&2;;
    esac
  else
    echo "cleanup: nothing running on port $PORT"
  fi
fi
echo "cleanup: removing $RUN_DIR"
rm -rf /tmp/verify-tagstrip-"$PORT"
