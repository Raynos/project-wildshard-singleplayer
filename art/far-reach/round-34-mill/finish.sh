#!/usr/bin/env bash
# Top-10 row 6 (E410): the Hunyuan3D-2 mill tower and its rock foot -> game GLBs (finish.sh: decimate, re-UV, bake the
# paint to a TEX map, WebP, meshopt) in public/assets/far-reach/models/mill/, plus a turntable sheet each here.
#   RAW=<hy3d out dir> bash finish.sh <tower|tower-b> [foot]
set -euo pipefail
export GLTF_TRANSFORM=${GLTF_TRANSFORM:-/Users/raynos/projects/games/wildshard-singleplayer/node_modules/.bin/gltf-transform}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
RAW=${RAW:?the hy3d_batch out dir}
TEX=${TEX:-1024}
out="$REPO/public/assets/far-reach/models/mill"
for src in "$@"; do
  case $src in tower*) name=mill-tower tris=12000 ;; *) name=mill-$src tris=8000 ;; esac
  bash ~/projects/localai/bin/img2mesh/finish.sh "$name" "$RAW/ref-$src.glb" "$tris" 10 0 "$HERE/refs/ref-$src.jpg" "$out" 0 "$TEX"
  mv "$out/$name-turntable.jpg" "$HERE/turntable-$src.jpg"
  rm -f "$out/$name.phone.glb" "$out/$name.json"
done
ls -la "$out"
