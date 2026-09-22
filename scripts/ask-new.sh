#!/usr/bin/env bash
# ask-new.sh — claim the next ask id and create its file: docs/tasks/asks/<ID>.md (one file per ask, see AGENTS.md).
#
#   scripts/ask-new.sh "<the user's words, shortened>" [series letter, default E]
#
# The file IS the claim: it is created with noclobber (O_EXCL), so two agents asking for an id at the same moment
# get two different ids (E21 was handed out twice on 2026-09-22 when ids came from reading one shared table).
# Prints the new file's path. Fill in Status / evidence with Edit, then commit it: git commit -m "…" -- <path>
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1
ask="${1:?usage: scripts/ask-new.sh \"<the user's words>\" [series letter]}"
series="${2:-E}"
dir=docs/tasks/asks
mkdir -p "$dir"
# highest number used in this series, in the legacy ledger or in any ask file (committed or not)
max="$( { grep -ohE "^\| ${series}[0-9]+ \|" docs/tasks/ASKS.md 2>/dev/null; ls "$dir" 2>/dev/null | grep -oE "^${series}[0-9]+\.md$"; } \
  | grep -oE '[0-9]+' | sort -n | tail -1)"
n=$(( ${max:-0} + 1 ))
set -o noclobber
for _ in $(seq 1 50); do
  f="$dir/${series}${n}.md"
  if { printf '# %s%s\n\n**Status:** open (%s)\n**Ask:** %s\n\n' "$series" "$n" "$(date +%F)" "$ask" > "$f"; } 2>/dev/null; then
    echo "$f"
    exit 0
  fi
  n=$(( n + 1 ))
done
echo "ask-new: could not claim an id in series $series" >&2
exit 1
