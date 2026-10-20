#!/usr/bin/env bash
# The billboard and sign art of open-plots ideas (G541), from src/shards/open-plots/data/ideas.json.
#   bash scripts/open-plots/make-art.sh <idea> [<idea> ...]
# billboard.webp: the round-27 billboard (else the G529 picture) at 1024 x 576, WebP <= 250 KB.
# sign.webp: 'OPEN PLOT · COMING SOON' over the idea's name, 1536 x 512.
set -euo pipefail
R=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
F=/System/Library/Fonts/Helvetica.ttc
for id in "$@"; do
  name=$(node -e "const d=require('$R/src/shards/open-plots/data/ideas.json');const r=d.ideas.find(i=>i.id==='$id');if(!r)process.exit(1);console.log(r.name.toUpperCase())")
  out=$R/public/assets/open-plots/$id; mkdir -p "$out"
  src=$R/art/grid/round-27-billboards/$id.jpg; [ -f "$src" ] || src=$R/public/assets/grid/open-plot/$id.webp
  magick "$src" -resize '1024x576!' -strip -quality 86 "$out/billboard.webp"
  magick -size 1536x512 xc:'#06131f' \
    -fill none -stroke '#46e6ff' -strokewidth 10 -draw 'rectangle 14,14 1521,497' \
    -stroke none -fill '#46e6ff' -font "$F" -pointsize 76 -gravity North -annotate +0+70 'OPEN PLOT · COMING SOON' \
    -fill '#ffffff' -pointsize 170 -gravity South -annotate +0+70 "$name" \
    -strip -quality 88 "$out/sign.webp"
  ls -la "$out"
done
