#!/usr/bin/env bash
# auto-push.sh — the automatic pusher (SF74 W14). .githooks/post-commit starts it, detached, after every commit on main
# in the main checkout, so commits reach origin without anyone remembering to run the pusher.
#
# Why (2026-10-09): commit → origin was median 8.3 min, p90 53.6 min over 6 h, and the biggest cause was that nobody
# ran scripts/push-main.sh: origin sat idle for 25 min with 35 commits waiting, and once for 66 min.
#
# How:
#   - single instance: .git/auto-push.lock (lockf). Every start first marks .git/auto-push.pending; a start that
#     finds the lock held just leaves the mark, and the running instance (or its launcher, after it lets go) sees it.
#   - waits AUTO_PUSH_SETTLE seconds (default 10) so a burst of commits goes up as one push, then runs
#     scripts/push-main.sh with PUSH_WAIT=1: it queues behind a manual push instead of leaving commits local.
#   - a red push (gate, regeneration or upload) is not retried on the same tip: it pings (once per red streak) the lanes
#     whose commits are in the red range (.git/commit-lanes.jsonl, written by post-commit; pane → name through `herdr agent list`), or the
#     coordinator, with the run's log, and waits for the next commit (most likely the fix).
#   - log: .git/auto-push.log (one line per run); each run's full output: .git/auto-push/<time>-<tip>.log (last 40 kept).
#   - waits while .git/quiet exists (the coordinator's measurement windows), and passes .git/generated-approval.json
#     (the coordinator's standing receipt) as GENERATED_APPROVAL_FILE when it exists; a rise it doesn't cover pings
#     the coordinator too, and a rewritten receipt retries the red tip on the next start.
#   - off switch: `touch .git/auto-push.off` (or WS_AUTO_PUSH=0 in the committing shell). Manual scripts/push-main.sh
#     still works.
#
#   scripts/auto-push.sh            (post-commit runs it; safe to run by hand)
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0
common="$(git rev-parse --path-format=absolute --git-common-dir)"
gitdir="$(git rev-parse --path-format=absolute --git-dir)"

# Only the main checkout on main pushes: feature worktrees never push, CI and scratch repos have no business here.
[ "$gitdir" = "$common" ] || exit 0
[ "$(git symbolic-ref -q --short HEAD)" = main ] || exit 0
[ -n "$(git config --get remote.origin.url)" ] || exit 0
[ -f scripts/push-main.sh ] || exit 0
[ -z "${CI:-}" ] && [ "${WS_AUTO_PUSH:-1}" != 0 ] && [ ! -e "$common/auto-push.off" ] || exit 0

lock="$common/auto-push.lock"
pending="$common/auto-push.pending"

if [ "${1:-}" != --locked ]; then
  touch "$pending"
  # A private snapshot, like push-main.sh: an edit landing in the shared tree mid-run must not change this run.
  snap="$(mktemp -t auto-push)" && cp "$0" "$snap" || exit 1
  # Holder exits only after it found no mark; a start that lost the lock race marked first, so re-check after release.
  while [ -e "$pending" ]; do
    lockf -k -t 0 "$lock" bash "$snap" --locked
    [ $? -eq 75 ] && break # another instance holds the lock: it (or its launcher) sees our mark
  done
  rm -f "$snap"
  exit 0
fi

log="$common/auto-push.log"
runs="$common/auto-push"
red="$common/auto-push.red"
pinged="$common/auto-push.pinged"
approval="$common/generated-approval.json" # the coordinator's standing receipt for generated increases, when present
mkdir -p "$runs"
note() { printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$log"; }

# herdr names for the panes that made the commits in <range>; never the plan agent (a typed prompt can answer its open
# question, MEMORY: never herdr-prompt the plan agent), and the coordinator when nobody else is found.
lanes_for() {
  local range="$1" panes names
  [ -f "$common/commit-lanes.jsonl" ] || { echo wildshard-new; return; }
  panes="$(git rev-list "$range" | while read -r c; do grep -F "\"$c\"" "$common/commit-lanes.jsonl" | tail -1; done \
    | sed -n 's/.*"pane":"\([^"]*\)".*/\1/p' | sort -u)"
  names=""
  if [ -n "$panes" ]; then
    # shellcheck disable=SC2086 # word-split on purpose: pane ids
    names="$(herdr agent list 2>/dev/null | node -e '
      let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
        const panes = new Set(process.argv.slice(1));
        let list = [];
        try { list = JSON.parse(s).result.agents; } catch { list = []; }
        for (const a of list) if (panes.has(a.pane_id) && a.name !== "wildshard-v") console.log(a.name);
      });' $panes | sort -u)"
  fi
  [ -n "$names" ] && echo "$names" || echo wildshard-new
}

