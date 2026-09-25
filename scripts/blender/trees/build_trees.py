"""
build_trees.py — Pine Hollow's photoreal tree species (PINE-HOLLOW-REMASTER PH-B4), built in Blender 5.2, headless.

  blender -b --factory-startup -P scripts/blender/trees/build_trees.py -- <build dir> [--quick] [--only=bark,cards,trees,lineup]
  (scripts/blender/trees/run.sh runs it, then compresses and copies into public/)

Steps (each writes into <build dir>):
  bark      the bark sets the trunks tile: fir (the Poly Haven fir_tree_01 scan's bark), the giants' metasequoia (redwood
            kin: deep red fibrous furrows), the snag's silver weathered willow (bark_willow_02), and the silver birch — generated (barkgen.py,
            Poly Haven has none). tex/<id>/{diffuse,nor_gl,arm}.png, 1024², seamless. The pine keeps the shard's pine_bark.
  cards     the branch-card atlas, 2 × 2 cells of 1024 × 512 (treegen.py): each cell a branch modelled from CC0 photoscan
            sprigs — the pine_tree_01 twig (the pine tuft), fir_tree_01's sprays (the fir), tree_small_02's leaves on
            modelled stems (the birch), modelled dead twigs + strands of beard lichen (the snag) — rendered top-down in
            Cycles: albedo (× a local AO), a camera-space normal, ARM (AO / roughness). cards-{albedo,normal,arm}.png
  trees     every variant of treegen.SPECS → trees.glb (5 LOD parts + the impostor cross per variant) and trees.json
            (heights, radii, tris per part, the impostor frames). Then the impostor atlas: each variant's hi LOD
            (trunk + cards) rendered from the side, 4 × 4 cells of 256 × 512 — impostor-{albedo,normal}.png
  lineup    a lit Cycles preview of the whole set in a row (lineup.jpg) — for iterating, not shipped
"""
import json
import math
import os
import sys
import time
import urllib.request

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import barkgen  # noqa: E402
import treegen as TG  # noqa: E402
from glb import write_glb  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0] if argv and not argv[0].startswith('--') else os.path.expanduser('~/.cache/wildshard-blender/trees/build'))
QUICK = '--quick' in argv
ONLY = next((a.split('=', 1)[1].split(',') for a in argv if a.startswith('--only=')), ['bark', 'cards', 'trees', 'lineup'])
SRC = os.path.expanduser('~/.cache/wildshard-blender/trees-src')
os.makedirs(OUT, exist_ok=True); os.makedirs(SRC, exist_ok=True)
T0 = time.time()


def log(*a):
    print(f'[trees {time.time() - T0:6.1f}s]', *a, flush=True)


# ── sources (Poly Haven, CC0) ─────────────────────────────────────────────────────────────────────────────────────────
def fetch(asset, key, res='2k'):
    """One Poly Haven map as a local JPEG (cached)."""
    path = f'{SRC}/{asset}__{key}_{res}.jpg'
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    ua = {'User-Agent': 'wildshard-trees/1.0'}  # Poly Haven refuses Python's default agent (403)
    with urllib.request.urlopen(urllib.request.Request(f'https://api.polyhaven.com/files/{asset}', headers=ua), timeout=60) as r:
        files = json.load(r)
    k = key if key in files else next(x for x in files if x.lower() == key.lower())
    url = files[k][res]['jpg']['url']
    log('fetch', url)
    with urllib.request.urlopen(urllib.request.Request(url, headers=ua), timeout=120) as r, open(path, 'wb') as f:
        f.write(r.read())
    return path


PINE_TWIG = f'{REPO}/public/assets/tex/pine_tree_01'
BARK_IDS = ['pine_bark', 'fir_bark', 'metasequoia_bark', 'birch_bark', 'bark_willow_02']  # = treegen BARK_* order


# ── blender helpers ───────────────────────────────────────────────────────────────────────────────────────────────────
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:  # noqa: BLE001 — CPU is fine, only slower
        log('GPU unavailable, CPU render:', e)
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 2
    sc.render.film_transparent = True
    sc.render.filter_size = 1.0
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.world = bpy.data.worlds.new('w')
    sc.world.color = (0, 0, 0)
    return sc


_images = {}


def img(path, colorspace='sRGB'):
    key = (path, colorspace)
    try:
        _images[key].name  # a factory reset (reset()) frees every image: load it again
    except (KeyError, ReferenceError):
        _images.pop(key, None)
    if key not in _images:
        im = bpy.data.images.load(path, check_existing=False)
        im.colorspace_settings.name = colorspace
        _images[key] = im
    return _images[key]


def to_b(P):
    """game (x, y up, z) → Blender (x, −z, y)"""
    P = np.asarray(P, dtype=np.float64)
    return np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1)


def make_obj(name, P, I, UV=None, C=None, N=None, UV2=None, mat_index=None, mats=(), game=True):
    P = to_b(P) if game else np.asarray(P, dtype=np.float64)
    tris = np.asarray(I).reshape(-1, 3)
    me = bpy.data.meshes.new(name)
    me.from_pydata(P.tolist(), [], tris.tolist())
    for m in mats:
        me.materials.append(m)
    if UV is not None:
        uv = me.uv_layers.new(name='UVMap')
        uv.data.foreach_set('uv', np.asarray(UV, dtype=np.float32)[tris.ravel()].ravel())
    if UV2 is not None:
        uv2 = me.uv_layers.new(name='local')
        uv2.data.foreach_set('uv', np.asarray(UV2, dtype=np.float32)[tris.ravel()].ravel())
    if C is not None:
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        rgba = np.concatenate([np.asarray(C, dtype=np.float32), np.ones((len(C), 1), np.float32)], 1)
        ca.data.foreach_set('color', rgba.ravel())
    if mat_index is not None:
        me.polygons.foreach_set('material_index', np.asarray(mat_index, dtype=np.int32))
    me.update()
    if N is not None:
        Nb = to_b(N) if game else np.asarray(N)
        me.normals_split_custom_set_from_vertices(Nb.tolist())
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


