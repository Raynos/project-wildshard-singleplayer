"""
build_crags.py — PH-B2's granite kit for the Ridge (PINE-HOLLOW-REMASTER PH-B2). Run by scripts/blender/crags/run.sh:

    blender -b --factory-startup -P scripts/blender/crags/build_crags.py -- <out dir> [--preview]

Builds, all from code (rocklib.py), a kit of jointed granite modules the game places over the heightfield
(src/world/PineCrags.ts): three cliff bands (columns split by vertical joints, sheeted into ledges, fallen blocks at the
foot), a buttress, an exfoliation slab, two tors for the crest, three boulders and two scree patches for the talus. Each
module has a LOD0 and a LOD1 (collapse-decimated) and Cycles vertex AO (4 m, on a ground plane) in its colour's R.

Vertex data (the game's crag material reads it): COLOR_0 = (AO, sun reach, wet, rock) — for the kit (AO, 1, 0, 1);
TEXCOORD_0 = (tint brightness, tint id), zero for rock (the cave's bedding and bones use it). No materials, no UVs for
textures: the game textures the granite triplanar in world space, so a module can be scaled and turned freely.

Output: <out>/crags.glb (a node per module per LOD: `<id>` and `<id>-lod1`, Blender −Y = the module's front = the game's
local +Z), <out>/crags.json (tris per LOD), and with --preview <out>/preview.png (every module, front three-quarter).
"""
import json
import math
import os
import random
import sys
import time

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rocklib as R  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0]
PREVIEW = '--preview' in argv
os.makedirs(OUT, exist_ok=True)
T0 = time.time()


def log(*a):
    print(f'[crags {time.time() - T0:6.1f}s]', *a, flush=True)


scene = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
if scene.world is None:
    scene.world = bpy.data.worlds.new('world')

# id, builder, (LOD0 tris, LOD1 tris), seed
KIT = [
    ('cliff-a', lambda r: R.cliff(r, 14, 11, 7), (3400, 760), 11),
    ('cliff-b', lambda r: R.cliff(r, 11, 8, 6, tiers=(1, 2)), (2600, 600), 23),
    ('cliff-c', lambda r: R.cliff(r, 16, 13.5, 8, tiers=(2, 3), step=1.2, foot=3), (3800, 820), 37),
    ('buttress', lambda r: R.buttress(r, 14, 6), (2600, 560), 41),
    ('slab', lambda r: R.slab(r, 9, 10), (2000, 460), 53),
    ('tor-a', lambda r: R.tor(r, 7.5), (2200, 480), 61),
    ('tor-b', lambda r: R.tor(r, 5), (1600, 380), 67),
    ('boulder-a', lambda r: R.boulder(r, 2.2), (420, 100), 71),
    ('boulder-b', lambda r: R.boulder(r, 1.4), (320, 80), 73),
    ('boulder-c', lambda r: R.boulder(r, 3.4), (520, 120), 79),
    ('scree-a', lambda r: R.scree(r, 6.5, 4.5, 38), (1500, 300), 83),
    ('scree-b', lambda r: R.scree(r, 4.5, 3.2, 24, big=0.55), (950, 200), 89),
]

