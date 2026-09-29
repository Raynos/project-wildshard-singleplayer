#!/usr/bin/env bash
# browser-lane.sh — the machine-wide lane for headless game browsers (E312, Jake 2026-09-29).
#
# Every agent on this Mac (every repo: wildshard, rockhop, trials-gauntlet …) shares one box. Each open game tab costs
# ~1.5 cores and ~1 GB, and memory competes with the local-model jobs (they wait for anon memory < 70 GB). Before this
# script the "at most 3 browsers" rule was advice only; on 2026-09-29 there were 6–7 open and 25 load on 18 cores.
#
#   scripts/browser-lane.sh [--max <min>] <cmd …>   run <cmd> holding one lane slot; waits for a free one; the slot is
#                                                   released when <cmd> exits (crash included — it's a lockf lock).
#                                                   --max: <cmd> is killed after this many minutes (default 60)
#   scripts/browser-lane.sh status                  slots held, open browsers, which are outside the lane
#   scripts/browser-lane.sh wait                    block until the lane has room (before `agent-browser open`)
#   scripts/browser-lane.sh free                    exit 0 if the lane has room now, 1 if not (the hook asks this)
#   scripts/browser-lane.sh reap [--dry-run]        kill zombie browsers (see below) and stale scratch dev servers
#
# Lane size: BROWSER_LANES (default 3). A slot counts as used when a lane run holds it OR a browser is open outside any
# lane run (agent-browser sessions, a script run without this wrapper), so the cap holds whoever opened what.
#
# Reaping (runs before every wait, from the Stop / SessionStart hooks, and by hand):
#   - a headless Chromium (Playwright's chrome-headless-shell / chromium, agent-browser's Chrome) whose parent died
#     (re-parented to launchd, ppid 1): nothing can ever close it;
#   - any of them older than BROWSER_MAX_AGE_MIN (default 90) — no capture runs that long;
#   - vite servers (E317 — nobody runs `vite` dev any more; scripts/serve-build.sh builds + previews): a registered
#     preview past its expiry, an unregistered preview older than PREVIEW_MAX_AGE_H (default 6), a dev server older than
#     DEV_MAX_AGE_H (default 2); and served build dirs nothing serves any more;
#   - iOS Simulators, through scripts/sim-lane.sh reap (E316).
# The user's own desktop Chrome is never matched (only the ms-playwright / agent-browser binaries are).
# Log: ~/.browser-lane/reap.log.

set -uo pipefail

LANES="${BROWSER_LANES:-3}"
DIR="$HOME/.browser-lane"
mkdir -p "$DIR"
MAX_AGE_MIN="${BROWSER_MAX_AGE_MIN:-90}"
PREVIEW_MAX_AGE_H="${PREVIEW_MAX_AGE_H:-6}"
DEV_MAX_AGE_H="${DEV_MAX_AGE_H:-2}"
BROWSER_RE='/(ms-playwright|\.agent-browser/browsers)/[^ ]*(chrome-headless-shell|Chromium|Google Chrome for Testing|chrome)( |$)'
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