class NB:
    """A small node-tree builder."""

    def __init__(self, mat):
        mat.use_nodes = True
        self.t = mat.node_tree
        self.t.nodes.clear()

    def n(self, kind, **props):
        node = self.t.nodes.new(kind)
        for k, v in props.items():
            setattr(node, k, v)
        return node

    def link(self, a, b):
        self.t.links.new(a, b)

    def vmath(self, op, a, b=None, scale=None):
        node = self.n('ShaderNodeVectorMath', operation=op)
        self._in(node.inputs[0], a)
        if b is not None:
            self._in(node.inputs[1], b)
        if scale is not None:
            self._in(node.inputs[3], scale)
        return node.outputs[0]

    def math(self, op, a, b=None):
        node = self.n('ShaderNodeMath', operation=op)
        self._in(node.inputs[0], a)
        if b is not None:
            self._in(node.inputs[1], b)
        return node.outputs[0]

    def _in(self, sock, v):
        if isinstance(v, (int, float)):
            sock.default_value = v if sock.type == 'VALUE' else (v, v, v) if len(sock.default_value) == 3 else (v, v, v, 1)
        elif isinstance(v, tuple):
            sock.default_value = v
        else:
            self.link(v, sock)

    def lerp(self, a, b, f):
        """a + (b − a)·f, vectors; f a float socket or number"""
        d = self.vmath('SUBTRACT', b, a)
        return self.vmath('ADD', a, self.vmath('SCALE', d, scale=f))


MODE_MATS = []


def bake_material(name, diff=None, alpha=None, alpha_from_diff=False, nor=None, arm=None, color=(1, 1, 1), vcol=False,
                  ellipse=False, ao_dist=0.1, ao_albedo=0.35, rough=0.8, nor_strength=1.0, flat_normal_up=0.0, hue=None):
    """
    An emission material that outputs, by its MODE value: 0 albedo (× colour × vertex colour × AO), 1 the camera-space
    normal (n·0.5 + 0.5, facing the camera), 2 ARM (AO, roughness, 0). Alpha: the sprig's cut-out (× an elliptical
    mask in the 'local' uv: the leaf crops carry their neighbours' stems).
    """
    mat = bpy.data.materials.new(name)
    b = NB(mat)
    uv = b.n('ShaderNodeUVMap', uv_map='UVMap').outputs[0]
    col = color
    a_sock = 1.0
    if diff is not None:
        td = b.n('ShaderNodeTexImage', image=diff, interpolation='Cubic')
        b.link(uv, td.inputs[0])
        col = b.vmath('MULTIPLY', td.outputs['Color'], color)
        if alpha_from_diff:
            a_sock = td.outputs['Alpha']
    if hue is not None:
        hs = b.n('ShaderNodeHueSaturation')
        hs.inputs['Hue'].default_value, hs.inputs['Saturation'].default_value, hs.inputs['Value'].default_value = hue
        b.link(col, hs.inputs['Color'])
        col = hs.outputs[0]
    if vcol:
        vc = b.n('ShaderNodeVertexColor', layer_name='Col').outputs['Color']
        col = b.vmath('MULTIPLY', col, vc)
    if alpha is not None:
        ta = b.n('ShaderNodeTexImage', image=alpha)
        b.link(uv, ta.inputs[0])
        a_sock = b.n('ShaderNodeSeparateColor')
        b.link(ta.outputs['Color'], a_sock.inputs[0])
        a_sock = a_sock.outputs[0]
    if ellipse:
        lu = b.n('ShaderNodeUVMap', uv_map='local').outputs[0]
        dist = b.n('ShaderNodeVectorMath', operation='LENGTH')
        b.link(b.vmath('MULTIPLY', b.vmath('SUBTRACT', lu, (0.5, 0.5, 0.0)), (2.1, 2.3, 0.0)), dist.inputs[0])
        m = b.math('LESS_THAN', dist.outputs['Value'], 1.0)
        a_sock = m if isinstance(a_sock, float) else b.math('MULTIPLY', a_sock, m)
    ao = b.n('ShaderNodeAmbientOcclusion', samples=16)
    ao.inputs['Distance'].default_value = ao_dist
    ao_f = ao.outputs['AO']
    albedo = b.vmath('SCALE', col, scale=b.math('ADD', 1.0 - ao_albedo, b.math('MULTIPLY', ao_f, ao_albedo)))
    geo = b.n('ShaderNodeNewGeometry')
    if nor is not None:
        tn = b.n('ShaderNodeTexImage', image=nor)
        b.link(uv, tn.inputs[0])
        nm = b.n('ShaderNodeNormalMap', space='TANGENT', uv_map='UVMap')
        nm.inputs['Strength'].default_value = nor_strength
        b.link(tn.outputs['Color'], nm.inputs['Color'])
        wn = nm.outputs['Normal']
    else:
        wn = geo.outputs['Normal']
    if flat_normal_up > 0:
        wn = b.vmath('NORMALIZE', b.lerp(wn, (0.0, 0.0, 1.0), flat_normal_up))
    flip = b.math('SUBTRACT', 1.0, b.math('MULTIPLY', geo.outputs['Backfacing'], 2.0))
    wn = b.vmath('SCALE', wn, scale=flip)
    vt = b.n('ShaderNodeVectorTransform', vector_type='NORMAL', convert_from='WORLD', convert_to='CAMERA')
    b.link(wn, vt.inputs[0])
    sep = b.n('ShaderNodeSeparateXYZ'); b.link(vt.outputs[0], sep.inputs[0])
    comb = b.n('ShaderNodeCombineXYZ')
    b.link(sep.outputs[0], comb.inputs[0]); b.link(sep.outputs[1], comb.inputs[1])
    b.link(b.math('ABSOLUTE', sep.outputs[2]), comb.inputs[2])
    nenc = b.vmath('ADD', b.vmath('SCALE', b.vmath('NORMALIZE', comb.outputs[0]), scale=0.5), (0.5, 0.5, 0.5))
    if arm is not None:
        tr = b.n('ShaderNodeTexImage', image=arm); b.link(uv, tr.inputs[0])
        sr = b.n('ShaderNodeSeparateColor'); b.link(tr.outputs['Color'], sr.inputs[0])
        r_sock = sr.outputs[1]
    else:
        r_sock = rough
    armc = b.n('ShaderNodeCombineXYZ')
    b._in(armc.inputs[0], b.math('ADD', 0.3, b.math('MULTIPLY', ao_f, 0.7)))
    b._in(armc.inputs[1], r_sock)
    mode = b.n('ShaderNodeValue', label='MODE', name='MODE')
    mode.outputs[0].default_value = 0.0
    out = b.lerp(albedo, nenc, b.math('GREATER_THAN', mode.outputs[0], 0.5))
    out = b.lerp(out, armc.outputs[0], b.math('GREATER_THAN', mode.outputs[0], 1.5))
    em = b.n('ShaderNodeEmission'); b.link(out, em.inputs['Color'])
    tr = b.n('ShaderNodeBsdfTransparent')
    mix = b.n('ShaderNodeMixShader')
    b._in(mix.inputs[0], a_sock if not isinstance(a_sock, float) else 1.0)
    b.link(tr.outputs[0], mix.inputs[1]); b.link(em.outputs[0], mix.inputs[2])
    o = b.n('ShaderNodeOutputMaterial'); b.link(mix.outputs[0], o.inputs['Surface'])
    MODE_MATS.append(mat)
    return mat


