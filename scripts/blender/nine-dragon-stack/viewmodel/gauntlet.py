"""gauntlet.py — lab P8 "viewmodel" (E169): the Fei Zhua gauntlet on the wrapped, cord-bound LEFT forearm, with the
three folded talons, modelled in Blender headless and baked for the lab's Jiehua Neon viewmodel program.

  blender -b --factory-startup --python gauntlet.py -- <scratch dir> [--no-bake] [--size=2048] [--samples=64]
  python3 gauntlet_maps.py <scratch dir> <public dir>          # the two maps from the raw passes
  blender -b <scratch>/gauntlet.blend --python gauntlet_preview.py -- <scratch dir> <public dir> <tag>

Contract: $SP/vm/SPEC.md (GAUNTLET-local glTF frame; material NAME = shading class; `claw` its own node; maps =
R AO · G curvature · B albedo detail, + an object-space normal map in Blender's frame).

Passes baked here (float, one shared atlas for both objects, written as .npy for gauntlet_maps.py):
  nrm  object-space normal of the game mesh (smooth / split shading, no detail — the detail is added in numpy)
  ao   Cycles AO, distance 2 cm
  pos  object-space position ×0.5 + 0.5 (the maps script evaluates every pattern at the texel's 3D point)
  id   the part tag index / 64 (which pattern a texel gets)
  cv   (edge, crease): 1 − N·bevel(1.5 mm) and 1 − AO(4 mm) — the curvature channel is built from both
Then the objects get their class materials and are exported (glTF, Y-up) → meshopt → public/.
"""
import json
import math
import os
import subprocess
import sys
import time

import bmesh
import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gauntlet_parts as parts  # noqa: E402
from gauntlet_geo import Acc, to_blender  # noqa: E402

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = {a[2:].split('=')[0]: (a.split('=', 1)[1] if '=' in a else True) for a in ARGV if a.startswith('--')}
POS = [a for a in ARGV if not a.startswith('--')]
SCRATCH = POS[0] if POS else '/tmp/gauntlet'
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
PUBLIC = os.path.join(REPO, 'public', 'assets', 'nine-dragon', 'lab', 'viewmodel')
SIZE = int(OPT.get('size', 2048))
SAMPLES = int(OPT.get('samples', 64))
os.makedirs(SCRATCH, exist_ok=True)

TAG_CLASS = {
    'sleeve': 'sleeve', 'trim': 'trim_red', 'piping': 'gold_thread', 'wrap': 'cloth_cream', 'flap': 'cloth_cream',
    'cord': 'silk_red', 'tassel': 'silk_red', 'tassel_cap': 'brass_dark', 'stitch': 'silk_red', 'carbon': 'carbon',
    'band': 'brass', 'strap': 'leather', 'buckle': 'brass_dark', 'rivet': 'brass', 'plate_top': 'brass',
    'plate_flank': 'brass', 'crest': 'brass', 'drum': 'brass_dark', 'line': 'steel', 'bolt': 'brass_dark',
    'collar': 'brass', 'front': 'brass_dark', 'glow': 'glow', 'pipe': 'brass_dark',
    'hub': 'brass', 'knuckle': 'brass_dark', 'clevis': 'brass_dark', 'pin': 'brass_dark', 'arm': 'brass',
    'blade': 'brass', 'ferrule': 'brass_dark', 'crown': 'brass', 'lug': 'brass_dark',
    'collar_band': 'brass_dark', 'ram': 'brass_dark', 'rod': 'steel',
}
TAGS = list(TAG_CLASS.keys())
SOFT = {'sleeve', 'trim', 'piping', 'wrap', 'flap', 'cord', 'tassel', 'stitch'}
LOW_PRIORITY = {'sleeve', 'trim', 'piping', 'wrap', 'flap', 'cord'}


def log(*a):
    print('[gauntlet]', *a, flush=True)


# ─────────────────────────── scene ───────────────────────────
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


