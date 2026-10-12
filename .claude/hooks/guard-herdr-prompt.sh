#!/usr/bin/env bash
# PreToolUse(Bash) guard: read before write on herdr. Refuses (exit 2) a `herdr agent prompt <target>` or
# `herdr pane send-text|send-keys|run <target>` when the target pane has a question open for Jake
# (scripts/herdr-question-open.sh), because the pasted text would answer it for him (Jake, 2026-10-12).
# The wildshard-v plan agent is never a target at all (AGENTS.md). Escape (rare): SKIP_HERDR_GUARD=1 in the command.
set -uo pipefail
input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
[ -z "$cmd" ] && exit 0
printf '%s' "$cmd" | grep -q 'herdr' || exit 0
printf '%s' "$cmd" | grep -q 'SKIP_HERDR_GUARD=1' && exit 0

targets="$(printf '%s' "$cmd" | grep -oE 'herdr[[:space:]]+(agent[[:space:]]+prompt|pane[[:space:]]+(send-text|send-keys|run))[[:space:]]+[^[:space:]"'"'"']+' | awk '{print $NF}' | sort -u)"
[ -z "$targets" ] && exit 0
check="$CLAUDE_PROJECT_DIR/scripts/herdr-question-open.sh"
for t in $targets; do
  case "$t" in -*) continue ;; esac
  name="$(herdr agent get "$t" 2>/dev/null | jq -r '.result.agent.name // empty' 2>/dev/null || true)"
  if [ "$t" = wildshard-v ] || [ "$name" = wildshard-v ]; then
    echo "Blocked: never herdr-prompt the plan agent wildshard-v; it talks to Jake. Reply in STATE.md or a commit message (AGENTS.md)." >&2
    exit 2
  fi
  if [ -x "$check" ] && why="$("$check" "$t")"; then
    echo "Blocked: $why. A herdr message now would answer that question for Jake. Put it in STATE.md / a commit message, or retry later." >&2
    exit 2
  fi
done
exit 0