def set_mode(m):
    for mat in MODE_MATS:
        node = mat.node_tree.nodes.get('MODE')
        if node:
            node.outputs[0].default_value = float(m)
    sc = bpy.context.scene
    sc.view_settings.view_transform = 'Standard' if m == 0 else 'Raw'


def ortho_cam(sc, loc, rot, scale, w, h):
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = scale; cd.clip_start = 0.01; cd.clip_end = 1000
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam)
    cam.location = loc; cam.rotation_euler = rot
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    return cam


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def read_px(path):
    im = bpy.data.images.load(path, check_existing=False)
    im.colorspace_settings.name = 'Non-Color'
    w, h = im.size
    px = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return px.reshape(h, w, 4)  # row 0 = the image's bottom


def write_px(path, px, alpha=True):
    h, w = px.shape[:2]
    im = bpy.data.images.new(os.path.basename(path), w, h, alpha=alpha)
    im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(np.ascontiguousarray(px, dtype=np.float32).ravel())
    im.filepath_raw = path; im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)


def grow(mask, n):
    m = mask.copy()
    for _ in range(n):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m


def dilate(px, mask, iters=24):
    """Bleed colour out of the opaque texels into the transparent ones (mips and bilinear read them: no dark fringe)."""
    rgb = px[..., :3].copy()
    f = mask.astype(np.float32)
    for _ in range(iters):
        acc = np.zeros_like(rgb); cnt = np.zeros(f.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                fs = np.roll(np.roll(f, dy, 0), dx, 1)
                acc += np.roll(np.roll(rgb * f[..., None], dy, 0), dx, 1)
                cnt += fs
        grow = (f == 0) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow][:, None]
        f = np.where(grow, 1.0, f)
    out = px.copy(); out[..., :3] = rgb
    return out


# ── 1. bark ───────────────────────────────────────────────────────────────────────────────────────────────────────────
def build_bark():
    for bid, asset, keys in [
        ('fir_bark', 'fir_tree_01', ('bark_diff', 'bark_nor_gl', 'bark_arm')),
        ('metasequoia_bark', 'metasequoia_bark', ('Diffuse', 'nor_gl', 'arm')),
        ('bark_willow_02', 'bark_willow_02', ('Diffuse', 'nor_gl', 'arm')),
    ]:
        d = f'{OUT}/tex/{bid}'; os.makedirs(d, exist_ok=True)
        for key, kind in zip(keys, ('diffuse', 'nor_gl', 'arm')):
            src = fetch(asset, key)
            im = bpy.data.images.load(src, check_existing=False)
            im.colorspace_settings.name = 'Non-Color'
            if im.size[0] != 1024:
                im.scale(1024, 1024)
            im.filepath_raw = f'{d}/{kind}.png'; im.file_format = 'PNG'; im.save()
            bpy.data.images.remove(im)
        log('bark', bid)
    d = f'{OUT}/tex/birch_bark'; os.makedirs(d, exist_ok=True)
    albedo, nrm, arm = barkgen.birch_bark()
    for kind, a in (('diffuse', albedo), ('nor_gl', nrm), ('arm', arm)):
        rgba = np.concatenate([a[::-1], np.ones(a.shape[:2] + (1,))], -1)  # Blender rows run bottom-up
        write_px(f'{d}/{kind}.png', rgba, alpha=False)
    log('bark birch_bark (generated)')


