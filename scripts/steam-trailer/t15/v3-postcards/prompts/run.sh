#!/usr/bin/env bash
# usage: OUT=<scratch dir> run.sh <id> [suffix]   -> $OUT/out/<id><suffix>.png ; one codex image_gen run (common.txt +
# <id>.txt), copied the moment the PNG lands in ~/.codex/generated_images/<session>/
set -u
P="$(cd "$(dirname "$0")" && pwd)"
G="${OUT:?set OUT to a scratch directory}"
REPO=/Users/raynos/projects/games/wildshard-singleplayer
id="$1"; suf="${2:-}"
mkdir -p "$G/out" "$G/logs"
log="$G/logs/$id$suf.log"
prompt="$(cat "$P/common.txt")

$(cat "$P/$id.txt")

TASK FOR CODEX: Use the built-in image_gen tool to generate exactly ONE 3:2 landscape image (1536x1024) as described above. One generation only. Then copy the PNG that YOUR image_gen call produced (its path is in the tool result; never 'the newest file') to $G/out/$id$suf.png. Create or modify no other file."
gtimeout 900 codex exec -s workspace-write --skip-git-repo-check -C "$REPO" --add-dir ~/.codex/generated_images --add-dir "$G" \
  -o "$G/logs/$id$suf.last.txt" "$prompt" > "$log" 2>&1 &
cpid=$!
sid=""
for i in $(seq 1 900); do
  sleep 1
  if [ -f "$G/out/$id$suf.png" ]; then break; fi
  [ -z "$sid" ] && sid="$(grep -m1 -o 'session id: [0-9a-f-]*' "$log" 2>/dev/null | awk '{print $3}')"
  if [ -n "$sid" ] && [ -d "$HOME/.codex/generated_images/$sid" ]; then
    f="$(ls "$HOME/.codex/generated_images/$sid"/*.png 2>/dev/null | head -1)"
    if [ -n "$f" ]; then sleep 2; cp "$f" "$G/out/$id$suf.png"; break; fi
  fi
  kill -0 $cpid 2>/dev/null || break
done
kill $cpid 2>/dev/null
pkill -P $cpid 2>/dev/null
if [ -f "$G/out/$id$suf.png" ]; then echo "OK $id$suf"; else echo "FAIL $id$suf (see $log)"; fi
