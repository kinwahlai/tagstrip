# Sourced by every block of the verify-tagstrip skill (each block runs in a fresh shell).
# In:  WORKTREE (required for launch/doctor/cleanup), PORT (default 5199).
# Out: PORT, RUN_DIR (pid file, logs, scratch Playwright install), SKILL_DIR.
PORT="${PORT:-5199}"
RUN_DIR="/tmp/verify-tagstrip-$PORT"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PORT RUN_DIR SKILL_DIR

# Portable process lookups: Linux (ss, /proc) and macOS (lsof, ps) alike.
port_owner() { # pid listening on $PORT, or empty
  if command -v lsof >/dev/null; then lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -n1
  else ss -ltnp "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | head -n1 | cut -d= -f2; fi
}
pid_cwd() { # working directory of pid $1
  if [ -e "/proc/$1/cwd" ]; then readlink "/proc/$1/cwd"
  else lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n1; fi
}
pid_cmd() { ps -o command= -p "$1" 2>/dev/null; }
