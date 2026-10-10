#!/usr/bin/env bash
# op-ship38 (G326): one labelled board per shard from parity.mjs's captures: a title line, then a row per pose,
# LEGACY | SHARDFILE, each panel labelled with its side, pose and (SHARDFILE) the pose's MAE against legacy.
#   bash progress/shard-platform/ship38/board.sh <slug> "<Shard name>"
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)"; slug=$1 name=$2
cap="$dir/parity"; json="$cap/parity-$slug.json"
root=$(mktemp -d); trap 'rm -rf "$root"' EXIT
label() { magick "$1" -resize 400x -gravity north -background '#111' -splice 0x40 -fill white -pointsize 22 -annotate +0+8 "$2" "$3"; }
rows=()
for pose in view-1 view-2 view-3; do
  [ -f "$cap/$slug-$pose-legacy.jpg" ] && [ -f "$cap/$slug-$pose-shardfile.jpg" ] || continue
  mae=$(node -e "const r=require('$json');const d=r.diffs.find(x=>x.pose==='$pose');process.stdout.write(d?String(d.mae):'?')")
  label "$cap/$slug-$pose-legacy.jpg" "LEGACY · $pose" "$root/a.png"
  label "$cap/$slug-$pose-shardfile.jpg" "SHARDFILE · $pose · MAE $mae" "$root/b.png"
  magick "$root/a.png" "$root/b.png" +append "$root/$pose.png"; rows+=("$root/$pose.png")
done
magick "${rows[@]}" -append "$root/body.png"
magick "$root/body.png" -gravity north -background '#000' -splice 0x72 -fill white -pointsize 24 \
  -gravity northwest -annotate +14+8 "G326 $name: LEGACY vs SHARDFILE" -pointsize 18 -annotate +14+42 "same poses · iPhone 16 Pro · Developer on · midday" \
  -quality 72 "$dir/board-$slug.jpg"
echo "$dir/board-$slug.jpg"
