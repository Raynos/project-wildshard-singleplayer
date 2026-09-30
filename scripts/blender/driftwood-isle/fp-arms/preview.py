"""preview.py — render gate.mjs's posed PLYs (rig space) from the viewmodel's canonical camera (70° vertical, the
402×874 portrait) and from the side of the right hand: the look check before the game (E334).

    blender -b --factory-startup -noaudio --python-exit-code 1 -P scripts/blender/driftwood-isle/fp-arms/preview.py -- <ply dir> <out dir>

Workbench, flat shading, the vertex colours, a sky-blue backdrop; rig space (x right, y up, −z forward) → Blender
(x, −z, y).
"""
import bpy
import math
import os
import sys

from mathutils import Euler, Vector

ARGV = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = ARGV[0], ARGV[1]
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading
sh.light = 'STUDIO'
sh.color_type = 'VERTEX'
sh.show_cavity = False
sh.background_type = 'VIEWPORT'
sh.background_color = (0.42, 0.68, 0.92)
sc.world = bpy.data.worlds.new('w')
sc.view_settings.view_transform = 'Standard'
cam = bpy.data.cameras.new('c')
co = bpy.data.objects.new('c', cam)
sc.collection.objects.link(co)
sc.camera = co
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.ply'):
        continue
    for o in list(sc.objects):
        if o.type == 'MESH':
            bpy.data.objects.remove(o)
    bpy.ops.wm.ply_import(filepath=os.path.join(SRC, f), forward_axis='Y', up_axis='Z')
    ob = bpy.context.selected_objects[0]
    ob.rotation_euler = Euler((math.radians(90), 0, 0))    # rig (x, y, z) → Blender (x, −z, y)
    for p in ob.data.polygons:
        p.use_smooth = False
    name = f[:-4]
    # the eye: the canonical viewmodel camera
    co.location = (0, 0, 0)
    co.rotation_euler = Euler((math.radians(90), 0, 0))
    cam.type = 'PERSP'
    cam.sensor_fit = 'VERTICAL'
    cam.angle_y = math.radians(70)
    cam.clip_start = 0.01
    sc.render.resolution_x, sc.render.resolution_y = 402, 874
    sc.render.filepath = os.path.join(OUT, f'{name}-eye.png')
    bpy.ops.render.render(write_still=True)
    # the right hand from in front (looking back at the eye), a little above
    h = Vector((0.16, 0.58, -0.26))
    cam.type = 'ORTHO'
    cam.ortho_scale = 0.30
    sc.render.resolution_x, sc.render.resolution_y = 600, 600
    co.location = h + Vector((0, 0.6, 0.25))
    co.rotation_euler = Euler((math.radians(68), 0, math.radians(180)))
    sc.render.filepath = os.path.join(OUT, f'{name}-side.png')
    bpy.ops.render.render(write_still=True)
print('[preview] done', flush=True)
