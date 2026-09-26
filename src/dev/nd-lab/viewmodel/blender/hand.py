# hand.py — lab P8 "viewmodel" (E169): the first-person gloved hands, built headless in Blender 5.2.
#
#   /opt/homebrew/bin/blender -b --factory-startup --python src/dev/nd-lab/viewmodel/blender/hand.py -- \
#       --out public/assets/nine-dragon/lab/viewmodel --scratch <dir> [--only arm-r,hand-r,fist-l] [--voxel 0.0005]
#       [--tex 1024] [--tag n] [--no-export]
#
# Writes, per asset (hand-r, arm-r, fist-l), into --out:
#   <asset>.glb        glTF Y-up metres, ONE mesh, material NAME = the lab's shading class, TEXCOORD_0 into one atlas,
#                      meshopt-compressed (gltf-transform meshopt --level medium); no images inside
#   <asset>-maps.webp  R = AO (1 open), G = curvature (0.5 flat, 1 convex, 0 crease), B = albedo detail (0.5 neutral)
#   <asset>-nrm.webp   object-space normals in BLENDER axes (the lab converts (x, y, z) → glTF (x, z, −y));
#                      both maps are laid out like any glTF texture (flipY = false in three.js)
# and previews into --scratch.
#
# How: the organic parts are signed distances (hand_model.py: phalanges as IQ round cones flattened dorsal-palmar,
# hard-min between the fingers so their creases read, smooth-min into the palm, the grip subtracted so the palm hugs it,
# seams and wrinkles as dents), meshed by OpenVDB at 0.5 mm = the HIGH poly. The cuff, trim, piping, strap, buckle,
# studs, sleeve and cords are parametric tubes at two resolutions (hand_parts.py). The GAME mesh of an SDF part is a
# Decimate (collapse) of its high; the game meshes are joined and Smart-UV-projected into one atlas; Cycles on the Metal
# GPU bakes high → game: object-space normals, AO, and an emission pass that carries (curvature, detail) painted on the
# high-poly vertices.
import sys
import os
import math
import time
import argparse
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector, Matrix  # noqa: E402

import hand_lib as L  # noqa: E402
import hand_parts as HP  # noqa: E402
from hand_model import Hand  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='public/assets/nine-dragon/lab/viewmodel')
ap.add_argument('--scratch', default='/tmp/hand')
ap.add_argument('--only', default='arm-r,hand-r,fist-l')
ap.add_argument('--voxel', type=float, default=0.0005)
ap.add_argument('--tex', type=int, default=1024)
ap.add_argument('--tag', default='0')
ap.add_argument('--no-export', action='store_true')
ap.add_argument('--samples', type=int, default=96)
args = ap.parse_args(argv)
os.makedirs(args.scratch, exist_ok=True)
os.makedirs(args.out, exist_ok=True)
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))

T0 = time.time()


def log(*a):
    print(f'[hand {time.time() - T0:6.1f}s]', *a, flush=True)


# ───────────────────────────── frames ─────────────────────────────
# HAND → JIAN (glTF axes): a rotation about Y. Columns: hand +X (back of the hand) → (−0.8, 0, −0.6); +Y → +Y;
# hand +Z (toward the wrist) → (0.6, 0, −0.8). The forearm (0, −0.655, 0.756) lands on JIAN d = (0.454, −0.655, −0.605).
R_HJ = np.array([[-0.8, 0.0, 0.6], [0.0, 1.0, 0.0], [-0.6, 0.0, -0.8]])
# glTF (x, y, z) → Blender (x, −z, y)
R_GB = np.array([[1.0, 0.0, 0.0], [0.0, 0.0, -1.0], [0.0, 1.0, 0.0]])
E_JIAN = L.norm(L.v3(-0.08, -0.75, 0.67))
UP_JIAN = L.norm(L.v3(0.272, 0.351, 0.896))
D_JIAN = L.norm(L.v3(0.45, -0.65, -0.6))
E_GAUNTLET = L.norm(L.v3(1.06, 0.38, 0.35))


def to_blender(p_gltf):
    return np.asarray(p_gltf, dtype=np.float64) @ R_GB.T


