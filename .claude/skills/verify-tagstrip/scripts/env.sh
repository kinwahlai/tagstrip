# Sourced by every block of the verify-tagstrip skill (each block runs in a fresh shell).
# In:  WORKTREE (required for launch/doctor/cleanup), PORT (default 5199).
# Out: PORT, RUN_DIR (pid file, logs, scratch Playwright install), SKILL_DIR.
PORT="${PORT:-5199}"
RUN_DIR="/tmp/verify-tagstrip-$PORT"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PORT RUN_DIR SKILL_DIR
