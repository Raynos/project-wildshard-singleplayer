#!/usr/bin/env bash
# post.sh — build.sh's post step for driftwood-isle/island (DRIFTWOOD-REMASTER X2, E52): the two lightmaps as WebP,
# desktop and phone (half size). Linear data in 8-bit WebP: Blender writes the WebP, this only resizes. build.sh has
# already meshopt'd island.glb and copied placements.bin + island.json. Env from build.sh: BUILD, BLENDER.
set -euo pipefail
DEST=public/assets/models/driftwood-blender
"$BLENDER" -b --factory-startup -noaudio --python-exit-code 1 --python-expr "
import bpy
for src, dst, size, q in [('lm-ao.png', 'lm-ao', 2048, 78), ('lm-bounce.png', 'lm-bounce', 1024, 90)]:
    for suffix, s in (('', size), ('.phone', size // 2)):
        img = bpy.data.images.load('$BUILD/' + src); img.colorspace_settings.name = 'Non-Color'
        if img.size[0] != s: img.scale(s, s)
        sc = bpy.context.scene; st = sc.render.image_settings
        st.file_format = 'WEBP'; st.quality = q; st.color_mode = 'RGB'
        sc.view_settings.view_transform = 'Standard'; sc.display_settings.display_device = 'sRGB'
        img.save_render('$DEST/' + dst + suffix + '.webp', scene=sc)
" >/dev/null 2>&1