# ───────────────────────────── scene helpers ─────────────────────────────

MAT_COL = {
    'glove': (0.030, 0.030, 0.036), 'leather': (0.022, 0.018, 0.016), 'brass': (0.55, 0.40, 0.14), 'brass_dark': (0.30, 0.21, 0.08),
    'trim_red': (0.42, 0.035, 0.025), 'gold_thread': (0.72, 0.52, 0.18), 'sleeve': (0.022, 0.028, 0.048), 'silk_red': (0.52, 0.045, 0.03),
    'steel': (0.05, 0.05, 0.06), 'lacquer': (0.012, 0.012, 0.014),
}


def material(name):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        c = MAT_COL.get(name, (0.5, 0.5, 0.5))
        m.diffuse_color = (c[0], c[1], c[2], 1.0)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        if bsdf is not None:
            bsdf.inputs['Base Color'].default_value = (c[0], c[1], c[2], 1.0)
            bsdf.inputs['Roughness'].default_value = 0.55
            if name.startswith('brass') or name == 'gold_thread':
                bsdf.inputs['Metallic'].default_value = 1.0
                bsdf.inputs['Roughness'].default_value = 0.35
    return m


def make_obj(name, verts_gltf, faces, mat, attrs=None, smooth=True, coll=None):
    """verts in glTF axes → a Blender object in Blender axes; attrs: {name: (N, 3) per-vertex floats}"""
    vb = to_blender(verts_gltf)
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in vb], [], [tuple(int(i) for i in f) for f in faces])
    me.validate(clean_customdata=False)
    me.update()
    ob = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    me.materials.append(material(mat))
    if smooth:
        me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), dtype=bool))
    if attrs:
        for k, val in attrs.items():
            val = np.asarray(val, dtype=np.float64)
            if len(val) != len(me.vertices):
                log(f'  attr {k} skipped on {name}: {len(val)} vs {len(me.vertices)} verts (validate merged some)')
                continue
            ca = me.color_attributes.new(k, 'FLOAT_COLOR', 'POINT')
            rgba = np.concatenate([val, np.ones((len(val), 1))], axis=1).astype(np.float32)
            ca.data.foreach_set('color', rgba.reshape(-1))
    return ob


def select_only(obs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active if active is not None else (obs[0] if obs else None)


def tri_faces(faces):
    out = []
    for f in faces:
        for i in range(1, len(f) - 1):
            out.append((f[0], f[i], f[i + 1]))
    return np.asarray(out, dtype=np.int64)


def fast_normals(v, tris):
    a, b, c = v[tris[:, 0]], v[tris[:, 1]], v[tris[:, 2]]
    fn = np.cross(b - a, c - a)
    n = np.zeros_like(v)
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def fast_edges(tris):
    e = np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]])
    e.sort(axis=1)
    return np.unique(e, axis=0)


def curvature_G(v, faces, scale=150.0, smooth=2):
    """0.5 flat, → 1 convex, → 0 concave (a crease): tanh of the discrete mean curvature (1/m) / scale"""
    t = tri_faces(faces)
    n = fast_normals(v, t)
    e = fast_edges(t)
    k = L.mean_curvature(v, n, e)
    k = L.ring_smooth(k, e, smooth)
    return 0.5 + 0.5 * np.tanh(k / scale)


# ───────────────────────────── bake + export one asset ─────────────────────────────

def setup_cycles():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception as ex:  # noqa: BLE001
        log('no Metal GPU, CPU bake', ex)
    sc.cycles.samples = args.samples
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.light_settings.distance = 0.02


def new_image(name, size):
    img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    return img


def set_bake_target(low, img):
    for slot in low.material_slots:
        m = slot.material
        nt = m.node_tree
        node = nt.nodes.get('BAKE_TARGET')
        if node is None:
            node = nt.nodes.new('ShaderNodeTexImage')
            node.name = 'BAKE_TARGET'
        node.image = img
        nt.nodes.active = node


def clear_bake_target(low):
    for slot in low.material_slots:
        nt = slot.material.node_tree
        node = nt.nodes.get('BAKE_TARGET')
        if node is not None:
            nt.nodes.remove(node)


