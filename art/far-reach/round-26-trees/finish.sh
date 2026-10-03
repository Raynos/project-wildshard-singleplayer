#!/usr/bin/env bash
# Top-10 row 2: the Hunyuan3D-2 trees -> game GLBs in public/assets/far-reach/models/trees/ (6k tris, 512 WebP map,
# meshopt) and a turntable sheet each here.   bash finish.sh [names...]
set -euo pipefail
export GLTF_TRANSFORM=${GLTF_TRANSFORM:-/Users/raynos/projects/games/wildshard-singleplayer/node_modules/.bin/gltf-transform}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
RAW=$HOME/ml/img2mesh/out/far-reach-trees
OUT="$REPO/public/assets/far-reach/models/trees"
TRIS=${TRIS:-6000} TEX=${TEX:-512}
mkdir -p "$OUT"
for name in ${@:-pine-tall pine-wide pine-young oak bush}; do
  ref="$HERE/refs/ref-$name.jpg"; [ -f "$ref" ] || ref="$HERE/refs/ref-$name.png"
  bash ~/projects/localai/bin/img2mesh/finish.sh "tree-$name" "$RAW/ref-$name.glb" "$TRIS" 10 0 "$ref" "$OUT" 0 "$TEX" | grep -E "post\].*tris|rror" || true
  python3 -c "import shutil,sys; shutil.move(sys.argv[1], sys.argv[2])" "$OUT/tree-$name-turntable.jpg" "$HERE/turntable-$name.jpg"
  rm -f "$OUT/tree-$name.phone.glb" "$OUT/tree-$name.json"
done
ls -la "$OUT"
