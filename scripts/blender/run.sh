#!/usr/bin/env bash
# run.sh — the Blender island pipeline, end to end (DRIFTWOOD-REMASTER X2, E52).  `pnpm blender:island [--quick]`
#
#   1. scripts/blender/export-scene.mjs   the game's heights / colours / layout → ~/.cache/wildshard-blender
#   2. scripts/blender/build_island.py    Blender (headless, Cycles on the Metal GPU): model, scatter, bake GI + AO, export
#   3. compress                           meshopt (gltf-transform), lightmaps → WebP (desktop 2048 / phone 1024)
#   4. copy into public/assets/models/driftwood-blender/ (loaded by src/world/BlenderIsland.ts under ?island=blender)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
CACHE="${BLENDER_CACHE:-$HOME/.cache/wildshard-blender}"
BUILD="$CACHE/build"
DEST=public/assets/models/driftwood-blender
BLENDER="${BLENDER:-$(command -v blender || echo /opt/homebrew/bin/blender)}"
mkdir -p "$CACHE" "$BUILD" "$DEST"

node --experimental-transform-types --no-warnings --import ./scripts/bake-loader.mjs scripts/blender/export-scene.mjs "$CACHE"
"$BLENDER" -b --factory-startup -P scripts/blender/build_island.py -- "$CACHE" "$BUILD" "$@" 2>&1 | grep -E '^\[island|Error|Traceback|  File|Exception' || true
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
