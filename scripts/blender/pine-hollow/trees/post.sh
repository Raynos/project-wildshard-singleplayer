#!/usr/bin/env bash
# post.sh — build.sh's post step for pine-hollow/trees (PINE-HOLLOW-REMASTER PH-B4). build.sh has already meshopt'd
# trees.glb and copied trees.json (the specs the game's placement checks) into public/assets/models/pine-hollow-trees/.
#   - the atlases: albedo → palette PNG (pngquant 80–95, alpha = the cut-out: a fifth of the bytes, no visible loss),
#     normal / ARM → JPEG; the phone tier's .phone.webp copies at half size (tierUrl picks them)
#   - the four bark sets → public/assets/tex/{fir_bark,metasequoia_bark,birch_bark,bark_willow_02}/ + .phone.webp copies
# Env from build.sh: BUILD.
set -euo pipefail
DEST=public/assets/models/pine-hollow-trees
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