_bake_mats = {}


def bake_mat(tag):
    """one material per tag while baking: its emission outputs are switched per pass"""
    if tag in _bake_mats:
        return _bake_mats[tag]
    m = bpy.data.materials.new(f'bk_{tag}')
    m.use_nodes = True
    _bake_mats[tag] = m
    return m


def make_object(name, acc, smooth_angle):
    """Acc → a Blender object (verts converted glTF → Blender), a face int attribute `tag`, doubles welded"""
    bm = bmesh.new()
    vs = [bm.verts.new(to_blender(p)) for p in acc.v]
    bm.verts.ensure_lookup_table()
    tl = bm.faces.layers.int.new('tag')
    ul = bm.loops.layers.uv.new('UVMap')
    for f, tag, uvs in zip(acc.f, acc.tags, acc.uv):
        if len(set(f)) < 3:
            continue
        try:
            face = bm.faces.new([vs[i] for i in f])
        except ValueError:
            continue
        face[tl] = TAGS.index(tag)
        for lp, uv in zip(face.loops, uvs):
            lp[ul].uv = uv
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-7)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-9, edges=bm.edges)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    # material slots by tag
    tags_here = sorted(set(v.value for v in me.attributes['tag'].data))
    slot = {}
    for t in tags_here:
        me.materials.append(bake_mat(TAGS[t]))
        slot[t] = len(me.materials) - 1
    tv = [v.value for v in me.attributes['tag'].data]
    me.polygons.foreach_set('material_index', [slot[t] for t in tv])
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    return ob


def join(obs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


def build():
    soft, hard, claw = Acc('soft'), Acc('hard'), Acc('claw')
    parts.build_sleeve(soft)
    parts.build_wraps(soft)
    end = parts.build_cord(soft)
    parts.build_knot_tassel(soft, end)
    parts.build_gauntlet(hard)
    parts.build_claw(claw)
    o_soft = make_object('soft', soft, 80)
    o_hard = make_object('hard', hard, 36)
    o_claw = make_object('claw', claw, 36)
    body = join([o_hard, o_soft], 'gauntlet')
    log(f'tris: gauntlet {tris(body)}, claw {tris(o_claw)}')
    hist = {}
    for o in (body, o_claw):
        me = o.data
        tv = [v.value for v in me.attributes['tag'].data]
        for poly in me.polygons:
            t = TAGS[tv[poly.index]]
            hist[t] = hist.get(t, 0) + len(poly.vertices) - 2
    log('tris by tag', sorted(hist.items(), key=lambda kv: -kv[1]))
    return body, o_claw


# ─────────────────────────── UVs ───────────────────────────
def unwrap(obs):
    """the parts carry metric UVs from construction (u, v in metres, one island per part / chunk): shrink the
    low-priority ones, then pack everything into one square atlas (uniform texel density, 8 px margins)"""
    for o in obs:
        me = o.data
        uv = me.uv_layers.active.data
        tv = [v.value for v in me.attributes['tag'].data]
        for poly in me.polygons:
            if TAGS[tv[poly.index]] in LOW_PRIORITY:
                for li in poly.loop_indices:
                    uv[li].uv = uv[li].uv * 0.7
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    t0 = time.time()
    try:
        bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method='FRACTION', margin=8.0 / SIZE, shape_method='CONCAVE')
    except TypeError:
        bpy.ops.uv.pack_islands(rotate=True, margin=8.0 / SIZE)
    bpy.ops.object.mode_set(mode='OBJECT')
    log(f'pack {time.time() - t0:.1f}s')


# ─────────────────────────── baking ───────────────────────────
def setup_cycles():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'METAL'
    sc.cycles.device = 'GPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = False
    sc.render.bake.margin = 12
    sc.render.bake.margin_type = 'EXTEND'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('bake')
    sc.world.use_nodes = True
    sc.world.light_settings.distance = 0.02