# seconds since a process started (ps etime: [[dd-]hh:]mm:ss)
age_s() {
  local e; e="$(ps -o etime= -p "$1" 2>/dev/null | tr -d ' ')"; [ -z "$e" ] && { echo 0; return; }
  local d=0 h=0 m=0 s=0
  if [[ "$e" == *-* ]]; then d="${e%%-*}"; e="${e#*-}"; fi
  IFS=: read -r -a p <<<"$e"
  case "${#p[@]}" in 3) h=${p[0]}; m=${p[1]}; s=${p[2]};; 2) m=${p[0]}; s=${p[1]};; *) s=${p[0]};; esac
  echo $(( 10#$d * 86400 + 10#$h * 3600 + 10#$m * 60 + 10#$s ))
}

# the root process of every open headless browser (not its --type= helpers): "pid ppid"
browser_roots() {
  ps -Ao pid=,ppid=,command= | grep -E "$BROWSER_RE" | grep -v -- '--type=' | grep -v grep | awk '{print $1, $2}'
}

# is pid a descendant of a lane run? (its ancestry holds a `browser-lane.sh _slot N` shell)
in_lane() {
  local p="$1" n=0 c
  while [ "$p" -gt 1 ] && [ $n -lt 40 ]; do
    c="$(ps -o command= -p "$p" 2>/dev/null)"
    [[ "$c" == *browser-lane.sh\ _slot\ * ]] && return 0
    p="$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')"; [ -z "$p" ] && return 1
    n=$((n + 1))
  done
  return 1
}

# lane runs in progress: distinct slot numbers of the `_slot` shells (a shell's subshells repeat its command line)
held_slots() { ps -Ao command= | grep -E 'browser-lane\.sh _slot [0-9]+ ' | grep -v -E '^(lockf|grep)' | grep -oE '_slot [0-9]+' | sort -u | wc -l | tr -d ' '; }
outside_lane() { local n=0; while read -r pid _; do [ -z "$pid" ] && continue; in_lane "$pid" || n=$((n + 1)); done < <(browser_roots); echo "$n"; }
used() { echo $(( $(held_slots) + $(outside_lane) )); }

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$DIR/reap.log"; }

kill_tree() {
  local pid="$1" kids
  kids="$(pgrep -P "$pid" 2>/dev/null)"
  kill -TERM "$pid" $kids 2>/dev/null
  sleep 2
  kill -KILL "$pid" $kids 2>/dev/null
  return 0
}

reap() {
  local dry="${1:-}" n=0 pid ppid a why cwd
  while read -r pid ppid; do
    [ -z "$pid" ] && continue
    a="$(age_s "$pid")"; why=""
    if [ "$ppid" = "1" ]; then why="orphaned (parent gone)"
    elif [ "$a" -gt $((MAX_AGE_MIN * 60)) ]; then why="older than ${MAX_AGE_MIN} min"; fi
    [ -z "$why" ] && continue
    n=$((n + 1))
    if [ "$dry" = "--dry-run" ]; then echo "would reap browser $pid ($why, $((a / 60)) min)"; continue; fi
    log "reap browser $pid: $why, $((a / 60)) min, $(ps -o command= -p "$pid" | cut -c1-120)"
    echo "reaped browser $pid ($why)"
    kill_tree "$pid"
  done < <(browser_roots)
  # vite servers (E317: no dev servers — scripts/serve-build.sh builds and previews). Registered previews
  # (~/.dev-servers/<port>: "pid expiry dir cwd name") live until their expiry; an unregistered preview for
  # PREVIEW_MAX_AGE_H; a dev server (`vite` with neither build nor preview) for DEV_MAX_AGE_H. `vite build` is left alone.
  local reg="$HOME/.dev-servers" f rpid exp dir rcwd name
  for f in "$reg"/*; do
    [ -f "$f" ] || continue
    read -r rpid exp dir rcwd name < "$f"
    if ! kill -0 "$rpid" 2>/dev/null; then [ "$dry" = "--dry-run" ] || { rm -f "$f"; [ -d "$dir" ] && rm -rf "$dir"; }; continue; fi
    [ "$exp" -lt "$(date +%s)" ] || continue
    n=$((n + 1))
    if [ "$dry" = "--dry-run" ]; then echo "would reap preview :$(basename "$f") ($name, expired)"; continue; fi
    log "reap preview :$(basename "$f") pid $rpid ($name): expired"; echo "reaped preview :$(basename "$f") ($name, expired)"
    kill_tree "$rpid"; rm -f "$f"; [ -d "$dir" ] && rm -rf "$dir"
  done
  while read -r pid; do
    [ -z "$pid" ] && continue
    c="$(ps -o command= -p "$pid" 2>/dev/null)"
    [[ "$c" == *" build"* ]] && continue
    grep -qs "^$pid " "$reg"/* && continue
    a="$(age_s "$pid")"
    if [[ "$c" == *" preview"* ]]; then kind="preview"; lim=$((PREVIEW_MAX_AGE_H * 3600)); else kind="dev server"; lim=$((DEV_MAX_AGE_H * 3600)); fi
    [ "$a" -gt "$lim" ] || continue
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    n=$((n + 1))
    if [ "$dry" = "--dry-run" ]; then echo "would reap vite $kind $pid ($((a / 3600)) h, $cwd)"; continue; fi
    log "reap vite $kind $pid: $((a / 3600)) h old, cwd $cwd"
    echo "reaped vite $kind $pid ($((a / 3600)) h, $cwd)"
    kill_tree "$pid"
  done < <(pgrep -f 'vite/bin/vite\.js' 2>/dev/null)
  # served build dirs nothing serves any more (a preview killed by hand), a day on
  find "${SERVE_BUILD_DIR:-/private/tmp/wildshard-serve}" -mindepth 1 -maxdepth 1 -type d -mtime +0 2>/dev/null | while read -r d; do
    grep -qs " $d " "$reg"/* || { [ "$dry" = "--dry-run" ] && echo "would remove $d" || rm -rf "$d"; }
  done
  [ "$dry" = "--dry-run" ] && [ $n -eq 0 ] && echo "no browser or vite server to reap"
  # iOS Simulators (E316)
  [ -x "$(dirname "$SELF")/sim-lane.sh" ] && bash "$(dirname "$SELF")/sim-lane.sh" reap "$dry"
  return 0
}

status() {
  echo "lane: $(used) / $LANES used ($(held_slots) lane runs, $(outside_lane) browsers outside the lane)"
  while read -r pid ppid; do
    [ -z "$pid" ] && continue
    local tag="outside"; in_lane "$pid" && tag="lane"
    local parent; parent="$(ps -o command= -p "$ppid" 2>/dev/null | cut -c1-70)"
    printf '  browser %-6s %-7s %4s min  parent %s\n' "$pid" "$tag" "$(( $(age_s "$pid") / 60 ))" "${parent:-?}"
  done < <(browser_roots)
}

wait_room() {
  local said=0
  while [ "$(used)" -ge "$LANES" ]; do
    reap >/dev/null
    [ "$(used)" -lt "$LANES" ] && break
    [ $said -eq 0 ] && { echo "browser-lane: all $LANES slots in use, waiting … (scripts/browser-lane.sh status)" >&2; said=1; }
    sleep 10
  done
}

case "${1:-}" in
  status) status; exit 0;;
  reap) reap "${2:-}"; exit 0;;
  free) [ "$(used)" -lt "$LANES" ]; exit $?;;
  wait) wait_room; exit 0;;
  ''|-h|--help) sed -n '2,30p' "$SELF"; exit 0;;
  _slot)
    # the slot's shell, run under lockf holding slot N: re-check the cap (a browser may have opened outside the lane
    # since), then run <cmd> as a child — not exec: this command line is how in_lane() finds the browsers under it —
    # with a hard timeout. Exit 75 without the marker = the cap was full after all; the caller tries again.
    slot="$2"; marker="$3"; max="$4"; shift 4
    [ "$(used)" -le "$LANES" ] || exit 75
    : > "$marker"
    "$@" & child=$!
    ( sleep $((max * 60))
      if kill -0 "$child" 2>/dev/null; then
        echo "browser-lane: killed after ${max} min (--max)" >&2; log "slot $slot: killed $* after ${max} min"
        kill_tree "$child"
      fi ) 2>/dev/null & timer=$!
    trap 'kill_tree "$child"' INT TERM
    wait "$child"; rc=$?
    kill "$timer" 2>/dev/null; pkill -P "$timer" 2>/dev/null
    exit $rc;;
esac

MAX_MIN=60
if [ "${1:-}" = "--max" ]; then MAX_MIN="${2:?--max needs minutes}"; shift 2; fi
[ "${1:-}" = "--" ] && shift
[ $# -gt 0 ] || { echo "usage: browser-lane.sh [--max <min>] <cmd …>" >&2; exit 64; }

said=0
while :; do
  reap >/dev/null
  for i in $(seq 0 $((LANES - 1))); do
    marker="$DIR/got.$$.$i"; rm -f "$marker"
    lockf -t 0 "$DIR/slot-$i.lock" bash "$SELF" _slot "$i" "$marker" "$MAX_MIN" "$@"
    rc=$?
    if [ -e "$marker" ]; then rm -f "$marker"; exit $rc; fi
  done
  [ $said -eq 0 ] && { echo "browser-lane: all $LANES slots in use, waiting … (scripts/browser-lane.sh status)" >&2; said=1; }
  sleep 10
done
