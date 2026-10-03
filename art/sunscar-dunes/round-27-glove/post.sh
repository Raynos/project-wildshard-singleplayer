#!/usr/bin/env bash
# post.sh <in.glb> <out.glb>: glove-hd4's post (round 27): weld, simplify to ~18 k triangles, the paint resized to 1024
# WebP, meshopt; the same steps as glove-hd3 (round 23)
set -e
IN=$1; OUT=$2; T=$(mktemp -d)
cd /Users/raynos/projects/games/wildshard-singleplayer
pnpm exec gltf-transform weld "$IN" "$T/a.glb"
pnpm exec gltf-transform simplify "$T/a.glb" "$T/b.glb" --ratio 0.3 --error 0.002
pnpm exec gltf-transform resize "$T/b.glb" "$T/c.glb" --width 1024 --height 1024
pnpm exec gltf-transform webp "$T/c.glb" "$T/d.glb" --quality 88
pnpm exec gltf-transform meshopt "$T/d.glb" "$OUT" --level medium
pnpm exec gltf-transform inspect "$OUT" 2>/dev/null | grep -E "renderVertexCount|uploadVRAM|size" | head -6
rm -rf "$T"