# ── 2. the card atlas ─────────────────────────────────────────────────────────────────────────────────────────────────
def crop_tl(x0, x1, y0, y1):
    """A crop given in top-left-origin fractions → Blender uv (u0, v0, u1, v1)."""
    return (x0, 1 - y1, x1, 1 - y0)


def sprig(geo_list, mat_i, rect, base_frac, orient, L, pos, ang, lift=0.0, tilt=0.0, aspect=None, z=0.0):
    """
    One photoscan sprig quad in the card scene (Blender XY = the card, +Z = toward the camera). rect: its crop (uv);
    base_frac: where across the crop its stem leaves (0..1); orient 'up' = the sprig grows toward +v in the crop,
    'right' = toward +u. It is laid from `pos` along angle `ang` (radians, in XY), `L` long, lifted out of the plane by
    `lift` and turned about its own axis by `tilt` (both foreshorten it, as a real sprig does).
    """
    u0, v0, u1, v1 = rect
    if aspect is None:
        cw, ch = (u1 - u0), (v1 - v0)
        aspect = (cw / ch) if orient == 'up' else (ch / cw)
    W = L * aspect
    loc = np.array([[-base_frac * W, 0, 0], [(1 - base_frac) * W, 0, 0], [(1 - base_frac) * W, L, 0], [-base_frac * W, L, 0]])
    if orient == 'up':
        uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    else:  # base on the crop's left edge: local +y (length) = +u, local +x (across) = −v … mirrored so the top stays up
        uvs = [(u0, v1), (u0, v0), (u1, v0), (u1, v1)]
    ca, sa = math.cos(tilt), math.sin(tilt)
    Ry = np.array([[ca, 0, sa], [0, 1, 0], [-sa, 0, ca]])
    cl, sl = math.cos(lift), math.sin(lift)
    Rx = np.array([[1, 0, 0], [0, cl, -sl], [0, sl, cl]])
    a = ang - math.pi / 2
    cz, sz = math.cos(a), math.sin(a)
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    R = Rz @ Rx @ Ry
    P = (R @ loc.T).T + np.array([pos[0], pos[1], z])
    geo_list.append((P, uvs, mat_i))


def build_sprig_obj(name, quads, mats):
    P = np.concatenate([q[0] for q in quads])
    UV = np.array([uv for q in quads for uv in q[1]], dtype=np.float32)
    LUV = np.tile(np.array([[0, 0], [1, 0], [1, 1], [0, 1]], np.float32), (len(quads), 1))
    I = np.array([[4 * k, 4 * k + 1, 4 * k + 2, 4 * k, 4 * k + 2, 4 * k + 3] for k in range(len(quads))]).ravel()
    mi = np.repeat([q[2] for q in quads], 2)
    return make_obj(name, P, I, UV=UV, UV2=LUV, mat_index=mi, mats=mats, game=False)


def stem_obj(name, pts, radii, mat, segs=6):
    g = TG.Geo()
    TG.tube(g, [np.array(p, dtype=np.float64) for p in pts], radii, segs, 0, tile=(0.05, 0.2))
    a = g.arrays()
    return make_obj(name, a['POSITION'], a['indices'], UV=a['TEXCOORD_0'], mats=[mat], game=False)


