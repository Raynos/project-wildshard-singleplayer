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
# client error reports (E133, api/errors.ts): how many reached the server since the last `pnpm inbox:pull` (.review/errors-seen),
# plus any pulled but not yet handled. One small request, capped at 3 s; silent without a REVIEW_PASSWORD or a network.
pw="${REVIEW_PASSWORD:-$(grep -m1 -E '^REVIEW_PASSWORD=' .env.local 2>/dev/null | sed -E 's/^REVIEW_PASSWORD="?([^"]*)"?$/\1/')}"
if [ -n "$pw" ] && command -v curl >/dev/null 2>&1; then
  since="$(tr -d '[:space:]' < .review/errors-seen 2>/dev/null || true)"
  r="$(curl -s --max-time 3 -H "x-review-password: $pw" "https://wildshard-singleplayer.vercel.app/api/errors?count=1&since=$since" 2>/dev/null || true)"
  n="$(printf '%s' "$r" | sed -nE 's/.*"count":([0-9]+).*/\1/p')"
  [ -n "$n" ] && [ "$n" != 0 ] && echo "!! $n new client error report(s) on the server since ${since:-the first one} — pnpm inbox:pull (category error in .review/inbox/)"
fi
pulled="$(grep -l '"category": "error"' .review/inbox/*.json 2>/dev/null | wc -l | tr -d ' ')"
[ "${pulled:-0}" != 0 ] && echo "!! $pulled client error report(s) pulled into .review/inbox/, not yet handled"
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