objs, meta = [], {}
for k, (kid, build, (t0, t1), seed) in enumerate(KIT):
    rng = random.Random(seed)
    bm = build(rng)
    ob = R.bm_to_object(bm, kid, scene)
    raw = R.tri_count(ob)
    R.decimate(ob, t0)
    R.smooth_by_angle(ob, 38)
    lo = R.copy_object(ob, f'{kid}-lod1', scene)
    R.decimate(lo, t1)
    R.smooth_by_angle(lo, 45)
    ob.data.validate(clean_customdata=False); lo.data.validate(clean_customdata=False)
    # spread them out for the bake (each alone on its own patch of ground)
    off = Vector(((k % 4) * 60.0, (k // 4) * 60.0, 0))
    ob.location = off
    lo.location = off + Vector((0, 0, 400))
    objs += [ob, lo]
    v = R.vertex_array(ob)
    meta[kid] = {'raw': raw, 'lod0': R.tri_count(ob), 'lod1': R.tri_count(lo),
                 'min': [float(x) for x in v.min(0)], 'max': [float(x) for x in v.max(0)]}
    log(f'{kid}: raw {raw} → {meta[kid]["lod0"]} / {meta[kid]["lod1"]} tris; size {np.round(v.max(0) - v.min(0), 1).tolist()}')

# ground planes under each module (both LOD rows) for the contact AO
gm = bpy.data.meshes.new('ground')
gm.from_pydata([(-40, -40, 0), (260, -40, 0), (260, 220, 0), (-40, 220, 0)], [], [(0, 1, 2, 3)])
ground = bpy.data.objects.new('ground', gm)
scene.collection.objects.link(ground)
g2 = ground.copy(); g2.location.z = 400; scene.collection.objects.link(g2)
log('bake AO …')
ao = R.bake_vertex_ao(objs, 4.0, scene, samples=96)
for ob in objs:
    a = np.clip(ao[ob.name], 0, 1)
    rgba = np.stack([a, np.ones_like(a), np.zeros_like(a), np.ones_like(a)], 1)
    R.set_colors(ob, rgba)
    uv = ob.data.uv_layers.new(name='T')
    uv.data.foreach_set('uv', np.zeros(len(ob.data.loops) * 2, np.float32))
    meta[ob.name.replace('-lod1', '')]['ao' + ('1' if ob.name.endswith('-lod1') else '0')] = float(a.mean())
bpy.data.objects.remove(ground)
bpy.data.objects.remove(g2)


def preview():
    """every module (LOD0), grey granite × its AO, front three-quarter, on a 4 × 3 sheet"""
    mat = bpy.data.materials.new('prev')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    attr = nt.nodes.new('ShaderNodeAttribute'); attr.attribute_name = 'Col'; attr.attribute_type = 'GEOMETRY'
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 0.42
    nt.links.new(attr.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Red'], mul.inputs[0])
    nt.links.new(mul.outputs[0], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85
    for ob in objs:
        ob.data.materials.clear(); ob.data.materials.append(mat)
        ob.hide_render = ob.name.endswith('-lod1')
    fl = bpy.data.meshes.new('floor'); fl.from_pydata([(-40, -40, 0), (260, -40, 0), (260, 220, 0), (-40, 220, 0)], [], [(0, 1, 2, 3)])
    flo = bpy.data.objects.new('floor', fl); scene.collection.objects.link(flo)
    fmat = bpy.data.materials.new('floor'); fmat.use_nodes = True
    fmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.18, 0.2, 0.14, 1)
    fl.materials.append(fmat)
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; sun.angle = math.radians(2)
    so = bpy.data.objects.new('sun', sun); scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-35))
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.55, 0.65, 0.8, 1); bg.inputs['Strength'].default_value = 0.8
    cam = bpy.data.cameras.new('cam'); cam.lens = 35
    co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
    scene.render.resolution_x = 480; scene.render.resolution_y = 400
    scene.cycles.samples = 32
    scene.view_settings.view_transform = 'Standard'
    tiles = []
    for k, (kid, *_r) in enumerate(KIT):
        ob = bpy.data.objects[kid]
        c = Vector(((k % 4) * 60.0, (k // 4) * 60.0, 0))
        mx = meta[kid]['max']; mn = meta[kid]['min']
        size = max(mx[0] - mn[0], mx[2] - mn[2], 3)
        eye = c + Vector((size * 0.75, -size * 1.35, size * 0.55))
        co.location = eye
        d = (c + Vector((0, 0, (mx[2] - mn[2]) * 0.4))) - eye
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        for o in objs:
            o.hide_render = o.name != kid
        path = f'{OUT}/prev-{kid}.png'
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        tiles.append(path)
    return tiles


if PREVIEW:
    log('preview …')
    preview()
    for ob in objs:
        ob.data.materials.clear()
        ob.hide_render = False

# export: every module back at the origin
for ob in objs:
    ob.location = (0, 0, 0)
    ob.data.materials.clear()
bpy.ops.object.select_all(action='DESELECT')
for ob in objs:
    ob.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.export_scene.gltf(
    filepath=f'{OUT}/crags.glb', export_format='GLB', use_selection=True,
    export_normals=True, export_texcoords=True, export_materials='NONE', export_vertex_color='ACTIVE',
    export_all_vertex_colors=False, export_yup=True, export_apply=False, export_extras=False,
)
json.dump({'version': 1, 'modules': meta}, open(f'{OUT}/crags.json', 'w'), indent=1)
log('done', f'{OUT}/crags.glb')
