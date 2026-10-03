#!/usr/bin/env bash
# post.sh <in.glb> <out.glb> <ratio> <tex>: the camp models' post (round 28, glove-hd4's steps): weld, simplify to <ratio> of
# the 60 k faces, the paint resized to <tex> WebP, meshopt
set -e
IN=$1; OUT=$2; RATIO=$3; TEX=$4; T=$(mktemp -d)
cd /Users/raynos/projects/games/wildshard-singleplayer
pnpm exec gltf-transform weld "$IN" "$T/a.glb"
pnpm exec gltf-transform simplify "$T/a.glb" "$T/b.glb" --ratio "$RATIO" --error 0.002
pnpm exec gltf-transform resize "$T/b.glb" "$T/c.glb" --width "$TEX" --height "$TEX"
pnpm exec gltf-transform webp "$T/c.glb" "$T/d.glb" --quality 88
mkdir -p "$(dirname "$OUT")"
pnpm exec gltf-transform meshopt "$T/d.glb" "$OUT" --level medium
pnpm exec gltf-transform inspect "$OUT" 2>/dev/null | grep -E "renderVertexCount|uploadVRAM|size" | head -6
rm -rf "$T"