def set_pass(mat, kind, image, tag_index):
    """rebuild the bake material for one pass"""
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    img = nt.nodes.new('ShaderNodeTexImage')
    img.image = image
    nt.nodes.active = img
    if kind in ('nrm', 'ao'):
        bsdf = nt.nodes.new('ShaderNodeBsdfDiffuse')
        nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
        return
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    if kind == 'pos':
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mad = nt.nodes.new('ShaderNodeVectorMath')
        mad.operation = 'MULTIPLY_ADD'
        mad.inputs[1].default_value = (0.5, 0.5, 0.5)
        mad.inputs[2].default_value = (0.5, 0.5, 0.5)
        nt.links.new(tc.outputs['Object'], mad.inputs[0])
        nt.links.new(mad.outputs[0], em.inputs['Color'])
    elif kind == 'id':
        v = (tag_index + 0.5) / 64.0
        em.inputs['Color'].default_value = (v, v, v, 1.0)
    elif kind == 'cv':
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        bev = nt.nodes.new('ShaderNodeBevel')
        bev.samples = 16
        bev.inputs['Radius'].default_value = 0.0015
        dot = nt.nodes.new('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        nt.links.new(bev.outputs[0], dot.inputs[0])
        nt.links.new(geo.outputs['Normal'], dot.inputs[1])
        edge = nt.nodes.new('ShaderNodeMath')
        edge.operation = 'SUBTRACT'
        edge.inputs[0].default_value = 1.0
        nt.links.new(dot.outputs['Value'], edge.inputs[1])
        ao = nt.nodes.new('ShaderNodeAmbientOcclusion')
        ao.samples = 16
        ao.inputs['Distance'].default_value = 0.004
        crease = nt.nodes.new('ShaderNodeMath')
        crease.operation = 'SUBTRACT'
        crease.inputs[0].default_value = 1.0
        nt.links.new(ao.outputs['AO'], crease.inputs[1])
        comb = nt.nodes.new('ShaderNodeCombineXYZ')
        nt.links.new(edge.outputs[0], comb.inputs[0])
        nt.links.new(crease.outputs[0], comb.inputs[1])
        nt.links.new(comb.outputs[0], em.inputs['Color'])


def new_float_image(name):
    im = bpy.data.images.new(name, SIZE, SIZE, alpha=True, float_buffer=True)
    im.colorspace_settings.name = 'Non-Color'
    return im


def bake_passes(obs):
    setup_cycles()
    sc = bpy.context.scene
    res = {}
    for kind in ('nrm', 'pos', 'id', 'cv', 'ao'):
        im = new_float_image(f'pass_{kind}')
        for tag, m in _bake_mats.items():
            set_pass(m, kind, im, TAGS.index(tag))
        sc.cycles.samples = {'nrm': 4, 'pos': 1, 'id': 1, 'cv': 32, 'ao': SAMPLES}[kind]
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        t0 = time.time()
        kw = dict(type={'nrm': 'NORMAL', 'ao': 'AO'}.get(kind, 'EMIT'), margin=12, use_clear=True)
        if kind == 'nrm':
            kw.update(normal_space='OBJECT', normal_r='POS_X', normal_g='POS_Y', normal_b='POS_Z')
        if kind in ('id',):
            kw['margin'] = 0
        bpy.ops.object.bake(**kw)
        a = np.empty(SIZE * SIZE * 4, np.float32)
        im.pixels.foreach_get(a)
        a = a.reshape(SIZE, SIZE, 4)
        np.save(os.path.join(SCRATCH, f'pass_{kind}.npy'), a.astype(np.float32))
        res[kind] = a
        log(f'bake {kind} {SIZE}² {time.time() - t0:.1f}s')
    return res


# ─────────────────────────── export ───────────────────────────
PREVIEW_RGB = {
    'brass': (0x9c, 0x7c, 0x3a), 'brass_dark': (0x76, 0x59, 0x2a), 'steel': (0x19, 0x1c, 0x22), 'lacquer': (0x12, 0x13, 0x17),
    'leather': (0x1d, 0x1c, 0x20), 'glove': (0x24, 0x25, 0x2b), 'cloth_cream': (0xe4, 0xdd, 0xcc), 'sleeve': (0x2a, 0x2d, 0x38),
    'trim_red': (0xa8, 0x28, 0x1c), 'silk_red': (0xc2, 0x2d, 0x1e), 'carbon': (0x16, 0x17, 0x1b), 'glow': (0xd9, 0xfb, 0xff),
    'gold_thread': (0xc9, 0xa2, 0x4a),
}


def srgb2lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


_class_mats = {}


def class_mat(cls):
    if cls in _class_mats:
        return _class_mats[cls]
    m = bpy.data.materials.new(cls)
    m.use_nodes = True
    m.use_backface_culling = True  # → doubleSided false in the glTF
    b = m.node_tree.nodes.get('Principled BSDF')
    r, g, bb = (srgb2lin(x) for x in PREVIEW_RGB[cls])
    if b is not None:
        b.inputs['Base Color'].default_value = (r, g, bb, 1.0)
        metal = cls in ('brass', 'brass_dark', 'steel')
        b.inputs['Metallic'].default_value = 1.0 if metal else 0.0
        b.inputs['Roughness'].default_value = 0.38 if metal else 0.75
    _class_mats[cls] = m
    return m


def to_class_materials(ob):
    me = ob.data
    tv = [v.value for v in me.attributes['tag'].data]
    classes = sorted({TAG_CLASS[TAGS[t]] for t in tv})
    me.materials.clear()
    for c in classes:
        me.materials.append(class_mat(c))
    me.polygons.foreach_set('material_index', [classes.index(TAG_CLASS[TAGS[t]]) for t in tv])


def export(obs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_texcoords=True, export_normals=True,
              export_tangents=False, export_materials='EXPORT', export_yup=True, export_apply=True,
              export_attributes=False, export_extras=False, export_cameras=False, export_lights=False)
    try:
        bpy.ops.export_scene.gltf(export_vertex_color='NONE', **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)


def main():
    t0 = time.time()
    reset()
    body, claw = build()
    unwrap([body, claw])
    stats = {'gauntlet_tris': tris(body), 'claw_tris': tris(claw), 'size': SIZE}
    # the wraps' helix for the maps script
    json.dump({'WRAP': parts.WRAP, 'helix': parts.wrap_helix(40)}, open(os.path.join(SCRATCH, 'wrap.json'), 'w'))
    json.dump({'tags': TAGS, 'class': TAG_CLASS}, open(os.path.join(SCRATCH, 'tags.json'), 'w'))
    json.dump({'talons': parts.TALONS, 'spines': [parts.talon_curve(k, rs) for (_, rs, k) in parts.TALONS]},
              open(os.path.join(SCRATCH, 'claw.json'), 'w'))
    if 'no-bake' not in OPT:
        bake_passes([body, claw])
    # keep a copy with the tag materials for the preview script, then class materials for the export
    for o in (body, claw):
        to_class_materials(o)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SCRATCH, 'gauntlet.blend'))
    raw = os.path.join(SCRATCH, 'gauntlet.raw.glb')
    export([body, claw], raw)
    os.makedirs(PUBLIC, exist_ok=True)
    out = os.path.join(PUBLIC, 'gauntlet.glb')
    r = subprocess.run(['pnpm', 'exec', 'gltf-transform', 'meshopt', raw, out, '--level', 'medium'], cwd=REPO, capture_output=True, text=True)
    if r.returncode != 0:
        log('meshopt failed:', r.stderr[-800:])
    stats['glb_kb'] = round(os.path.getsize(out) / 1024, 1) if os.path.exists(out) else None
    json.dump(stats, open(os.path.join(SCRATCH, 'stats.json'), 'w'), indent=1)
    log('stats', stats, f'{time.time() - t0:.1f}s')


main()
