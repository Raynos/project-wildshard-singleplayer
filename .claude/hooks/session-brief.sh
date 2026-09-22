#!/usr/bin/env bash
# session-brief.sh — cold-pickup orientation, printed into context at SessionStart (.claude/settings.json).
# Pure read, fast, never fails the session: open asks → live plans → recent commits. Relay open asks to the user first.
# Run by hand: bash .claude/hooks/session-brief.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 0
echo "== session brief (.claude/hooks/session-brief.sh) =="
echo "-- open asks (docs/tasks/asks/<ID>.md: every file whose Status is not done/dropped) --"
open=""
for f in docs/tasks/asks/*.md; do
  [ -f "$f" ] || continue
  st="$(grep -m1 -E '^\*\*Status:\*\*' "$f" | sed -E 's/^\*\*Status:\*\* *//' || true)"
  printf '%s' "$st" | grep -qiE '^(done|dropped|closed)' && continue
  ask="$(grep -m1 -E '^\*\*Ask:\*\*' "$f" | sed -E 's/^\*\*Ask:\*\* *//' | cut -c1-160 || true)"
  open="$open$(basename "$f" .md) | ${st:-(no Status line)} | $ask"$'\n'
done
# the legacy table (docs/tasks/ASKS.md) is history; a row still open there was never moved to its own file
legacy=""
if [ -f docs/tasks/ASKS.md ]; then
  while IFS= read -r row; do
    id="$(printf '%s' "$row" | cut -d'|' -f2 | tr -d ' ')"
    [ -f "docs/tasks/asks/$id.md" ] && continue # moved: the file is the live copy
    legacy="$legacy$(printf '%s' "$row" | cut -d'|' -f2-4)"$'\n'
  done < <(grep -E '^\| [A-Z0-9-]+ \|' docs/tasks/ASKS.md | grep -vE '^\| # ' | grep -vE '\| \*\*(done|dropped|closed)' || true)
fi
[ -n "$open" ] && printf '%s' "$open"
[ -n "$legacy" ] && printf 'legacy ASKS.md rows still open (move each to docs/tasks/asks/<ID>.md):\n%s' "$legacy"
[ -z "$open$legacy" ] && echo "(none open)"
echo ""
echo "-- live plans (docs/plans/*.md State line; finished ones belong in project/archive/) --"
found=0
for f in docs/plans/*.md; do
  [ -f "$f" ] || continue
  found=1
  st="$(grep -m1 -E '^\*\*State:\*\*' "$f" | sed -E 's/^\*\*State:\*\* *//' || true)"
  printf '%s | %s\n' "$(basename "$f" .md)" "${st:-(no State line — add one, see AGENTS.md → Plans)}"
done
[ "$found" = 1 ] || echo "(none)"
echo ""
echo "-- recent commits --"
git log --oneline -8 2>/dev/null || true
if [ "$(git config core.hooksPath 2>/dev/null)" != ".githooks" ]; then
  echo ""
  echo "!! git hooks are OFF in this checkout: run  git config core.hooksPath .githooks  (AGENTS.md → Version control)"
fi
echo ""
echo "Next: relay the open asks if non-empty; every new ask gets its own file before you start it: scripts/ask-new.sh \"<the user's words>\""
