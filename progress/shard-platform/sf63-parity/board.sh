#!/usr/bin/env bash
# SF63 parity boards: one board per shard and tier, a row per pose: SHARD SELECT | grid at the parent (where that run
# exists) | grid with this change. bash board.sh <dir with the captures> <after tag> <before tag> <shard> <tier> <pose> …
# The captures are capture.mjs's <pose>-<tier>-<standalone|grid>.jpg in <dir>/<tag>/.
set -euo pipefail
dir=$1 after=$2 before=$3 shard=$4 tier=$5; shift 5
out="$(cd "$(dirname "$0")" && pwd)"
label() { magick "$1" -resize 300x -gravity north -background '#111' -splice 0x34 -fill white -pointsize 20 -annotate +0+6 "$2" "$3"; }
root=$(mktemp -d); trap 'rm -rf "$root"' EXIT
rows=()
for pose in "$@"; do
  tmp="$root/$pose"; mkdir -p "$tmp"
  label "$dir/$after/$pose-$tier-standalone.jpg" "SHARD SELECT · $pose" "$tmp/a.png"
  cols=("$tmp/a.png")
  if [ -f "$dir/$before/$pose-$tier-grid.jpg" ]; then label "$dir/$before/$pose-$tier-grid.jpg" 'grid, parent' "$tmp/b.png"; cols+=("$tmp/b.png"); fi
  label "$dir/$after/$pose-$tier-grid.jpg" "${AFTER_LABEL:-grid, SF63}" "$tmp/c.png"; cols+=("$tmp/c.png")
  magick "${cols[@]}" +append "$tmp/row.png"
  rows+=("$tmp/row.png")
done
magick "${rows[@]}" -append -quality 72 "$out/board-$shard-$tier.jpg"
