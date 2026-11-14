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
  api="$(node scripts/api-origin.mjs 2>/dev/null || echo https://wildshard-singleplayer.vercel.app)"
  r="$(curl -s --max-time 3 -H "x-review-password: $pw" "$api/api/errors?count=1&since=$since" 2>/dev/null || true)"
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
# -- ./tmp (REPO-DISK DK7) -- ported from repo-kit's .agents/hooks/session-brief.sh;
# singleplayer is not on the kit's agent layout, so it carries the block and
# lib/tmp-measure.sh by hand.
here="$ROOT/.claude/hooks"; root="$ROOT"
# One line: size, folders, folders over 3 days, folders without an
# .owner (scratch-dir.mjs writes it, DK3); a warning over 30 GiB. The
# size comes from tmp/.disk-line, which lib/tmp-measure.sh refreshes in
# the background once it is an hour old (du takes seconds on a big
# ./tmp; the brief must not). WS_TMP_MEASURE=sync measures inline.
folders=0; unowned=0; entries=0
for entry in tmp/*; do
  [ -e "$entry" ] || [ -L "$entry" ] || continue
  entries=$((entries + 1))
  [ -d "$entry" ] && [ ! -L "$entry" ] || continue
  folders=$((folders + 1))
  [ -e "$entry/.owner" ] || unowned=$((unowned + 1))
done
if [ "$entries" = 0 ]; then
  echo "-- ./tmp is empty --"
else
  # tmp/.disk-line: "<KiB> <folders over 3 days> <epoch seconds>". No
  # leading zeros, so bash never reads a field as octal.
  measured() {
    local n='^(0|[1-9][0-9]*)$'
    kib=""; stale=""; at=""
    read -r kib stale at 2>/dev/null < tmp/.disk-line
    [[ "$kib" =~ $n && "$stale" =~ $n && "$at" =~ $n ]]
  }
  if [ "${WS_TMP_MEASURE:-}" = sync ]; then
    bash "$here/lib/tmp-measure.sh" "$root"
  elif ! measured || [ -z "$(find tmp/.disk-line -mmin -60 2>/dev/null)" ]; then
    # A lock left by a killed walk frees itself after 30 minutes.
    find tmp/.disk-line.lock -maxdepth 0 -mmin +30 -exec rmdir {} \; 2>/dev/null
    if mkdir tmp/.disk-line.lock 2>/dev/null; then
      nohup nice bash "$here/lib/tmp-measure.sh" "$root" locked </dev/null >/dev/null 2>&1 &
    fi
  fi
  if measured; then
    # The folder counts are live; the size and the age count are from the
    # measurement, so an age count over today's folders is capped.
    [ "$stale" -gt "$folders" ] && stale="$folders"
    gib="$(awk -v k="$kib" 'BEGIN { printf "%.1f", k / 1048576 }')"
    warn=""
    [ "$kib" -gt 31457280 ] && warn=" !! over 30 GiB: delete your finished folders, keep only logs and JSON (REPO-DISK DK5)"
    echo "-- ./tmp is $gib GiB in $folders folders; $stale over 3 days; $unowned without an owner (size and age measured $(( ($(date +%s) - at) / 60 )) min ago) --$warn"
  else
    echo "-- ./tmp has $folders folders; $unowned without an owner; size measuring now, the next session shows it --"
  fi
fi
echo "-- recent commits --"
git log --oneline -8 2>/dev/null || true
if [ "$(git config core.hooksPath 2>/dev/null)" != ".githooks" ]; then
  echo ""
  echo "!! git hooks are OFF in this checkout: run  git config core.hooksPath .githooks  (AGENTS.md → Version control)"
fi
echo ""
echo "Next: relay the unanswered asks and any !! flags. A request for work gets its own file first: scripts/ask-new.sh \"<the user's words>\" (docs/process/ASKS.md)"
