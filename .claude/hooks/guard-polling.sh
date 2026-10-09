#!/usr/bin/env bash
# PreToolUse(Bash) guard: no sleep-polling loops (SF74 W21, speed audit #2). Claude lanes spent 5.8 agent-hours in 4 h
# (231 calls) in `until …; do sleep …; done`, `while kill -0 <pid>; do sleep 20; done` and long bare sleeps, waiting on
# pushes, proofs and index.lock. A long wait belongs to a detached runner that reports back.
#
# Refuses (exit 2) a Bash call that can sit in a sleep for more than ~60 s:
#   - a `while` / `until` loop that sleeps (unbounded);
#   - a `for` loop over `seq A B` / `{A..B}` whose count × sleep is over 60 s;
#   - a bare `sleep` over 60 s.
# Allowed: run_in_background (the harness re-invokes you when it exits), a tool timeout ≤ 60 s, a leading `timeout N`
# / `gtimeout N` with N ≤ 60, the pusher's own scripts (push-main.sh, auto-push.sh, vercel-tree-gate.sh, proof-run.sh).
# Escape (rare, a real need): SKIP_POLL_GUARD=1 in the command.
set -uo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
[ -z "$cmd" ] && exit 0
bg="$(printf '%s' "$input" | jq -r '.tool_input.run_in_background // false' 2>/dev/null || echo false)"
tmo="$(printf '%s' "$input" | jq -r '.tool_input.timeout // 0' 2>/dev/null || echo 0)"
[ "$bg" = true ] && exit 0
case "$tmo" in ''|*[!0-9.]*) tmo=0 ;; esac
[ "${tmo%.*}" -gt 0 ] && [ "${tmo%.*}" -le 60000 ] && exit 0
has() { printf '%s' "$cmd" | grep -qE "$1"; }
has 'SKIP_POLL_GUARD=1' && exit 0
has 'scripts/(push-main|auto-push|vercel-tree-gate|proof-run)\.sh' && exit 0
has "^[[:space:]]*(g?timeout)[[:space:]]+([1-5]?[0-9]|60)s?[[:space:]]" && exit 0
has '(^|[^[:alnum:]_-])sleep([[:space:]]|$)' || exit 0

# seconds of the longest `sleep N[s|m|h]` in the command (a variable or expression counts as long)
longest=0
while read -r arg; do
  [ -z "$arg" ] && continue
  case "$arg" in
    *[!0-9.smhd]*|'') s=3600 ;;
    *h) s=$(( ${arg%h} * 3600 )) ;;
    *m) s=$(( ${arg%m} * 60 )) ;;
    *d) s=86400 ;;
    *s) s="${arg%s}"; s="${s%.*}" ;;
    *) s="${arg%.*}" ;;
  esac
  [ -z "$s" ] && s=0
  [ "$s" -gt "$longest" ] && longest="$s"
done < <(printf '%s' "$cmd" | grep -oE '(^|[^[:alnum:]_-])sleep[[:space:]]+[^[:space:];&|)]+' | sed -E 's/.*sleep[[:space:]]+//')

block() {
  cat >&2 <<EOF
BLOCKED by .claude/hooks/guard-polling.sh: $1

Don't poll (SF74 W21: 5.8 agent-hours in 4 h went to sleep loops). Instead:
  - a long proof / soak / build: scripts/proof-run.sh <label> -- <command…>  (detached; pings your pane with the verdict)
  - a command you must wait on: run it with run_in_background (you are re-invoked when it exits)
  - a condition (a file appears, a log line, a PID exits): the Monitor tool with an until-loop
  - pushes: commits push themselves (scripts/auto-push.sh); check later with git log origin/main..main
Escape (rare, a real need): SKIP_POLL_GUARD=1 in the command.
EOF
  exit 2
}

if has '(^|[;&|({]|[[:space:]]do|[[:space:]]then)[[:space:]]*(while|until)[[:space:]]'; then
  block "a while/until loop that sleeps (an unbounded poll)"
fi
if has '(^|[;&|({]|[[:space:]]do|[[:space:]]then)[[:space:]]*for[[:space:]]'; then
  count="$(printf '%s' "$cmd" | grep -oE 'seq[[:space:]]+([0-9]+[[:space:]]+)?[0-9]+|\{[0-9]+\.\.[0-9]+\}' | head -1 | grep -oE '[0-9]+' | tail -2 | paste -sd' ' -)"
  # shellcheck disable=SC2086 # word-split on purpose: the loop bounds
  set -- $count
  n=0
  if [ $# -eq 2 ]; then n=$(( $2 - $1 + 1 )); elif [ $# -eq 1 ]; then n="$1"; fi
  [ "$n" -gt 0 ] && [ $(( n * longest )) -gt 60 ] && block "a for loop that sleeps ~$(( n * longest )) s in total"
  [ "$n" -gt 0 ] && exit 0
fi
[ "$longest" -gt 60 ] && block "a ${longest} s sleep"
exit 0
