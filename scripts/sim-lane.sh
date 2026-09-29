#!/usr/bin/env bash
# sim-lane.sh — the machine-wide lane for iOS Simulators, and their reaper (E316, Jake 2026-09-29: "iOS simulators can be
# garbage collected. If no one's using them, kill them … we need to free up more memory").
#
# A booted Simulator costs ~6 GB and ~300 processes. On 2026-09-29 two sat booted (one for 18 h, driven by nobody) while
# the Mac had 1.5 GB free and the model jobs waited for memory.
#
#   scripts/sim-lane.sh run [--max <min>] [--keep] <device> <cmd …>
#        boot <device> (a name or UDID; a missing name is created as an iPhone 17 Pro on the newest iOS runtime), run
#        <cmd> holding the lane, shut the device down after (--keep leaves it booted under a 30 min lease). <cmd> is
#        killed after --max minutes (default 60). $SIM_UDID is set for <cmd>.
#   scripts/sim-lane.sh lease <device> [<min>]      boot (if needed) and hold it for <min> minutes (default 30) while you
#                                                   drive it by hand; call again to renew. Prints the UDID.
#   scripts/sim-lane.sh release <device>            shut it down and drop the lease (do this when you are done)
#   scripts/sim-lane.sh status                      booted devices, uptime, lease, who is driving them
#   scripts/sim-lane.sh wait                        block until the lane has room
#   scripts/sim-lane.sh reap [--dry-run]            shut down idle Simulators (below); quit Simulator.app when none is left
#
# Lane size: SIM_LANES (default 1) booted devices machine-wide, whoever booted them.
# Reaping (also run by browser-lane.sh reap, so from the SessionStart / Stop / SubagentStop hooks and every lane wait):
# a booted device is shut down when its lease expired, or when it has no lease and has been up SIM_IDLE_MIN (default 30)
# minutes — unless a process outside the Simulator is driving it (its UDID or name on a command line: simctl io
# recordVideo, xcodebuild, a node script …), or a `run` is in progress on it. Log: ~/.sim-lane/reap.log.

set -uo pipefail

LANES="${SIM_LANES:-1}"
IDLE_MIN="${SIM_IDLE_MIN:-30}"
DIR="$HOME/.sim-lane"
mkdir -p "$DIR"
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$DIR/reap.log"; }
now() { date +%s; }

booted() { xcrun simctl list devices booted -j 2>/dev/null | jq -r '.devices[][] | "\(.udid)\t\(.name)"'; }
booted_count() { booted | grep -c . ; }