def build_cards():
    rng = np.random.default_rng(5)
    # (images are looked up inside each cell: every cell starts from a factory reset, which frees them)
    pine_d = lambda: img(f'{PINE_TWIG}/twig_rgba.png')  # noqa: E731
    pine_n = lambda: img(f'{PINE_TWIG}/twig_nor_gl.jpg', 'Non-Color')  # noqa: E731
    pine_a = lambda: img(f'{PINE_TWIG}/twig_arm.jpg', 'Non-Color')  # noqa: E731
    fir_d = lambda: img(fetch('fir_tree_01', 'twig_diff'))  # noqa: E731
    fir_al = lambda: img(fetch('fir_tree_01', 'twig_alpha'), 'Non-Color')  # noqa: E731
    fir_n = lambda: img(fetch('fir_tree_01', 'twig_nor_gl'), 'Non-Color')  # noqa: E731
    fir_a = lambda: img(fetch('fir_tree_01', 'twig_arm'), 'Non-Color')  # noqa: E731
    lf_d = lambda: img(fetch('tree_small_02', 'leaves_diff'))  # noqa: E731
    lf_al = lambda: img(fetch('tree_small_02', 'leaves_alpha'), 'Non-Color')  # noqa: E731
    lf_n = lambda: img(fetch('tree_small_02', 'leaves_nor_gl'), 'Non-Color')  # noqa: E731
    lf_a = lambda: img(fetch('tree_small_02', 'leaves_arm'), 'Non-Color')  # noqa: E731

    PINE_RECT = crop_tl(30 / 1024, 230 / 1024, 40 / 1024, 448 / 1024)
    FIR = [  # (rect, base across the crop) — fir_tree_01's sprays, base at the bottom
        (crop_tl(0.31, 0.645, 0.395, 0.785), 0.5),
        (crop_tl(0.625, 0.955, 0.445, 0.835), 0.48),
        (crop_tl(0.645, 0.94, 0.035, 0.375), 0.58),
        (crop_tl(0.185, 0.43, 0.04, 0.315), 0.48),
    ]
    LEAVES = [crop_tl(*r) for r in [(0.063, 0.19, 0.054, 0.137), (0.034, 0.2, 0.186, 0.283), (0.244, 0.342, 0.283, 0.356),
                                    (0.244, 0.4, 0.415, 0.498), (0.063, 0.186, 0.317, 0.4), (0.264, 0.41, 0.532, 0.625),
                                    (0.044, 0.19, 0.596, 0.688)]]
    cells = {}
    samples = 16 if QUICK else 96

    def scene_cell(c):
        sc = reset()
        sc.cycles.samples = samples
        MODE_MATS.clear()
        return sc

    # ---- cell 0: the Scots pine tuft — a woody shoot, bottle-brush sprigs clumped toward its end
    def cell_pine():
        sc = scene_cell(0)
        mats = [bake_material('pine_sprig', diff=pine_d(), alpha_from_diff=True, nor=pine_n(), arm=pine_a(), color=(1.0, 1.0, 0.95), ao_dist=0.12, nor_strength=0.8)]
        wd = bake_material('wood', color=(0.045, 0.03, 0.02), rough=0.85, ao_dist=0.05)
        stem_obj('stem', [(0.02, 0, 0), (0.9, 0.02, 0.02), (1.55, -0.01, 0.04), (1.85, 0.0, 0.05)], [0.022, 0.016, 0.01, 0.005], wd)
        q = []
        # side shoots forking off the outer 60 %
        xs = np.linspace(0.45, 1.6, 14)
        for k, x in enumerate(xs):
            side = 1 if k % 2 else -1
            ang = side * rng.uniform(0.35, 0.8)
            L = rng.uniform(0.38, 0.52)
            for j in range(4):
                sprig(q, 0, PINE_RECT, 0.5, 'up', L * rng.uniform(0.85, 1.05), (x + j * 0.035, side * 0.01), ang + rng.normal(0, 0.22) * (1 if j else 0.5) - side * 0.25 * (j == 3),
                      lift=rng.uniform(-0.15, 0.3), tilt=rng.uniform(-0.45, 0.45), z=0.04 + 0.015 * j)
        # the terminal clump
        for j in range(8):
            sprig(q, 0, PINE_RECT, 0.5, 'up', rng.uniform(0.34, 0.46), (1.55 + rng.uniform(0, 0.12), rng.normal(0, 0.02)),
                  rng.normal(0, 0.5), lift=rng.uniform(-0.1, 0.35), tilt=rng.uniform(-0.45, 0.45), z=0.08)
        # a few short inner sprigs by the base
        for x in (0.2, 0.35):
            for side in (1, -1):
                sprig(q, 0, PINE_RECT, 0.5, 'up', rng.uniform(0.2, 0.28), (x, 0), side * 1.0, lift=0.3, tilt=rng.uniform(-0.6, 0.6), z=0.02)
        build_sprig_obj('sprigs', q, mats)
        return sc

    # ---- cell 1: the fir spray — flat, layered sprays off a stem, the biggest at the tip
    def cell_fir():
        sc = scene_cell(1)
        mats = [bake_material('fir_sprig', diff=fir_d(), alpha=fir_al(), nor=fir_n(), arm=fir_a(), color=(0.95, 1.0, 0.95), ao_dist=0.12, nor_strength=0.8)]
        wd = bake_material('wood', color=(0.05, 0.035, 0.022), rough=0.85, ao_dist=0.05)
        stem_obj('stem', [(0.0, 0, 0), (0.8, 0.0, 0.0), (1.5, 0.0, 0.01), (1.9, 0.0, 0.02)], [0.024, 0.017, 0.01, 0.004], wd)
        q = []
        xs = np.linspace(0.12, 1.45, 11)
        for k, x in enumerate(xs):
            side = 1 if k % 2 else -1
            f = x / 1.9
            r, bf = FIR[k % 4]
            L = 0.42 + 0.25 * math.sin(math.pi * min(1.0, f * 1.2))
            sprig(q, 0, r, bf, 'up', L, (x, 0), side * rng.uniform(0.75, 1.05), lift=rng.uniform(-0.15, 0.25), tilt=rng.uniform(-0.35, 0.35), z=0.02 * (k % 3))
        sprig(q, 0, FIR[0][0], FIR[0][1], 'up', 0.62, (1.3, 0), 0.0, lift=0.1, tilt=0.2, z=0.07)
        sprig(q, 0, FIR[1][0], FIR[1][1], 'up', 0.5, (1.1, 0.03), 0.3, lift=0.2, tilt=-0.3, z=0.06)
        sprig(q, 0, FIR[2][0], FIR[2][1], 'up', 0.45, (1.15, -0.03), -0.3, lift=0.2, tilt=0.3, z=0.05)
        build_sprig_obj('sprigs', q, mats)
        return sc

    # ---- cell 2: the birch — a weeping twig, alternate leaves on short stalks, side twiglets
    def cell_birch():
        sc = scene_cell(2)
        mats = [bake_material('birch_leaf', diff=lf_d(), alpha=lf_al(), nor=lf_n(), arm=lf_a(), ellipse=True, ao_dist=0.08,
                              hue=(0.47, 1.25, 1.18), color=(1.0, 1.02, 0.8), nor_strength=0.7)]
        wd = bake_material('wood_birch', color=(0.06, 0.035, 0.025), rough=0.8, ao_dist=0.05)
        q = []
        twigs = [((0.0, 0.0), 0.0, 1.9)]
        for x, side in [(0.35, 1), (0.6, -1), (0.85, 1), (1.1, -1), (1.3, 1), (0.5, 1), (0.95, -1)]:
            twigs.append(((x, 0.0), side * rng.uniform(0.35, 0.6), rng.uniform(0.45, 0.8)))
        for (sx, sy), ang, L in twigs:
            pts = [(sx + math.cos(ang) * L * t + 0.02 * math.sin(t * 9), sy + math.sin(ang) * L * t + 0.015 * math.sin(t * 7), 0.0) for t in np.linspace(0, 1, 6)]
            stem_obj('twig', pts, [0.008 if L > 1 else 0.005, 0.006, 0.005, 0.004, 0.003, 0.002], wd, segs=4)
            n = int(L * 30)
            for k in range(n):
                t = 0.08 + 0.92 * k / max(n - 1, 1)
                p = np.array(pts[0][:2]) + (np.array(pts[-1][:2]) - np.array(pts[0][:2])) * t
                side = 1 if k % 2 else -1
                leaf_ang = ang + side * rng.uniform(0.5, 1.3)
                size = rng.uniform(0.075, 0.11) * (0.8 + 0.2 * math.sin(math.pi * t))
                r = LEAVES[rng.integers(0, len(LEAVES))]
                sprig(q, 0, r, 0.5, 'right', size, (p[0], p[1]), leaf_ang, lift=rng.uniform(-0.4, 0.4), tilt=rng.uniform(-0.7, 0.7),
                      z=0.01 + 0.02 * rng.random())
        build_sprig_obj('leaves', q, mats)
        return sc

    # ---- cell 3: seen from the side — a dead, twiggy limb along the top, beard lichen (Usnea) hanging off it
    def cell_dead():
        sc = scene_cell(3)
        wd = bake_material('wood_dead', color=(0.14, 0.13, 0.115), rough=0.9, ao_dist=0.05)
        li = bake_material('lichen', color=(0.24, 0.29, 0.17), rough=0.9, ao_dist=0.03, ao_albedo=0.5)
        yb = TG.DEAD_BRANCH_V - 0.5
        main = [(0.0, yb, 0), (0.6, yb + 0.02, 0), (1.3, yb - 0.01, 0), (1.95, yb + 0.03, 0)]
        stem_obj('limb', main, [0.03, 0.022, 0.013, 0.004], wd)
        anchors = []
        for k in range(14):
            x = rng.uniform(0.15, 1.85)
            ang = rng.choice([1, -1]) * rng.uniform(0.3, 1.0) + (0.0 if rng.random() < 0.6 else math.pi * 0.0)
            L = rng.uniform(0.08, 0.28)
            pts = [(x, yb, 0.01)]
            for s in range(1, 4):
                pts.append((x + math.cos(ang) * L * s / 3, yb + math.sin(ang) * L * s / 3 * 0.7, 0.01))
            stem_obj('twig', pts, [0.006, 0.004, 0.003, 0.0015], wd, segs=4)
            anchors += [pts[1], pts[3]]
        anchors += [(x, yb, 0.0) for x in np.linspace(0.1, 1.9, 22)]
        strands = TG.Geo()
        for (ax, ay, _) in anchors:
            if rng.random() < 0.25:
                continue
            clump = rng.integers(4, 12)
            length = rng.uniform(0.15, 0.62) * (1 if ay <= yb + 0.01 else 0.8)
            for s in range(clump):
                L = length * rng.uniform(0.5, 1.0)
                x0 = ax + rng.normal(0, 0.012)
                ph = rng.uniform(0, 6.28)
                pts = [np.array([x0 + 0.02 * math.sin(ph + t * 5) * t + rng.normal(0, 0.004), ay - L * t, 0.02 + rng.normal(0, 0.01)])
                       for t in np.linspace(0, 1, 6)]
                TG.tube(strands, pts, np.linspace(0.0035, 0.0012, 6), 3, 0, tile=(0.05, 0.2))
        a = strands.arrays()
        make_obj('lichen', a['POSITION'], a['indices'], UV=a['TEXCOORD_0'], mats=[li], game=False)
        return sc

    atlas = {m: np.zeros((1024, 2048, 4), np.float32) for m in ('albedo', 'normal', 'arm')}
    for c, fn in enumerate([cell_pine, cell_fir, cell_birch, cell_dead]):
        sc = fn()
        ortho_cam(sc, (1.0, 0.0, 5.0), (0, 0, 0), 2.0, 1024, 512)
        col, row = c % 2, c // 2
        for m, name in enumerate(('albedo', 'normal', 'arm')):
            set_mode(m)
            p = f'{OUT}/cell{c}-{name}.png'
            render(p)
            atlas[name][row * 512:(row + 1) * 512, col * 1024:(col + 1) * 1024] = read_px(p)
        log('card cell', c)
    alpha = atlas['albedo'][..., 3]
    mask = alpha > 0.5
    alb = dilate(atlas['albedo'], mask)
    write_px(f'{OUT}/cards-albedo.png', alb)
    grown = grow(mask, 6)
    for name, bg in (('normal', (0.5, 0.5, 1.0)), ('arm', (1.0, 0.9, 0.0))):
        px = dilate(atlas[name], mask, iters=6)
        px[..., :3] = np.where(grown[..., None], px[..., :3], np.array(bg))
        px[..., 3] = 1
        write_px(f'{OUT}/cards-{name}.png', px, alpha=False)
    log('cards atlas written')


