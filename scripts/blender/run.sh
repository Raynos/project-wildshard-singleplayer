#!/usr/bin/env bash
# run.sh — the Blender island pipeline, end to end (DRIFTWOOD-REMASTER X2, E52; per shard since PH-0.3).
#   pnpm blender:island [--chunk <slug>] [--quick] [--export-only]      (--chunk defaults to driftwood-isle)
#
#   1. scripts/blender/export-scene.mjs   the game's heights / colours / layout → ~/.cache/wildshard-blender/<slug>
#                                         (the shard's half: scripts/blender/shards/<slug>.mjs; its area: src/world/blenderArea.ts)
#   2. the shard's Blender builder        headless, Cycles on the Metal GPU: model, scatter, bake GI + AO, export
#                                         (driftwood-isle: build_island.py; a shard without one stops after step 1)
#   3. compress                           meshopt (gltf-transform), lightmaps → WebP (desktop 2048 / phone 1024)
#   4. copy into public/assets/models/<slug>-blender/ (Driftwood: driftwood-blender/, as blenderModelsBase() says — loaded by
#      src/world/BlenderIsland.ts under ?island=blender)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
SLUG=driftwood-isle
EXPORT_ONLY=0
PASS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --chunk) SLUG="${2:?--chunk needs a shard slug}"; shift 2 ;;
    --chunk=*) SLUG="${1#--chunk=}"; shift ;;
    --export-only) EXPORT_ONLY=1; shift ;;
    *) PASS+=("$1"); shift ;;
  esac
done
case "$SLUG" in
  driftwood-isle) BUILDER=scripts/blender/build_island.py; DIR=driftwood-blender ;;
  *) BUILDER=""; DIR="$SLUG-blender" ;;  # pine-hollow: the Blender build is wave 2 (PINE-HOLLOW-REMASTER PH-U17)
esac
CACHE="${BLENDER_CACHE:-$HOME/.cache/wildshard-blender}/$SLUG"
BUILD="$CACHE/build"
DEST="public/assets/models/$DIR"
BLENDER="${BLENDER:-$(command -v blender || echo /opt/homebrew/bin/blender)}"
mkdir -p "$CACHE" "$BUILD"

node --experimental-transform-types --no-warnings --import ./scripts/bake-loader.mjs scripts/blender/export-scene.mjs --chunk "$SLUG" "$CACHE"
if [ "$EXPORT_ONLY" = 1 ] || [ -z "$BUILDER" ]; then
  [ -z "$BUILDER" ] && echo "run.sh: no Blender builder for $SLUG yet — exported $CACHE only (nothing written to $DEST)"
  exit 0
fi
mkdir -p "$DEST"
"$BLENDER" -b --factory-startup -P "$BUILDER" -- "$CACHE" "$BUILD" ${PASS[@]+"${PASS[@]}"} 2>&1 | grep -E '^\[island|Error|Traceback|  File|Exception' || true
test -s "$BUILD/island.glb" || { echo "run.sh: Blender produced no island.glb" >&2; exit 1; }

# meshopt: quantised + filtered vertex streams (three's GLTFLoader decodes it with MeshoptDecoder)
pnpm exec gltf-transform meshopt "$BUILD/island.glb" "$DEST/island.glb" --level medium >/dev/null
# lightmaps: linear data in 8-bit WebP (Blender writes the WebP; run.sh only resizes)
"$BLENDER" -b --factory-startup --python-expr "
import bpy, sys
for src, dst, size, q in [('lm-ao.png', 'lm-ao', 2048, 78), ('lm-bounce.png', 'lm-bounce', 1024, 90)]:
    for suffix, s in (('', size), ('.phone', size // 2)):
        img = bpy.data.images.load('$BUILD/' + src); img.colorspace_settings.name = 'Non-Color'
        if img.size[0] != s: img.scale(s, s)
        sc = bpy.context.scene; st = sc.render.image_settings
        st.file_format = 'WEBP'; st.quality = q; st.color_mode = 'RGB'
        sc.view_settings.view_transform = 'Standard'; sc.display_settings.display_device = 'sRGB'
        img.save_render('$DEST/' + dst + suffix + '.webp', scene=sc)
" >/dev/null 2>&1
cp "$BUILD/placements.bin" "$BUILD/island.json" "$DEST/"
ls -la "$DEST"