# seconds a device has been up (its launchd_sim's age)
uptime_s() {
  local pid e d=0 h=0 m=0 s=0
  pid="$(ps -Ao pid=,command= | grep launchd_sim | grep "$1" | grep -v grep | awk '{print $1}' | head -1)"
  [ -z "$pid" ] && { echo 0; return; }
  e="$(ps -o etime= -p "$pid" | tr -d ' ')"
  if [[ "$e" == *-* ]]; then d="${e%%-*}"; e="${e#*-}"; fi
  IFS=: read -r -a p <<<"$e"
  case "${#p[@]}" in 3) h=${p[0]}; m=${p[1]}; s=${p[2]};; 2) m=${p[0]}; s=${p[1]};; *) s=${p[0]};; esac
  echo $(( 10#$d * 86400 + 10#$h * 3600 + 10#$m * 60 + 10#$s ))
}

# processes outside the Simulator whose command line names the device (who is driving it)
drivers() {
  local udid="$1" name="$2"
  ps -Ao pid=,command= | grep -F -e "$udid" -e "$name" | grep -v -e grep -e "CoreSimulator/Devices/$udid" -e launchd_sim \
    -e 'sim-lane.sh reap' -e 'sim-lane.sh status' | grep -v -E '^ *[0-9]+ (/bin/)?(ba)?sh -c .*sim-lane\.sh (reap|status)' | cut -c1-140
}

# lease file: "<expiry epoch> <owner pid or 0>"
lease_file() { echo "$DIR/$1.lease"; }
lease_valid() {
  local f; f="$(lease_file "$1")"; [ -f "$f" ] || return 1
  local exp pid; read -r exp pid < "$f"
  [ "${pid:-0}" != "0" ] && kill -0 "$pid" 2>/dev/null && return 0   # a `run` in progress
  [ "${exp:-0}" -gt "$(now)" ]
}

resolve() {  # name or UDID → UDID (creating a missing name)
  local want="$1" u
  u="$(xcrun simctl list devices -j | jq -r --arg w "$want" '.devices[][] | select(.udid == $w or .name == $w) | .udid' | head -1)"
  if [ -z "$u" ]; then
    local rt dt
    rt="$(xcrun simctl list runtimes -j | jq -r '[.runtimes[] | select(.platform == "iOS" and .isAvailable)] | last | .identifier')"
    dt="$(xcrun simctl list devicetypes -j | jq -r '[.devicetypes[] | select(.name | test("^iPhone 17 Pro$"))] | first | .identifier')"
    [ "$dt" = "null" ] && dt="$(xcrun simctl list devicetypes -j | jq -r '[.devicetypes[] | select(.name | test("^iPhone"))] | last | .identifier')"
    u="$(xcrun simctl create "$want" "$dt" "$rt")" || { echo "sim-lane: could not create $want" >&2; exit 1; }
    echo "sim-lane: created $want ($u)" >&2
  fi
  echo "$u"
}

is_booted() { booted | cut -f1 | grep -qx "$1"; }

shutdown_dev() {
  xcrun simctl shutdown "$1" >/dev/null 2>&1
  rm -f "$(lease_file "$1")"
  [ "$(booted_count)" -eq 0 ] && pgrep -x Simulator >/dev/null && osascript -e 'quit app "Simulator"' >/dev/null 2>&1
  return 0
}

reap() {
  local dry="${1:-}" n=0 udid name up why d
  while IFS=$'\t' read -r udid name; do
    [ -z "$udid" ] && continue
    lease_valid "$udid" && continue
    d="$(drivers "$udid" "$name")"
    [ -n "$d" ] && continue
    up="$(uptime_s "$udid")"; why=""
    if [ -f "$(lease_file "$udid")" ]; then why="lease expired"
    elif [ "$up" -gt $((IDLE_MIN * 60)) ]; then why="no lease, idle, up $((up / 60)) min"; fi
    [ -z "$why" ] && continue
    n=$((n + 1))
    if [ "$dry" = "--dry-run" ]; then echo "would shut down simulator $name ($udid): $why"; continue; fi
    log "shutdown $name ($udid): $why"
    echo "shut down simulator $name ($why)"
    shutdown_dev "$udid"
  done < <(booted)
  [ "$dry" = "--dry-run" ] && [ $n -eq 0 ] && echo "no idle simulator"
  if [ "$dry" != "--dry-run" ] && [ "$(booted_count)" -eq 0 ] && pgrep -x Simulator >/dev/null; then
    osascript -e 'quit app "Simulator"' >/dev/null 2>&1; log "quit Simulator.app (nothing booted)"
  fi
  return 0
}

status() {
  echo "simulators: $(booted_count) / $LANES booted"
  while IFS=$'\t' read -r udid name; do
    [ -z "$udid" ] && continue
    local l="no lease" f; f="$(lease_file "$udid")"
    if [ -f "$f" ]; then read -r exp pid < "$f"; if [ "${pid:-0}" != "0" ] && kill -0 "$pid" 2>/dev/null; then l="run in progress (pid $pid)"; else l="lease $(( (exp - $(now)) / 60 )) min left"; fi; fi
    printf '  %-20s %s  up %4s min  %s\n' "$name" "$udid" "$(( $(uptime_s "$udid") / 60 ))" "$l"
    drivers "$udid" "$name" | sed 's/^/      driven by: /'
  done < <(booted)
  return 0
}

wait_room() {  # $1 = a UDID that may already be booted (it doesn't need a new slot)
  local said=0
  while :; do
    [ -n "${1:-}" ] && is_booted "$1" && return 0
    [ "$(booted_count)" -lt "$LANES" ] && return 0
    reap >/dev/null
    [ "$(booted_count)" -lt "$LANES" ] && return 0
    [ $said -eq 0 ] && { echo "sim-lane: $LANES simulator(s) already booted, waiting … (scripts/sim-lane.sh status)" >&2; said=1; }
    sleep 15
  done
}

boot() {
  is_booted "$1" && return 0
  xcrun simctl boot "$1" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "$1" -b >/dev/null 2>&1 || true
}

case "${1:-}" in
  status) status;;
  reap) reap "${2:-}";;
  wait) wait_room "";;
  lease)
    dev="${2:?lease <device> [min]}"; min="${3:-30}"
    udid="$(resolve "$dev")"
    exec 9>"$DIR/mutex"; lockf -s 9 2>/dev/null || true
    wait_room "$udid"; boot "$udid"
    echo "$(( $(now) + min * 60 )) 0" > "$(lease_file "$udid")"
    echo "$udid"; echo "sim-lane: $dev leased for $min min — renew with the same command, end with: scripts/sim-lane.sh release $dev" >&2;;
  release)
    udid="$(resolve "${2:?release <device>}")"; shutdown_dev "$udid"; log "released $udid"; echo "released $2";;
  run)
    shift; max=60; keep=0
    while :; do case "${1:-}" in --max) max="$2"; shift 2;; --keep) keep=1; shift;; *) break;; esac; done
    dev="${1:?run <device> <cmd …>}"; shift
    [ $# -gt 0 ] || { echo "usage: sim-lane.sh run [--max <min>] [--keep] <device> <cmd …>" >&2; exit 64; }
    udid="$(resolve "$dev")"
    wait_room "$udid"; boot "$udid"
    echo "$(( $(now) + max * 60 )) $$" > "$(lease_file "$udid")"
    SIM_UDID="$udid" "$@" & child=$!
    ( sleep $((max * 60)); if kill -0 "$child" 2>/dev/null; then echo "sim-lane: killed after ${max} min (--max)" >&2; log "run on $dev killed after ${max} min"; pkill -TERM -P "$child"; kill -TERM "$child"; fi ) 2>/dev/null & timer=$!
    trap 'pkill -TERM -P "$child"; kill -TERM "$child" 2>/dev/null' INT TERM
    wait "$child"; rc=$?
    kill "$timer" 2>/dev/null; pkill -P "$timer" 2>/dev/null
    if [ $keep -eq 1 ]; then echo "$(( $(now) + 30 * 60 )) 0" > "$(lease_file "$udid")"; else shutdown_dev "$udid"; fi
    exit $rc;;
  *) sed -n '2,26p' "$SELF";;
esac
