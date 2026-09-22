#!/usr/bin/env bash
# session-brief.sh — cold-pickup orientation, printed into context at SessionStart (.claude/settings.json).
# Pure read, fast, never fails the session: open asks → live plans → recent commits. Relay open asks to the user first.
# Run by hand: bash .claude/hooks/session-brief.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 0
echo "== session brief (.claude/hooks/session-brief.sh) =="
echo "-- open asks (docs/tasks/ASKS.md: every row not done/dropped) --"
if [ -f docs/tasks/ASKS.md ]; then
  # ids are a bare number or a lettered series (D12, G3, V2, L1, MK1A…): anything alphanumeric in the first column
  open="$(grep -E '^\| [A-Z0-9-]+ \|' docs/tasks/ASKS.md | grep -vE '^\| # ' | grep -vE '\| \*\*(done|dropped|closed)' | cut -d'|' -f2-4 || true)"
  if [ -n "$open" ]; then printf '%s\n' "$open"; else echo "(none open)"; fi
else echo "(missing)"; fi
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
echo ""
echo "Next: relay the open asks if non-empty; add every new ask to docs/tasks/ASKS.md before starting it"
