#!/usr/bin/env bash
# The local backstop for the hourly production deploy (E403). deploy.yml asks GitHub for a run at :17 every hour, but
# GitHub drops scheduled runs under load without an error (2026-10-02/03: one every 4-6 h). launchd runs this at :47
# every second hour (install.sh): when no scheduled deploy run started in the last 119 minutes, it dispatches one.
# The shared release-slot guard also refuses a recent dispatch or any queued/running release.
#   backstop.sh [--dry-run]     the log: ~/.wildshard/deploy-backstop/backstop.log
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="${WS_DEPLOY_BACKSTOP_LOG_DIR:-$HOME/.wildshard/deploy-backstop}"
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
slot_file="$(mktemp "$LOG_DIR/release-slot.XXXXXX")"
ready_file=""
trap 'rm -f "$slot_file" "$ready_file"' EXIT
ready_file="$(mktemp "$LOG_DIR/release-ready.XXXXXX")"
ready_pattern=$'^ready=(true|false)\nsha=([0-9a-f]{40})$'
# a dispatch sometimes answers HTTP 500 and works on a retry
for attempt in 1 2 3; do
  # Recheck before retries: an HTTP error may have followed a successful dispatch.
  : > "$slot_file"
  if ! GITHUB_OUTPUT="$slot_file" node scripts/deploy-pin.mjs release-slot; then
    log "FAILED: cannot prove the shared hourly release slot is free"
    exit 1
  fi
  slot="$(cat "$slot_file")"
  if [[ "$slot" == "free=false" ]]; then
    log "ok: shared hourly release slot is taken; nothing to do"
    exit 0
  fi
  if [[ "$slot" != "free=true" ]]; then
    log "FAILED: unreadable shared release-slot proof"
    exit 1
  fi
  : > "$ready_file"
  if ! GITHUB_OUTPUT="$ready_file" node scripts/deploy-pin.mjs release-ready; then
    log "FAILED: cannot prove newest candidate readiness"
    exit 1
  fi
  readiness="$(cat "$ready_file")"
  if [[ ! "$readiness" =~ $ready_pattern ]]; then
    log "FAILED: unreadable candidate-readiness proof"
    exit 1
  fi
  if [[ "${BASH_REMATCH[1]}" == false ]]; then
    log "ok: newer candidate ${BASH_REMATCH[2]} awaits exact-SHA smoke; leaving the hour free"
    exit 0
  fi
  if [[ "$DRY" == 1 ]]; then
    log "dry run: no scheduled deploy since $since (last: ${last:-none}); slot free; would dispatch"
    exit 0
  fi
  if gh workflow run deploy; then
    log "dispatched: no scheduled deploy since $since (last: ${last:-none})"
    exit 0
  fi
  log "dispatch attempt $attempt failed"
  [[ "$attempt" -lt 3 ]] && sleep 60
done
log "FAILED: could not dispatch the deploy after 3 attempts"
exit 1
