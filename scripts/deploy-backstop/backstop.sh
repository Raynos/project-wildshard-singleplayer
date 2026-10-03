#!/usr/bin/env bash
# The local backstop for the hourly production deploy (E403). deploy.yml asks GitHub for a run at :17 every hour, but
# GitHub drops scheduled runs under load without an error (2026-10-02/03: one every 4-6 h). launchd runs this at :47
# every second hour (install.sh): when no scheduled deploy run started in the last 119 minutes, it dispatches one.
# The deploy job itself skips when production already serves the newest CI-green main, so a spare dispatch is harmless.
#   backstop.sh [--dry-run]     the log: ~/.wildshard/deploy-backstop/backstop.log
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$HOME/.wildshard/deploy-backstop"
WINDOW_MIN=119
DRY=0; [[ "${1:-}" == "--dry-run" ]] && DRY=1
mkdir -p "$LOG_DIR"
log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG_DIR/backstop.log"; }
cd "$ROOT"

since="$(date -u -v-"${WINDOW_MIN}"M +%Y-%m-%dT%H:%M:%SZ)"
last="$(gh run list --workflow deploy --event schedule --limit 1 --json createdAt --jq '.[0].createdAt // ""')"
# ISO-8601 UTC stamps compare as strings
if [[ -n "$last" && ! "$last" < "$since" ]]; then
  log "ok: the :17 schedule ran at $last (within ${WINDOW_MIN} min); nothing to do"
  exit 0
fi
if [[ "$DRY" == 1 ]]; then
  log "dry run: no scheduled deploy since $since (last: ${last:-none}); would dispatch"
  exit 0
fi
# a dispatch sometimes answers HTTP 500 and works on a retry
for attempt in 1 2 3; do
  if gh workflow run deploy; then
    log "dispatched: no scheduled deploy since $since (last: ${last:-none})"
    exit 0
  fi
  log "dispatch attempt $attempt failed"
  [[ "$attempt" -lt 3 ]] && sleep 60
done
log "FAILED: could not dispatch the deploy after 3 attempts"
exit 1