ping_red() {
  local tip="$1" out="$2" why="$3" tail_lines lane lanes
  tail_lines="$(grep -E 'FAILED|error|Error|rose|refus|stale' "$out" | tail -4 | cut -c1-220 | tr '\n' ' ')"
  lanes="$(lanes_for "origin/main..$tip")"
  case "$why" in *receipt*) lanes="$(printf '%s\nwildshard-new\n' "$lanes" | sort -u)" ;; esac
  for lane in $lanes; do
    # once per lane per red streak: a lane committing into a red range hears about it once, not on every commit
    grep -qxF "$lane" "$pinged" 2>/dev/null && continue
    echo "$lane" >> "$pinged"
    herdr agent prompt "$lane" "[auto-push] $why at $(git rev-parse --short "$tip"): nothing reaches origin until it is green. One of your commits is in the unpushed range. Log: $out. ${tail_lines} Fix it and commit; the pusher retries on the next commit." >/dev/null 2>&1 \
      && note "pinged $lane" || note "ping to $lane failed"
  done
}

while [ -e "$pending" ]; do
  rm -f "$pending"
  sleep "${AUTO_PUSH_SETTLE:-10}"
  [ -e "$common/auto-push.off" ] && { note "off switch present: stopping"; exit 0; }
  # The coordinator's measurement quiet window (frame floor, soak, Simulator): a push gate would spoil the reading.
  if [ -e "$common/quiet" ]; then
    note "quiet window (.git/quiet): waiting"
    while [ -e "$common/quiet" ]; do sleep 20; done
    note "quiet window over"
  fi
  tip="$(git rev-parse main)"
  [ "$(git rev-list --count "origin/main..$tip")" = 0 ] && continue
  # A red tip is retried only after a new commit, or after the coordinator rewrote the standing approval receipt.
  if [ -f "$red" ] && [ "$(cat "$red")" = "$tip" ] && ! [ "$approval" -nt "$red" ]; then note "skip ${tip:0:9}: already red, waiting for a new commit"; continue; fi
  approve=(env)
  [ -f "$approval" ] && approve=(env "GENERATED_APPROVAL_FILE=$approval")
  ls -1t "$runs"/*.log 2>/dev/null | tail -n +40 | while read -r f; do rm -f "$f"; done
  lanes="$common/commit-lanes.jsonl"
  if [ -f "$lanes" ] && [ "$(wc -l < "$lanes")" -gt 4000 ]; then tail -2000 "$lanes" > "$lanes.tmp" && mv "$lanes.tmp" "$lanes"; fi
  out="$runs/$(date +%Y%m%dT%H%M%S)-${tip:0:9}.log"
  t0=$SECONDS
  note "push ${tip:0:9} ($(git rev-list --count "origin/main..$tip") ahead)"
  PUSH_WAIT=1 "${approve[@]}" bash scripts/push-main.sh > "$out" 2>&1
  rc=$?
  if [ "$rc" = 0 ]; then
    rm -f "$red" "$pinged"
    note "ok ${tip:0:9} in $((SECONDS - t0)) s"
    # Commits that landed during the push: push-main's own loop usually carried them; go again if not.
    [ "$(git rev-list --count origin/main..main)" = 0 ] || touch "$pending"
    continue
  fi
  if grep -q 'vercel-gate: FAILED' "$out"; then why="the push gate went red"
  elif grep -q 'Coordinator approval required' "$out"; then why="a generated measurement rose and needs the coordinator's receipt (.git/generated-approval.json)"
  elif grep -qiE 'regenerat|approval|witness' "$out"; then why="the push-time regeneration failed"
  else
    # Likely the uplink: one retry after a minute before calling it red.
    note "push failed rc=$rc in $((SECONDS - t0)) s (not the gate); retrying once in 60 s"
    sleep 60
    PUSH_WAIT=1 "${approve[@]}" bash scripts/push-main.sh >> "$out" 2>&1 && { rm -f "$red" "$pinged"; note "ok ${tip:0:9} on retry"; continue; }
    why="the push failed (rc $rc, not the gate)"
  fi
  echo "$tip" > "$red"
  note "RED ${tip:0:9} rc=$rc in $((SECONDS - t0)) s: $why ($out)"
  ping_red "$tip" "$out" "$why"
done
exit 0