def emit_material():
    m = bpy.data.materials.get('BAKE_EMIT')
    if m is not None:
        return m
    m = bpy.data.materials.new('BAKE_EMIT')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    at = nt.nodes.new('ShaderNodeAttribute')
    at.attribute_name = 'bake'
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(at.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


def img_pixels(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def save_png(arr_rgb, path):
    """(H, W, 3) floats 0..1 in Blender row order (bottom-up) → an 8-bit Non-Color PNG"""
    h, w, _ = arr_rgb.shape
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    rgba = np.concatenate([np.clip(arr_rgb, 0, 1), np.ones((h, w, 1), dtype=np.float32)], axis=2)
    img.pixels.foreach_set(rgba.astype(np.float32).reshape(-1))
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def to_webp(png, webp, q, sharp=False):
    cmd = ['cwebp', '-quiet', '-q', str(q), '-m', '6']
    if sharp:
        cmd += ['-sharp_yuv']
    subprocess.run(cmd + [png, '-o', webp], check=True)


def build_asset(asset, parts, R_to_gltf, mirror_x=False, tex=1024, hide=()):
    """parts (hand_parts dicts) in their frame → high + low objects (glTF axes via R_to_gltf) → bakes → files"""
    coll = bpy.data.collections.new(asset)
    bpy.context.scene.collection.children.link(coll)
    highs, lows = [], []

    def tf(v):
        g = np.asarray(v, dtype=np.float64) @ R_to_gltf.T
        if mirror_x:
            g = g * np.array([-1.0, 1.0, 1.0])
        return g

    def ff(f):
        return [list(q)[::-1] for q in f] if mirror_x else f

    for p in parts:
        hv = tf(p['hv'])
        hf = ff([list(q) for q in p['hf']])
        G = curvature_G(np.asarray(p['hv']), [list(q) for q in p['hf']])
        B = np.asarray(p['hB'], dtype=np.float64)
        attr = np.stack([G, B, np.zeros_like(G)], axis=1)
        h = make_obj('H_' + asset + '_' + p['name'], hv, hf, p['mat'], {'bake': attr}, coll=coll)
        highs.append(h)
        if 'lv' in p and p.get('lv') is not None:
            lo = make_obj('L_' + asset + '_' + p['name'], tf(p['lv']), ff([list(q) for q in p['lf']]), p['mat'], coll=coll)
        else:
            me = h.data.copy()
            lo = bpy.data.objects.new('L_' + asset + '_' + p['name'], me)
            coll.objects.link(lo)
            for a_ in list(me.color_attributes):
                me.color_attributes.remove(a_)
            n_tris = sum(len(poly.vertices) - 2 for poly in me.polygons)
            mod = lo.modifiers.new('dec', 'DECIMATE')
            mod.ratio = min(1.0, p['tris'] / max(1, n_tris))
            mod.use_collapse_triangulate = True
            select_only([lo])
            bpy.ops.object.modifier_apply(modifier='dec')
        lows.append(lo)
    # join the game meshes
    select_only(lows, lows[0])
    bpy.ops.object.join()
    low = bpy.context.view_layer.objects.active
    low.name = 'L_' + asset
    low.data.name = asset
    n_tris = sum(len(poly.vertices) - 2 for poly in low.data.polygons)
    log(f'{asset}: game mesh {len(low.data.vertices)} verts, {n_tris} tris, {len(low.material_slots)} materials')
    # smooth normals, but keep real hard edges (> 50°)
    low.data.polygons.foreach_set('use_smooth', np.ones(len(low.data.polygons), dtype=bool))
    try:
        select_only([low])
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
    except Exception as ex:  # noqa: BLE001
        log('shade_smooth_by_angle unavailable', ex)
    # UVs: one atlas
    select_only([low])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(62), island_margin=0.003, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    try:
        bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
    except Exception as ex:  # noqa: BLE001
        log('pack_islands', ex)
    bpy.ops.object.mode_set(mode='OBJECT')
    # bakes: the low is invisible to rays (so the high's AO doesn't hit its coincident game copy)
    for attr in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'):
        setattr(low, attr, False)
    hidden = []
    for o in bpy.context.scene.objects:
        if o.type == 'MESH' and o not in highs and o is not low and o.name not in hide and not o.hide_render:
            if o.name.startswith('ctx_'):
                continue
            o.hide_render = True
            hidden.append(o)
    setup_cycles()
    sc = bpy.context.scene
    bk = sc.render.bake
    bk.use_selected_to_active = True
    bk.cage_extrusion = 0.0015
    bk.max_ray_distance = 0.004
    bk.margin = 12
    bk.margin_type = 'EXTEND'
    imgs = {}
    for kind in ('NORMAL', 'AO', 'EMIT'):
        img = new_image(f'{asset}_{kind}', tex)
        set_bake_target(low, img)
        saved = None
        if kind == 'EMIT':
            em = emit_material()
            saved = [[s.material for s in h.material_slots] for h in highs]
            for h in highs:
                for s in h.material_slots:
                    s.material = em
        select_only(highs, low)
        low.select_set(True)
        t = time.time()
        kw = dict(type=kind, use_selected_to_active=True, cage_extrusion=0.0015, max_ray_distance=0.004, margin=12)
        if kind == 'NORMAL':
            kw.update(normal_space='OBJECT', normal_r='POS_X', normal_g='POS_Y', normal_b='POS_Z')
        bpy.ops.object.bake(**kw)
        log(f'{asset}: baked {kind} in {time.time() - t:.1f}s')
        if saved is not None:
            for h, ms in zip(highs, saved):
                for s, m in zip(h.material_slots, ms):
                    s.material = m
        imgs[kind] = img
    for o in hidden:
        o.hide_render = False
    for attr in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'):
        setattr(low, attr, True)
    nrm = img_pixels(imgs['NORMAL'])[..., :3]
    ao = img_pixels(imgs['AO'])[..., 0]
    em = img_pixels(imgs['EMIT'])
    maps = np.stack([ao, em[..., 0], em[..., 1]], axis=2)
    png_m = os.path.join(args.scratch, f'{asset}-maps.png')
    png_n = os.path.join(args.scratch, f'{asset}-nrm.png')
    save_png(maps, png_m)
    save_png(nrm, png_n)
    log(f'{asset}: AO mean {ao.mean():.2f} min {ao.min():.2f}; curvature mean {em[..., 0].mean():.2f}; detail mean {em[..., 1].mean():.2f}')
    clear_bake_target(low)
    if not args.no_export:
        to_webp(png_m, os.path.join(args.out, f'{asset}-maps.webp'), 90)
        to_webp(png_n, os.path.join(args.out, f'{asset}-nrm.webp'), 94, sharp=True)
        raw = os.path.join(args.scratch, f'{asset}.raw.glb')
        select_only([low])
        bpy.ops.export_scene.gltf(filepath=raw, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                                  export_texcoords=True, export_normals=True, export_materials='EXPORT', export_vertex_color='NONE',
                                  export_image_format='NONE', export_animations=False, export_skins=False, export_morph=False)
        dst = os.path.join(args.out, f'{asset}.glb')
        subprocess.run(['pnpm', 'exec', 'gltf-transform', 'meshopt', raw, dst, '--level', 'medium'], cwd=REPO, check=True,
                       stdout=subprocess.DEVNULL)
        for f in (dst, os.path.join(args.out, f'{asset}-maps.webp'), os.path.join(args.out, f'{asset}-nrm.webp')):
            log(f'  wrote {os.path.relpath(f, REPO)}  {os.path.getsize(f) / 1024:.0f} KB')
    for h in highs:
        h.hide_render = True
        h.hide_set(True)
    return low, imgs


# ───────────────────────────── preview: the low + its maps in a toon look ─────────────────────────────

def preview_material(low, imgs, toon, asset=''):
    """replace the low's materials with preview ones: class colour × AO × detail, object-space normal map; toon =
    3 hard bands + ink where the curvature map says crease"""
    for slot in low.material_slots:
        cls = slot.material.name.split('.')[0]
        if cls.startswith('PV_'):
            cls = cls[3:].rsplit('_', 1)[0].split('_', 1)[1]
        name = f'PV_{asset}_{cls}_{"toon" if toon else "pbr"}'
        m = bpy.data.materials.get(name)
        if m is None:
            m = bpy.data.materials.new(name)
            m.use_nodes = True
            nt = m.node_tree
            for n in list(nt.nodes):
                nt.nodes.remove(n)
            uv = nt.nodes.new('ShaderNodeUVMap')
            tm = nt.nodes.new('ShaderNodeTexImage')
            tm.image = imgs['maps']
            tm.image.colorspace_settings.name = 'Non-Color'
            tn = nt.nodes.new('ShaderNodeTexImage')
            tn.image = imgs['nrm']
            tn.image.colorspace_settings.name = 'Non-Color'
            nt.links.new(uv.outputs['UV'], tm.inputs['Vector'])
            nt.links.new(uv.outputs['UV'], tn.inputs['Vector'])
            nm = nt.nodes.new('ShaderNodeNormalMap')
            nm.space = 'OBJECT'
            nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
            sep = nt.nodes.new('ShaderNodeSeparateColor')
            nt.links.new(tm.outputs['Color'], sep.inputs['Color'])
            c = MAT_COL.get(cls, (0.5, 0.5, 0.5))
            # base = class colour × (0.55 + 0.9 × detail) × (0.35 + 0.65 × AO)
            m1 = nt.nodes.new('ShaderNodeMath')
            m1.operation = 'MULTIPLY_ADD'
            m1.inputs[1].default_value = 0.9
            m1.inputs[2].default_value = 0.55
            nt.links.new(sep.outputs['Blue'], m1.inputs[0])
            m2 = nt.nodes.new('ShaderNodeMath')
            m2.operation = 'MULTIPLY_ADD'
            m2.inputs[1].default_value = 0.65
            m2.inputs[2].default_value = 0.35
            nt.links.new(sep.outputs['Red'], m2.inputs[0])
            m3 = nt.nodes.new('ShaderNodeMath')
            m3.operation = 'MULTIPLY'
            nt.links.new(m1.outputs[0], m3.inputs[0])
            nt.links.new(m2.outputs[0], m3.inputs[1])
            col = nt.nodes.new('ShaderNodeRGB')
            col.outputs[0].default_value = (c[0], c[1], c[2], 1)
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            nt.links.new(col.outputs[0], mix.inputs[6])
            nt.links.new(m3.outputs[0], mix.inputs[7])
            out = nt.nodes.new('ShaderNodeOutputMaterial')
            if not toon:
                bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
                nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
                nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
                metal = cls.startswith('brass') or cls == 'gold_thread'
                bsdf.inputs['Metallic'].default_value = 1.0 if metal else 0.0
                bsdf.inputs['Roughness'].default_value = 0.35 if metal else (0.45 if cls in ('glove', 'leather', 'trim_red') else 0.75)
                nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
            else:
                dif = nt.nodes.new('ShaderNodeBsdfDiffuse')
                dif.inputs['Color'].default_value = (1, 1, 1, 1)
                nt.links.new(nm.outputs['Normal'], dif.inputs['Normal'])
                s2r = nt.nodes.new('ShaderNodeShaderToRGB')
                nt.links.new(dif.outputs['BSDF'], s2r.inputs['Shader'])
                ramp = nt.nodes.new('ShaderNodeValToRGB')
                ramp.color_ramp.interpolation = 'CONSTANT'
                els = ramp.color_ramp.elements
                els[0].position = 0.0
                els[0].color = (0.42, 0.42, 0.46, 1)
                els[1].position = 0.12
                els[1].color = (0.72, 0.72, 0.74, 1)
                e3 = els.new(0.45)
                e3.color = (1.25, 1.22, 1.18, 1)
                bw = nt.nodes.new('ShaderNodeRGBToBW')
                nt.links.new(s2r.outputs['Color'], bw.inputs['Color'])
                nt.links.new(bw.outputs['Val'], ramp.inputs['Fac'])
                mx2 = nt.nodes.new('ShaderNodeMix')
                mx2.data_type = 'RGBA'
                mx2.blend_type = 'MULTIPLY'
                mx2.inputs['Factor'].default_value = 1.0
                nt.links.new(mix.outputs[2], mx2.inputs[6])
                nt.links.new(ramp.outputs['Color'], mx2.inputs[7])
                # ink where the curvature (G) is below 0.33
                ink = nt.nodes.new('ShaderNodeMapRange')
                ink.inputs['From Min'].default_value = 0.22
                ink.inputs['From Max'].default_value = 0.34
                ink.inputs['To Min'].default_value = 1.0
                ink.inputs['To Max'].default_value = 0.0
                nt.links.new(sep.outputs['Green'], ink.inputs['Value'])
                mx3 = nt.nodes.new('ShaderNodeMix')
                mx3.data_type = 'RGBA'
                nt.links.new(ink.outputs['Result'], mx3.inputs[0])
                nt.links.new(mx2.outputs[2], mx3.inputs[6])
                mx3.inputs[7].default_value = (0.004, 0.004, 0.006, 1)
                em = nt.nodes.new('ShaderNodeEmission')
                nt.links.new(mx3.outputs[2], em.inputs['Color'])
                nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
        slot.material = m


def add_context_jian():
    """a black grip, the brass ring and collar, a pommel and a blade stub (JIAN axes) for the hand's preview"""
    objs = []
    ax = lambda s: L.v3(0, s, 0)  # noqa: E731
    X = lambda s: L.v3(1, 0, 0)  # noqa: E731
    Z = lambda s: L.v3(0, 0, 1)  # noqa: E731
    specs = [
        ('ctx_grip', 'lacquer', lambda s, a: 0.0187, lambda s, a: 0.0187, np.linspace(-0.30, -0.06, 30), 48),
        ('ctx_ring', 'brass', lambda s, a: 0.0196, lambda s, a: 0.0196, np.linspace(-0.104, -0.096, 3), 48),
        ('ctx_collar', 'brass', lambda s, a: 0.021, lambda s, a: 0.021, np.linspace(-0.06, 0.0, 4), 48),
        ('ctx_pommel', 'brass', lambda s, a: 0.02 * (1 - 0.3 * abs(s + 0.325) / 0.025), lambda s, a: 0.02, np.linspace(-0.35, -0.30, 6), 48),
    ]
    for name, mat, rw, rt, ss, n in specs:
        v, f = L.tube(ax, X, Z, rw, rt, ss, n, closed_start=True, closed_end=True)
        objs.append(make_obj(name, v, f, mat))
    v, f = L.tube(ax, X, Z, lambda s, a: 0.021 * (1 - 0.25 * (s - 0.05) / 0.3), lambda s, a: 0.004, np.linspace(0.0, 0.35, 8), 6, closed_start=True, closed_end=True)
    objs.append(make_obj('ctx_blade', v, f, 'steel', smooth=False))
    return objs


def look_at_cam(name, target_g, eye_dir_g, up_g, dist, lens):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.clip_start = 0.01
    ob = bpy.data.objects.new(name, cam)
    bpy.context.scene.collection.objects.link(ob)
    tb = Vector(to_blender(np.asarray(target_g)))
    eb = Vector(to_blender(L.norm(np.asarray(eye_dir_g))))
    ub = Vector(to_blender(np.asarray(up_g)))
    ob.location = tb + eb * dist
    fwd = (tb - ob.location).normalized()
    right = fwd.cross(ub).normalized()
    up = right.cross(fwd).normalized()
    m = Matrix((right, up, -fwd)).transposed()
    ob.matrix_world = Matrix.Translation(ob.location) @ m.to_4x4()
    return ob


def render_eevee(path, cam, res=1024, toon=False):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    w = sc.world
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    if bg is not None:
        bg.inputs['Color'].default_value = (0.55, 0.57, 0.62, 1)
        bg.inputs['Strength'].default_value = 0.6
    if bpy.data.objects.get('KEY') is None:
        ld = bpy.data.lights.new('KEY', 'SUN')
        ld.energy = 3.5
        ld.angle = math.radians(8)
        lo = bpy.data.objects.new('KEY', ld)
        sc.collection.objects.link(lo)
        # key from the upper left of the view (the sky screens), in glTF view terms ≈ JIAN (−0.45, 0.75, 0.5)-ish
        d = Vector(to_blender(L.norm(L.v3(-0.5, 0.55, 0.65))))
        lo.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        fl = bpy.data.lights.new('FILL', 'SUN')
        fl.energy = 0.8
        fo = bpy.data.objects.new('FILL', fl)
        sc.collection.objects.link(fo)
        d2 = Vector(to_blender(L.norm(L.v3(0.7, -0.3, 0.2))))
        fo.rotation_euler = d2.to_track_quat('Z', 'Y').to_euler()
    sc.render.use_freestyle = toon
    if toon:
        sc.render.line_thickness_mode = 'ABSOLUTE'
        sc.render.line_thickness = 1.6
        vl = bpy.context.view_layer
        vl.use_freestyle = True
        ls = vl.freestyle_settings.linesets[0] if len(vl.freestyle_settings.linesets) else vl.freestyle_settings.linesets.new('ink')
        ls.select_by_visibility = True
        ls.select_silhouette = True
        ls.select_border = True
        ls.select_crease = False
        if ls.linestyle is None:
            ls.linestyle = bpy.data.linestyles.new('ink')
        ls.linestyle.color = (0.01, 0.01, 0.015)
        ls.linestyle.thickness = 2.2
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    log('wrote', path)


# ───────────────────────────── assets ─────────────────────────────

def hand_r_parts():
    hand = Hand(rg=0.019, grip=True)
    eye_h = R_HJ.T @ E_JIAN
    parts = HP.glove_parts(hand, args.voxel, log, np.array([-0.052, -0.258, -0.052]), np.array([0.068, -0.086, 0.128]), 15500,
                           cuff=dict(eye_h=eye_h))
    return hand, parts


def fist_l_parts():
    hand = HP.fist_hand()
    mc = np.mean([f['mcp'] for f in hand.fingers], axis=0)
    y_f = L.norm(mc - hand.W)
    z_f = L.norm(L.v3(1, 0, 0) - y_f * y_f[0])
    x_f = np.cross(y_f, z_f)
    hand.fore = -y_f
    R = np.stack([x_f, y_f, z_f])  # rows: hand → fist (right)
    eye_right = L.v3(-E_GAUNTLET[0], E_GAUNTLET[1], E_GAUNTLET[2])
    eye_h = R.T @ eye_right
    parts = HP.glove_parts(hand, args.voxel, log, np.array([-0.045, -0.25, -0.045]), np.array([0.07, -0.08, 0.14]), 7300,
                           cuff=dict(eye_h=eye_h, end=0.05, trim=0.012, strap=(0.016, 0.027)))
    # translate so the wrist centre is the origin (hand frame), then rotate into the fist frame
    for p in parts:
        p['hv'] = p['hv'] - hand.W
        if p.get('lv') is not None:
            p['lv'] = p['lv'] - hand.W
    return hand, parts, R


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    only = set(args.only.split(','))
    built = {}
    if 'arm-r' in only:
        parts = HP.sleeve_parts()
        low, imgs = build_asset('arm-r', parts, np.eye(3), tex=args.tex)
        built['arm-r'] = (low, imgs)
    if 'hand-r' in only:
        hand, parts = hand_r_parts()
        ctx = add_context_jian()  # the grip occludes the fingers' AO
        low, imgs = build_asset('hand-r', parts, R_HJ, tex=args.tex)
        for o in ctx:
            o.hide_render = True
        built['hand-r'] = (low, imgs)
        W_j = R_HJ @ hand.W
        A_j = W_j + D_JIAN * 0.035
        z_s = R_HJ @ L.v3(1, 0, 0)
        y_s = -D_JIAN
        x_s = np.cross(y_s, z_s)
        log(f'hand-r wrist W (JIAN) = {np.round(W_j, 4).tolist()}; sleeve origin A = W + 0.035·d = {np.round(A_j, 4).tolist()}')
        log(f'  sleeve axes in JIAN: x {np.round(x_s, 4).tolist()} y {np.round(y_s, 4).tolist()} z {np.round(z_s, 4).tolist()}')
        if 'arm-r' in built:
            arm = built['arm-r'][0]
            M = np.eye(4)
            Mb = np.stack([to_blender(x_s), to_blender(y_s), to_blender(z_s)], axis=1)
            # the arm object's mesh is in Blender axes of the SLEEVE frame: map sleeve(gltf) → jian(gltf) → blender
            Rs = np.stack([x_s, y_s, z_s], axis=1)  # sleeve gltf → jian gltf
            Mfull = R_GB @ Rs @ R_GB.T
            M[:3, :3] = Mfull
            M[:3, 3] = to_blender(A_j)
            arm.matrix_world = Matrix(M.tolist())
            del Mb
    if 'fist-l' in only:
        hand, parts, R = fist_l_parts()
        low, imgs = build_asset('fist-l', parts, R, mirror_x=True, tex=args.tex)
        built['fist-l'] = (low, imgs)
    # previews
    for name, (low, imgs) in built.items():
        pass
    if 'hand-r' in built:
        for o in bpy.context.scene.objects:
            if o.type == 'MESH' and o.name.startswith('L_fist'):
                o.hide_render = True
        for o in bpy.context.scene.objects:
            if o.name.startswith('ctx_'):
                o.hide_render = False
        centre = R_HJ @ L.v3(0.015, -0.175, 0.02)
        for toon in (False, True):
            for nm, (low, imgs) in built.items():
                if nm == 'fist-l':
                    continue
                preview_material(low, {'maps': load_img(nm, 'maps'), 'nrm': load_img(nm, 'nrm')}, toon, nm)
            cam = look_at_cam('cam_eye', centre, E_JIAN, UP_JIAN, 0.55, 85)
            render_eevee(os.path.join(args.scratch, f'preview-{args.tag}-eye-{"toon" if toon else "pbr"}.png'), cam, toon=toon)
            if not toon:
                cam2 = look_at_cam('cam_game', centre + R_HJ @ L.v3(0.0, 0.0, 0.05), E_JIAN, UP_JIAN, 0.9, 42)
                render_eevee(os.path.join(args.scratch, f'preview-{args.tag}-game.png'), cam2)
                cam3 = look_at_cam('cam_front', centre, R_HJ @ L.v3(-0.6, 0.3, -0.75), np.array([0, 1.0, 0]), 0.5, 70)
                render_eevee(os.path.join(args.scratch, f'preview-{args.tag}-front.png'), cam3)
    if 'fist-l' in built:
        for o in bpy.context.scene.objects:
            if o.type == 'MESH':
                o.hide_render = not o.name.startswith('L_fist')
        low, imgs = built['fist-l']
        preview_material(low, {'maps': load_img('fist-l', 'maps'), 'nrm': load_img('fist-l', 'nrm')}, False, 'fist-l')
        for k, dv in enumerate((E_GAUNTLET, L.v3(0.1, 0.4, 1.0), L.v3(-0.3, 1.0, 0.3))):
            cam = look_at_cam(f'cam_fist{k}', L.v3(0, 0.045, -0.01), dv, np.array([0, 0, 1.0]) if k != 1 else np.array([0, 1.0, 0]), 0.42, 70)
            render_eevee(os.path.join(args.scratch, f'preview-{args.tag}-fist{k}.png'), cam)
    if 'arm-r' in built and 'hand-r' not in built:
        low, imgs = built['arm-r']
        preview_material(low, {'maps': load_img('arm-r', 'maps'), 'nrm': load_img('arm-r', 'nrm')}, False)
        cam = look_at_cam('cam_arm', L.v3(0, -0.15, 0.0), L.v3(0.3, 0.3, 1.0), np.array([0, 1.0, 0]), 0.9, 50)
        render_eevee(os.path.join(args.scratch, f'preview-{args.tag}-arm.png'), cam)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(args.scratch, f'hand-{args.tag}.blend'))
    log('done')


def load_img(asset, kind):
    path = os.path.join(args.scratch, f'{asset}-{kind}.png')
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = 'Non-Color'
    return img


main()
