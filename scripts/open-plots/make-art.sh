#!/usr/bin/env bash
# The billboard, sign and card art of open-plots ideas (G541), from src/shards/open-plots/outputs.json.
#   bash scripts/open-plots/make-art.sh <idea> [<idea> ...]
# billboard.webp: the idea's round-27 billboard at 1024 x 576, WebP <= 250 KB.
# sign.webp: 'OPEN PLOT · COMING SOON' over the idea's name, 1536 x 512.
# src/shards/open-plots/thumbs/<idea>.jpg: the SHARD SELECT card, 480 x 270.
set -euo pipefail
R=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
F=/System/Library/Fonts/Helvetica.ttc
for id in "$@"; do
  name=$(node -e "const d=require('$R/src/shards/open-plots/outputs.json');const r=d.outputs.find(o=>o.idea==='$id');if(!r)process.exit(1);console.log(r.name.toUpperCase())")
  out=$R/public/assets/open-plots/$id; mkdir -p "$out"
  src=$R/art/grid/round-27-billboards/$id.jpg
  magick "$src" -resize '1024x576!' -strip -quality 86 "$out/billboard.webp"
  magick "$src" -resize '480x270!' -strip -quality 78 "$R/src/shards/open-plots/thumbs/$id.jpg"
  # the name fills a fixed box, so the longest ("STARFALL OBSERVATORY") shrinks to fit the board
  magick -size 1536x512 xc:'#06131f' \
    -fill none -stroke '#46e6ff' -strokewidth 10 -draw 'rectangle 14,14 1521,497' \
    -stroke none -fill '#46e6ff' -font "$F" -pointsize 76 -gravity North -annotate +0+70 'OPEN PLOT · COMING SOON' \
    \( +pointsize -size 1320x190 -background none -fill '#ffffff' -font "$F" -gravity center label:"$name" \) -gravity South -geometry +0+70 -composite \
    -strip -quality 88 "$out/sign.webp"
  echo "$id: $(stat -f %z "$out/billboard.webp") / $(stat -f %z "$out/sign.webp") bytes"
done
