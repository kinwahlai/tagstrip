#!/usr/bin/env bash
# Hardware WebGPU from WSL2 (TS-16 M2): WSL's own Chromium only gets SwiftShader, so drive a
# headless Windows Chrome instead. Starts it on a throwaway profile with the discrete GPU forced
# (without --force_high_performance_gpu it picked the Intel iGPU), plus win-cdp-relay.mjs, and
# prints the CDP endpoint for `drive.mjs --cdp`. Headless only: nothing appears on the desktop.
#   win-chrome.sh start   -> prints ws://127.0.0.1:$CDP_LISTEN/devtools/browser/<id>
#   win-chrome.sh stop    -> stops that Chrome (whole process tree) and the relay
# Needs: WSL2 interop (powershell.exe, taskkill.exe), Chrome at the default Windows path, and the
# app reachable from Windows at the same URL (WSL localhost forwarding does this for 127.0.0.1).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
CDP_WIN_PORT="${CDP_WIN_PORT:-9333}" CDP_LISTEN="${CDP_LISTEN:-9402}" CDP_BACK="${CDP_BACK:-9401}"
CHROME="${WIN_CHROME:-C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe}"
mkdir -p "$RUN_DIR"
# Windows exes complain when started from a WSL path; run them from C:.
ps() { (cd /mnt/c && powershell.exe -NoProfile -NonInteractive -Command "$1" | tr -d '\r'); }

case "${1:-}" in
  start)
    [ -s "$RUN_DIR/win-chrome.pid" ] && { echo "win-chrome: already started (pid $(cat "$RUN_DIR/win-chrome.pid")); stop first" >&2; exit 1; }
    pid="$(ps "\$d=\"\$env:TEMP\\tagstrip-cdp-$CDP_WIN_PORT\"; Remove-Item -Recurse -Force \$d -ErrorAction SilentlyContinue;
      (Start-Process -PassThru -FilePath '$CHROME' -ArgumentList '--headless=new','--remote-debugging-port=$CDP_WIN_PORT',\"--user-data-dir=\$d\",'--no-first-run','--no-default-browser-check','--force_high_performance_gpu','about:blank').Id")"
    echo "$pid" > "$RUN_DIR/win-chrome.pid"
    ws=""
    for _ in $(seq 1 20); do
      ws="$(ps "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:$CDP_WIN_PORT/json/version).Content | ConvertFrom-Json | % webSocketDebuggerUrl } catch {}")"
      [ -n "$ws" ] && break
      sleep 1
    done
    [ -n "$ws" ] || { echo "win-chrome: Chrome (pid $pid) did not open port $CDP_WIN_PORT" >&2; exit 1; }
    node "$(dirname "${BASH_SOURCE[0]}")/win-cdp-relay.mjs" --win-port "$CDP_WIN_PORT" --listen "$CDP_LISTEN" --back "$CDP_BACK" \
      > "$RUN_DIR/win-relay.log" 2>&1 &
    echo $! > "$RUN_DIR/win-relay.pid"
    sleep 1
    echo "${ws/:$CDP_WIN_PORT\//:$CDP_LISTEN/}"
    ;;
  stop)
    if [ -s "$RUN_DIR/win-chrome.pid" ]; then
      (cd /mnt/c && taskkill.exe /T /F /PID "$(cat "$RUN_DIR/win-chrome.pid")" | tr -d '\r' | tail -1) || true
      rm -f "$RUN_DIR/win-chrome.pid"
    fi
    if [ -s "$RUN_DIR/win-relay.pid" ]; then kill "$(cat "$RUN_DIR/win-relay.pid")" 2>/dev/null || true; rm -f "$RUN_DIR/win-relay.pid"; fi
    echo "win-chrome: stopped"
    ;;
  *) echo "usage: win-chrome.sh start|stop" >&2; exit 2 ;;
esac