# ── 3. the trees, the GLB, the impostors ──────────────────────────────────────────────────────────────────────────────
ICOLS, IROWS, ICW, ICH = 4, 4, 256, 512


def impostor_rect(i):
    col, row = i % ICOLS, i // ICOLS
    return (col / ICOLS, row / IROWS, (col + 1) / ICOLS, (row + 1) / IROWS)


def far_cross(frame_w, frame_h, i, height):
    """The 2-quad cross (Forest.ts / TreeFactory's scheme): pivot at the base, uv into cell i."""
    u0, v0, u1, v1 = impostor_rect(i)
    P, UV, I, N = [], [], [], []
    for yaw in (0.0, math.pi / 2):
        c, s = math.cos(yaw), math.sin(yaw)
        base = len(P)
        for (x, y, u, v) in ((-frame_w / 2, 0, u0, v0), (frame_w / 2, 0, u1, v0), (frame_w / 2, frame_h, u1, v1), (-frame_w / 2, frame_h, u0, v1)):
            P.append((x * c, y, -x * s)); UV.append((u, v)); N.append((s, 0, c))
        I += [base, base + 1, base + 2, base, base + 2, base + 3]
    n = len(P)
    return {'POSITION': np.array(P, np.float32), 'NORMAL': np.array(N, np.float32), 'TEXCOORD_0': np.array(UV, np.float32),
            'COLOR_0': np.ones((n, 3), np.float32), 'indices': np.array(I, np.uint32)}


