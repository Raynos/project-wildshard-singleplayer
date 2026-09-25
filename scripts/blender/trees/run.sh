#!/usr/bin/env bash
# run.sh — Pine Hollow's Blender species set (PINE-HOLLOW-REMASTER PH-B4), end to end.
#   bash scripts/blender/trees/run.sh [--quick] [--only=bark,cards,trees,lineup] [--no-copy]
#
#   1. build_trees.py (Blender 5.2, headless, Cycles on the Metal GPU) → ~/.cache/wildshard-blender/trees/build/
#      under the machine-wide model lock (~/projects/localai/.model.lock): it waits for a running model job
#   2. compress: trees.glb → meshopt (gltf-transform); the atlases → PNG (albedo, alpha kept) / JPEG q88 (normal, ARM);
#      the phone tier's .phone.webp copies at half size (tierUrl picks them)
#   3. copy: public/assets/models/pine-hollow-trees/ (+ trees.json, the specs the game's placement checks) and the new
#      bark sets public/assets/tex/{fir_bark,metasequoia_bark,birch_bark,bark_willow_02}/ with their .phone.webp copies
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BUILD="${TREES_BUILD:-$HOME/.cache/wildshard-blender/trees/build}"
DEST=public/assets/models/pine-hollow-trees
BLENDER="${BLENDER:-$(command -v blender || echo /opt/homebrew/bin/blender)}"
COPY=1
PASS=()
for a in "$@"; do
  case "$a" in
    --no-copy) COPY=0 ;;
    *) PASS+=("$a") ;;
  esac
done
mkdir -p "$BUILD"
lockf -k "$HOME/projects/localai/.model.lock" "$BLENDER" -b --factory-startup -P scripts/blender/trees/build_trees.py -- "$BUILD" ${PASS[@]+"${PASS[@]}"} 2>&1 \
  | grep -E '^\[trees|Error|Traceback|  File|Exception' || true
test -s "$BUILD/trees.glb" || { echo "run.sh: Blender produced no trees.glb" >&2; exit 1; }
[ "$COPY" = 1 ] || exit 0

mkdir -p "$DEST"
# meshopt: quantised + filtered streams (three's GLTFLoader decodes it with MeshoptDecoder; src/world/treeSet.ts undoes
# the quantisation into plain float geometry)
pnpm exec gltf-transform meshopt "$BUILD/trees.glb" "$DEST/trees.glb" --level medium >/dev/null
cp "$BUILD/trees.json" "$DEST/"
# the albedo atlases (alpha = the cut-out): palette PNGs (pngquant, 80–95 quality) — a fifth of the bytes, no visible loss
for f in cards-albedo impostor-albedo; do pngquant --quality 80-95 --speed 1 --force --output "$DEST/$f.png" "$BUILD/$f.png"; done
magick "$BUILD/cards-normal.png" -quality 88 -sampling-factor 1x1 "$DEST/cards-normal.jpg"
magick "$BUILD/cards-arm.png" -quality 86 "$DEST/cards-arm.jpg"
magick "$BUILD/impostor-normal.png" -quality 88 -sampling-factor 1x1 "$DEST/impostor-normal.jpg"
# phone: half size WebP (alpha lossless-exact under the cut-out: bilinear and the mips read the bled colour)
for f in cards-albedo impostor-albedo; do
  magick "$BUILD/$f.png" -resize 50% "$BUILD/$f.half.png"
  cwebp -quiet -q 82 -alpha_q 100 -exact -sharp_yuv "$BUILD/$f.half.png" -o "$DEST/$f.phone.webp"
done
for f in cards-normal cards-arm impostor-normal; do
  magick "$BUILD/$f.png" -resize 50% "$BUILD/$f.half.png"
  cwebp -quiet -q 80 "$BUILD/$f.half.png" -o "$DEST/$f.phone.webp"
done
for id in fir_bark metasequoia_bark birch_bark bark_willow_02; do
  mkdir -p "public/assets/tex/$id"
  magick "$BUILD/tex/$id/diffuse.png" -quality 86 "public/assets/tex/$id/diffuse.jpg"
  magick "$BUILD/tex/$id/nor_gl.png" -quality 88 -sampling-factor 1x1 "public/assets/tex/$id/nor_gl.jpg"
  magick "$BUILD/tex/$id/arm.png" -quality 86 "public/assets/tex/$id/arm.jpg"
  # the phone's copies at 512² — the phone's bark array layer size (TIER_CONFIG.layerSize): no texel downloaded to be
  # scaled away (scripts/tex-tiers.mjs is not run here: it prunes other lanes' phone copies)
  for k in diffuse nor_gl arm; do
    magick "$BUILD/tex/$id/$k.png" -resize 512x512 "$BUILD/tex/$id/$k.half.png"
    cwebp -quiet -q "$([ $k = nor_gl ] && echo 82 || echo 76)" -sharp_yuv "$BUILD/tex/$id/$k.half.png" -o "public/assets/tex/$id/$k.phone.webp"
  done
done
ls -la "$DEST"
