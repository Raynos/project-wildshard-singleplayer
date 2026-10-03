#!/usr/bin/env bash
# session-brief.sh — cold-pickup orientation, printed into context at SessionStart (.claude/settings.json).
# Pure read, fast, never fails the session: unanswered asks + live plans (scripts/asks.mjs) → reviews → recent commits.
# Run by hand: bash .claude/hooks/session-brief.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 0
echo "== session brief (.claude/hooks/session-brief.sh) =="
# the E357 lock (GAME-NORMALIZATION F0): only while the plan's State line says `in progress`; gone once it is archived
if [ -f project/archive/2026-10-01-game-normalization.md ] && sed -n 3p project/archive/2026-10-01-game-normalization.md | grep -q '`in progress`'; then
  echo "LOCK: E357 GAME-NORMALIZATION holds the repo — see project/archive/2026-10-01-game-normalization.md §3"
  reopened="$(node -e 'try{const l=require("./.github/lock.json");console.log(Object.keys(l.reopened||{}).join(", ")||"none")}catch{console.log("?")}' 2>/dev/null || echo '?')"
  echo "  reopened shard folders (.github/lock.json): $reopened"
fi
# asks still unanswered (with expired claims and picks) and the live plans' State lines: scripts/asks.mjs (E423)
node scripts/asks.mjs brief 2>/dev/null || echo "(scripts/asks.mjs brief failed)"
echo ""
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
# pages for Jake to read (E408, docs/reviews/README.md): unread / reading; a read one is archived, so every file here is open
echo "-- reviews for Jake (docs/reviews/*.md: unread / reading; read ones move to project/archive/reviews/) --"
found=0
for f in docs/reviews/*.md; do
  [ -f "$f" ] || continue
  [ "$(basename "$f")" = README.md ] && continue
  found=1
  st="$(grep -m1 -E '^\*\*Status:\*\*' "$f" | sed -E 's/^\*\*Status:\*\* *//' | cut -c1-140 || true)"
  plan="$(grep -m1 -E '^\*\*Plan:\*\*' "$f" | sed -E 's/^\*\*Plan:\*\* *//' | cut -d' ' -f1 || true)"
  link="$(grep -m1 -E '^\*\*Link:\*\*' "$f" | sed -E 's/^\*\*Link:\*\* *//' || true)"
  printf '%s | %s | plan %s | %s\n' "$(basename "$f" .md)" "${st:-(no Status line)}" "${plan:-?}" "$link"
done
[ "$found" = 1 ] || echo "(none)"
echo ""
node scripts/telemetry-brief.mjs 2>/dev/null || true
echo "-- recent commits --"
git log --oneline -8 2>/dev/null || true
if [ "$(git config core.hooksPath 2>/dev/null)" != ".githooks" ]; then
  echo ""
  echo "!! git hooks are OFF in this checkout: run  git config core.hooksPath .githooks  (AGENTS.md → Version control)"
fi
echo ""
echo "Next: relay the unanswered asks and any !! flags. A request for work gets its own file first: scripts/ask-new.sh \"<the user's words>\" (docs/process/ASKS.md)"