def bark_images():
    out = []
    for bid in BARK_IDS:
        d = f'{REPO}/public/assets/tex/pine_bark' if bid == 'pine_bark' else f'{OUT}/tex/{bid}'
        ext = 'jpg' if bid == 'pine_bark' else 'png'
        out.append((img(f'{d}/diffuse.{ext}'), img(f'{d}/nor_gl.{ext}', 'Non-Color')))
    return out


def tree_objects(tree, parts, bark_mats, card_mat, lit=False):
    obs = []
    for part in parts:
        g = tree.parts()[part]
        a = g.arrays()
        if a is None:
            continue
        if part.startswith('trunk'):
            layer = a['TEXCOORD_1'][:, 0].round().astype(int)
            tris = a['indices'].reshape(-1, 3)
            mi = layer[tris[:, 0]]
            obs.append(make_obj(f'{tree.name}.{part}', a['POSITION'], a['indices'], UV=a['TEXCOORD_0'], C=a['COLOR_0'], N=a['NORMAL'],
                                mat_index=mi, mats=bark_mats))
        else:
            obs.append(make_obj(f'{tree.name}.{part}', a['POSITION'], a['indices'], UV=a['TEXCOORD_0'], C=a['COLOR_0'], N=a['NORMAL'],
                                mats=[card_mat]))
    return obs


