#!/usr/bin/env bash
# Top-10 row 1: the six Hunyuan3D-2 islands -> game GLBs (finish.sh: decimate to TRIS, re-UV, bake the paint to a TEX map,
# WebP, meshopt) in public/assets/far-reach/models/isle-<name>-hd/, plus a turntable sheet each in this round's folder.
#   bash finish.sh [names...]     (default: all six)
set -euo pipefail
export GLTF_TRANSFORM=${GLTF_TRANSFORM:-/Users/raynos/projects/games/wildshard-singleplayer/node_modules/.bin/gltf-transform}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
RAW=$HOME/ml/img2mesh/out/far-reach-isles2
TRIS=${TRIS:-12000} TEX=${TEX:-1024}
for n in "${@:-mass canopy falls spire twin shelf}"; do
  for name in $n; do
    out="$REPO/public/assets/far-reach/models/isle-$name-hd"
    bash ~/projects/localai/bin/img2mesh/finish.sh "isle-$name-hd" "$RAW/ref-$name.glb" "$TRIS" 10 0 "$HERE/refs/ref-$name.jpg" "$out" 0 "$TEX"
    mv "$out/isle-$name-hd-turntable.jpg" "$HERE/turntable-$name.jpg"
    rm -f "$out/isle-$name-hd.phone.glb" "$out/isle-$name-hd.json"
    ls -la "$out"
  done
done
