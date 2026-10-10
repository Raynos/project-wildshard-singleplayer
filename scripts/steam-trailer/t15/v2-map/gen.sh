#!/bin/bash
# gen.sh <id> : one codex image_gen run for the plot <id> in prompts/plots.tsv -> gen/<id>.png
# Copies the PNG the moment it lands in ~/.codex/generated_images/<session>/ and kills that codex (MOCKUPS.md).
set -u
D="$(cd "$(dirname "$0")" && pwd)"
REPO=/Users/raynos/projects/games/wildshard-singleplayer
id="$1"
line="$(awk -F'\t' -v k="$id" '$1==k {print $2}' "$D/prompts/plots.tsv")"
[ -n "$line" ] || { echo "no prompt for $id"; exit 1; }
common="$(cat "$D/prompts/common.txt")"
prompt="${common}${line}

TASK FOR CODEX: Use the built-in image_gen tool to generate exactly ONE square (1:1) image as described above. One generation only. Then copy the PNG that YOUR image_gen call produced (its path is in the tool result; other runs are writing to ~/.codex/generated_images at the same time, so never 'the newest file') to $D/gen/${id}.png. Create or modify no other file."
log="$D/gen/${id}.log"
gtimeout 900 codex exec -s workspace-write --skip-git-repo-check -C "$REPO" --add-dir ~/.codex/generated_images \
  --add-dir "$D" -o "$D/gen/${id}.last.txt" "$prompt" > "$log" 2>&1 &
pid=$!
sid=""
for i in $(seq 1 450); do
  sleep 2
  if [ -z "$sid" ]; then sid="$(grep -m1 -o 'session id: [0-9a-f-]*' "$log" | awk '{print $3}')"; fi
  if [ -f "$D/gen/${id}.png" ]; then break; fi
  if [ -n "$sid" ] && [ -d "$HOME/.codex/generated_images/$sid" ]; then
    f="$(ls "$HOME/.codex/generated_images/$sid"/*.png 2>/dev/null | head -1)"
    if [ -n "$f" ]; then sleep 2; cp "$f" "$D/gen/${id}.png"; break; fi
  fi
  kill -0 $pid 2>/dev/null || break
done
pkill -P $pid 2>/dev/null; kill $pid 2>/dev/null
if [ -f "$D/gen/${id}.png" ]; then echo "$id ok"; else echo "$id FAILED"; fi