def build_trees():
    trees = []
    meshes = []
    meta = {'version': 1, 'barkLayers': BARK_IDS, 'impostor': {'cols': ICOLS, 'rows': IROWS, 'cell': [ICW, ICH]}, 'variants': []}
    for i, (name, species, h, r, make) in enumerate(TG.SPECS):
        tr = make()
        trees.append(tr)
        parts = tr.parts()
        allp = np.concatenate([parts['hi'].arrays()['POSITION'], parts['trunk'].arrays()['POSITION']])
        half_w = float(max(np.abs(allp[:, 0]).max(), np.abs(allp[:, 2]).max())) * 1.02
        top = float(allp[:, 1].max())
        frame_h = max(top * 1.02, half_w * 4)
        frame_w = frame_h / 2
        for part, g in parts.items():
            a = g.arrays()
            if not part.startswith('trunk'):
                a.pop('TEXCOORD_1')  # only the bark reads a layer
            meshes.append((f'{name}__{part}', a))
        meshes.append((f'{name}__far', far_cross(frame_w, frame_h, i, h)))
        st = tr.stats()
        meta['variants'].append({'name': name, 'species': species, 'height': h, 'trunk': r, 'frame': [frame_w, frame_h],
                                 'tris': {**st, 'far': 4}})
        log(f'{name:13s} {species:8s} h {h:4.1f} r {r:.2f}  tris', st)
    write_glb(f'{OUT}/trees.glb', meshes)
    json.dump(meta, open(f'{OUT}/trees.json', 'w'), indent=1)
    log('trees.glb', os.path.getsize(f'{OUT}/trees.glb') // 1024, 'KB')

    # impostors: each variant's hi LOD from the side (game +z), albedo + camera-space normal
    sc = reset()
    MODE_MATS.clear()
    sc.cycles.samples = 16 if QUICK else 64
    card_d = img(f'{OUT}/cards-albedo.png'); card_n = img(f'{OUT}/cards-normal.png', 'Non-Color')
    card_mat = bake_material('cards', diff=card_d, alpha_from_diff=True, nor=card_n, vcol=True, ao_dist=1.6, ao_albedo=0.5, nor_strength=1.0,
                             flat_normal_up=0.3)
    bark_mats = [bake_material(f'bark{k}', diff=d, nor=n, vcol=True, color=(1.3, 1.3, 1.3), ao_dist=1.0, ao_albedo=0.4)
                 for k, (d, n) in enumerate(bark_images())]
    atlas = {m: np.zeros((IROWS * ICH, ICOLS * ICW, 4), np.float32) for m in ('albedo', 'normal')}
    cam = ortho_cam(sc, (0, -300, 10), (math.pi / 2, 0, 0), 10, ICW, ICH)
    for i, tr in enumerate(trees):
        obs = tree_objects(tr, ('trunk', 'hi'), bark_mats, card_mat)
        fw, fh = meta['variants'][i]['frame']
        cam.location = (0, -300, fh / 2)
        cam.data.ortho_scale = fh
        col, row = i % ICOLS, i // ICOLS
        for m, name in enumerate(('albedo', 'normal')):
            set_mode(m)
            p = f'{OUT}/imp{i}-{name}.png'
            render(p)
            atlas[name][row * ICH:(row + 1) * ICH, col * ICW:(col + 1) * ICW] = read_px(p)
        for ob in obs:
            bpy.data.objects.remove(ob)
        log('impostor', tr.name)
    mask = atlas['albedo'][..., 3] > 0.3
    write_px(f'{OUT}/impostor-albedo.png', dilate(atlas['albedo'], mask, 12))
    nrm = dilate(atlas['normal'], mask, 12); nrm[..., 3] = 1
    write_px(f'{OUT}/impostor-normal.png', nrm, alpha=False)
    log('impostor atlas written')
    return trees


# ── 4. the lineup (a lit preview) ─────────────────────────────────────────────────────────────────────────────────────
def lit_material(name, diff, nor, alpha=False, vcol=True, color=(1, 1, 1), translucent=0.0):
    mat = bpy.data.materials.new(name)
    b = NB(mat)
    uv = b.n('ShaderNodeUVMap', uv_map='UVMap').outputs[0]
    td = b.n('ShaderNodeTexImage', image=diff); b.link(uv, td.inputs[0])
    col = b.vmath('MULTIPLY', td.outputs['Color'], color)
    if vcol:
        col = b.vmath('MULTIPLY', col, b.n('ShaderNodeVertexColor', layer_name='Col').outputs['Color'])
    bs = b.n('ShaderNodeBsdfPrincipled')
    b.link(col, bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value = 0.85
    tn = b.n('ShaderNodeTexImage', image=nor); b.link(uv, tn.inputs[0])
    nm = b.n('ShaderNodeNormalMap', uv_map='UVMap'); b.link(tn.outputs['Color'], nm.inputs['Color']); b.link(nm.outputs[0], bs.inputs['Normal'])
    shader = bs.outputs[0]
    if translucent > 0:
        tl = b.n('ShaderNodeBsdfTranslucent'); b.link(col, tl.inputs['Color'])
        mx = b.n('ShaderNodeMixShader'); mx.inputs[0].default_value = translucent
        b.link(shader, mx.inputs[1]); b.link(tl.outputs[0], mx.inputs[2]); shader = mx.outputs[0]
    if alpha:
        tr = b.n('ShaderNodeBsdfTransparent')
        mx = b.n('ShaderNodeMixShader'); b.link(td.outputs['Alpha'], mx.inputs[0])
        b.link(tr.outputs[0], mx.inputs[1]); b.link(shader, mx.inputs[2]); shader = mx.outputs[0]
    o = b.n('ShaderNodeOutputMaterial'); b.link(shader, o.inputs['Surface'])
    return mat


def build_lineup(trees):
    sc = reset()
    sc.render.film_transparent = False
    sc.cycles.samples = 24 if QUICK else 96
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'AgX'
    w = sc.world; w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'NISHITA'
    except TypeError:
        pass
    try:
        sky.sun_elevation = math.radians(24); sky.sun_rotation = math.radians(200)
    except AttributeError:
        pass
    bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = 0.35
    nt.links.new(sky.outputs[0], bg.inputs[0])
    wo = nt.nodes.new('ShaderNodeOutputWorld'); nt.links.new(bg.outputs[0], wo.inputs[0])
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4.0; sun.angle = math.radians(1.5)
    so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(62), 0, math.radians(200))
    card_mat = lit_material('cards', img(f'{OUT}/cards-albedo.png'), img(f'{OUT}/cards-normal.png', 'Non-Color'), alpha=True,
                            color=(0.92, 1.0, 0.85), translucent=0.25)
    bark_mats = [lit_material(f'bark{k}', d, n, color=(1.3, 1.3, 1.3)) for k, (d, n) in enumerate(bark_images())]
    x = 0.0
    for tr in trees:
        rad = max(3.0, tr.height * 0.2)
        x += rad
        for ob in tree_objects(tr, ('trunk', 'hi', 'twigs'), bark_mats, card_mat):
            ob.location.x = x
        x += rad + 2
    gm = bpy.data.materials.new('ground'); gm.use_nodes = True
    gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.09, 0.075, 0.05, 1)
    g = make_obj('ground', np.array([[-50, -60, 0], [x + 50, -60, 0], [x + 50, 60, 0], [-50, 60, 0]], float), np.array([0, 1, 2, 0, 2, 3]), mats=[gm], game=False)
    cd = bpy.data.cameras.new('cam'); cd.lens = 50; cd.clip_end = 2000
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam)
    cam.location = (x / 2, -x * 0.95, 18); cam.rotation_euler = (math.radians(86), 0, 0)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 2400, 900
    sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.color_mode = 'RGB'; sc.render.image_settings.quality = 88
    render(f'{OUT}/lineup.jpg')
    del g
    log('lineup.jpg')


if 'bark' in ONLY:
    reset(); build_bark()
if 'cards' in ONLY:
    build_cards()
if 'trees' in ONLY or 'lineup' in ONLY:
    if 'trees' in ONLY:
        TREES = build_trees()
    else:
        TREES = [make() for (_, _, _, _, make) in TG.SPECS]
    if 'lineup' in ONLY:
        build_lineup(TREES)
log('done')
