"""
build_crags_b.py — the Debug ▸ Look ▸ Crags **B** kit (E322 F-L2): the Ridge's big modules rebuilt as fused, weathered
masses, and the lookout's hero crag. Run by scripts/blender/build.sh pine-hollow/crags-b (targets.json):

    blender -b --factory-startup -P scripts/blender/pine-hollow/crags/build_crags_b.py -- <out dir> [--preview]

A's kit (build_crags.py) builds each cliff band from convex blocks stacked in columns and joined without a boolean: up
close the modules read as stacked blocks. Here the same blocks (rocklib, the same builders) are warped (the columns bend,
the top outline goes ragged), welded into ONE watertight mass by a voxel remesh, and weathered along their normals
(rocklib.weather: vertical joint cracks from a stretched Voronoi, sheeting ledges on the steep faces, a lumpy fractal),
then decimated to A's budgets. `hero` is new: a ~26 m granite prow for the fire lookout's view (src/world/PineCrags.ts
places it on the crest NE of the tower in B only).

Same contract as A (the game's crag material reads it): a node per module per LOD (`<id>`, `<id>-lod1`), COLOR_0 =
(AO, 1, 0, 1) from a Cycles vertex AO bake, TEXCOORD_0 zero, no materials, Blender −Y = the module's front. Only the
modules in KIT_B: the game overlays them on A's crags.glb (the boulders, the scree and the tors stay A's).

Output: <out>/crags-b.glb, <out>/crags-b.json, and with --preview <out>/prev-b-<id>.png.
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
NO_AO = '--no-ao' in argv
os.makedirs(OUT, exist_ok=True)
T0 = time.time()


def log(*a):
    print(f'[crags-b {time.time() - T0:6.1f}s]', *a, flush=True)


scene = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
if scene.world is None:
    scene.world = bpy.data.worlds.new('world')

# id, builder (A's, the same seeds), (LOD0 tris, LOD1 tris), seed, voxel (m), fracture planes, weather knobs
KIT_B = [
    ('cliff-a', lambda r: R.cliff(r, 14, 11, 7), (3900, 900), 11, 0.2, 12, {}),
    ('cliff-b', lambda r: R.cliff(r, 11, 8, 6, tiers=(1, 2)), (3200, 760), 23, 0.18, 10, {}),
    ('cliff-c', lambda r: R.cliff(r, 16, 13.5, 8, tiers=(2, 3), step=1.2, foot=3), (3950, 920), 37, 0.22, 14, {}),
    ('buttress', lambda r: R.buttress(r, 14, 6), (3200, 720), 41, 0.18, 10, {'joint': 2.6}),
    ('slab', lambda r: R.slab(r, 9, 10), (2600, 600), 53, 0.18, 6, {'ledge': 0.15, 'crack': 0.2}),
    ('hero', lambda r: R.monolith(r), (9000, 2200), 97, 0.3, 22, {'joint': 4.2, 'crack': 0.45, 'strata': 1.8, 'ledge': 0.4, 'lump': 0.2}),
]

objs, meta = [], {}
for k, (kid, build, (t0, t1), seed, voxel, chips, wk) in enumerate(KIT_B):
    rng = random.Random(seed)
    bm = build(rng)
    R.warp_bm(bm, random.Random(seed + 1000), amp=0.9 if kid != 'hero' else 1.4, freq=0.07 if kid != 'hero' else 0.045)
    ob = R.fuse(bm, kid, scene, voxel)
    raw = R.tri_count(ob)
    R.chip(ob, random.Random(seed + 3000), n=chips, depth=(0.3, 1.4) if kid != 'hero' else (0.6, 2.8), seg=0.5 if kid != 'hero' else 0.8)
    R.weather(ob, random.Random(seed + 2000), **{'lump': 0.14, **wk})
    R.decimate(ob, t0)
    R.smooth_by_angle(ob, 38)
    lo = R.copy_object(ob, f'{kid}-lod1', scene)
    R.decimate(lo, t1)
    R.smooth_by_angle(lo, 45)
    ob.data.validate(clean_customdata=False); lo.data.validate(clean_customdata=False)
    off = Vector(((k % 3) * 80.0, (k // 3) * 80.0, 0))
    ob.location = off
    lo.location = off + Vector((0, 0, 400))
    objs += [ob, lo]
    v = R.vertex_array(ob)
    meta[kid] = {'raw': raw, 'lod0': R.tri_count(ob), 'lod1': R.tri_count(lo),
                 'min': [float(x) for x in v.min(0)], 'max': [float(x) for x in v.max(0)]}
    log(f'{kid}: fused {raw} → {meta[kid]["lod0"]} / {meta[kid]["lod1"]} tris; size {np.round(v.max(0) - v.min(0), 1).tolist()}')

gm = bpy.data.meshes.new('ground')
gm.from_pydata([(-50, -50, 0), (230, -50, 0), (230, 150, 0), (-50, 150, 0)], [], [(0, 1, 2, 3)])
ground = bpy.data.objects.new('ground', gm)
scene.collection.objects.link(ground)
g2 = ground.copy(); g2.location.z = 400; scene.collection.objects.link(g2)
if NO_AO:
    ao = {ob.name: np.ones(len(ob.data.vertices), np.float32) for ob in objs}
else:
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
    """every module (LOD0), grey granite × its AO, front three-quarter"""
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
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; sun.angle = math.radians(2)
    so = bpy.data.objects.new('sun', sun); scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-35))
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.55, 0.65, 0.8, 1); bg.inputs['Strength'].default_value = 0.8
    cam = bpy.data.cameras.new('cam'); cam.lens = 35
    co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
    scene.render.engine = 'CYCLES'
    scene.render.resolution_x = 480; scene.render.resolution_y = 400
    scene.cycles.samples = 24
    scene.view_settings.view_transform = 'Standard'
    for k, (kid, *_r) in enumerate(KIT_B):
        c = Vector(((k % 3) * 80.0, (k // 3) * 80.0, 0))
        mx = meta[kid]['max']; mn = meta[kid]['min']
        size = max(mx[0] - mn[0], mx[2] - mn[2], 3)
        eye = c + Vector((size * 0.75, -size * 1.35, size * 0.55))
        co.location = eye
        d = (c + Vector((0, 0, (mx[2] - mn[2]) * 0.4))) - eye
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        for o in objs:
            o.hide_render = o.name != kid
        scene.render.filepath = f'{OUT}/prev-b-{kid}.png'
        bpy.ops.render.render(write_still=True)


if PREVIEW:
    log('preview …')
    preview()
    for ob in objs:
        ob.data.materials.clear()
        ob.hide_render = False

for ob in objs:
    ob.location = (0, 0, 0)
    ob.data.materials.clear()
bpy.ops.object.select_all(action='DESELECT')
for ob in objs:
    ob.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.export_scene.gltf(
    filepath=f'{OUT}/crags-b.glb', export_format='GLB', use_selection=True,
    export_normals=True, export_texcoords=True, export_materials='NONE', export_vertex_color='ACTIVE',
    export_all_vertex_colors=False, export_yup=True, export_apply=False, export_extras=False,
)
json.dump({'version': 1, 'modules': meta}, open(f'{OUT}/crags-b.json', 'w'), indent=1)
log('done', f'{OUT}/crags-b.glb')
