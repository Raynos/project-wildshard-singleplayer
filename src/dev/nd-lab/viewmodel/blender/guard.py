# guard.py — lab P8 "viewmodel" (E169): the Neon Jian's dragon-head guard, remastered from the TRELLIS.2 generation of
# lab P4 (~/ml/img2mesh/out/nd-hero/guard.{glb,hi.obj}, 9.4 M faces raw) into the lab's asset contract:
#   guard.glb   ~60 k tris in JIAN-local (glTF: grip axis +y, snout toward −x, flank toward +z = the eye), one material
#               `brass`, smooth normals, NO UVs; COLOR_0 = (R AO 5 mm, G curvature = the mesh's pointiness, B albedo
#               detail = the TRELLIS texture's luminance), each normalised (the lab reads them as data);
#               TEXCOORD_0 = the macro normal (a heavily smoothed copy's, Blender axes, octahedral) for the painted values
# Run: blender -b --factory-startup --python guard.py -- <out dir> [--tris 60000] [--len 0.135] [--subdiv 2]
import bpy, bmesh, sys, os, time, math
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/guard-out'
def opt(name, d):
    return type(d)(argv[argv.index(name) + 1]) if name in argv else d
TRIS = opt('--tris', 60000)
LEN = opt('--len', 0.135)
CLIP = opt('--clip', 0.2)          # drop the back share of the length (the socket ring)
SMOOTH = opt('--smooth', 40)       # iterations of the macro-normal smoothing (COLOR_1)
SUBDIV = opt('--subdiv', 2)        # simple subdivisions of the 39 k mesh before the shrink-wrap
SRC = os.path.expanduser('~/ml/img2mesh/out/nd-hero/guard')
os.makedirs(OUT, exist_ok=True)
t0 = time.time()
def log(*a):
    print('[guard %5.1fs]' % (time.time() - t0), *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.get_devices()
for d in prefs.devices:
    d.use = True
sc.cycles.device = 'GPU'
sc.cycles.samples = 64

def only(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o

# 1. the textured TRELLIS mesh (colour source) and the raw 9.4 M-face mesh (shape source); raw frame: crown +Z,
#    snout −Y, the socket ring at +Y, length ≈ 1.0 along Y
bpy.ops.import_scene.gltf(filepath=SRC + '.glb')
G = [o for o in sc.objects if o.type == 'MESH'][0]
G.name = 'tex'
bpy.ops.wm.obj_import(filepath=SRC + '.hi.obj')
H = [o for o in sc.objects if o.type == 'MESH' and o is not G][0]
H.name = 'hi'
for o in (G, H):
    only(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bb = [Vector(c) for c in o.bound_box]
    log(o.name, len(o.data.polygons), 'faces, bbox', [round(min(v[i] for v in bb), 3) for i in range(3)], [round(max(v[i] for v in bb), 3) for i in range(3)])

# the OBJ importer's axis conversion leaves the raw rotated +90° about X relative to the glb (measured: nearest-point
# median 0.1 mm with this fix, 38 mm without)
H.data.transform(Matrix.Rotation(-math.pi / 2, 4, 'X'))
H.data.update()

# 2. the game mesh, in raw axes: the textured TRELLIS mesh (39 k, clean topology; a collapse of the 9.4 M raw stalls at
#    330 k tris on its boundary edges) subdivided …
ys = [v.co.y for v in G.data.vertices]
y0, y1 = min(ys), max(ys)
cut = y1 - (y1 - y0) * CLIP
L = G.copy()
L.data = G.data.copy()
L.name = 'guard'
sc.collection.objects.link(L)
only(L)
L.data.materials.clear()
# (no voxel remesh: neither TRELLIS mesh is watertight, and OpenVDB turns an open shell into crumbs)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0002)
bpy.ops.object.mode_set(mode='OBJECT')
sd = L.modifiers.new('sd', 'SUBSURF')
sd.subdivision_type = 'SIMPLE'
sd.levels = SUBDIV
bpy.ops.object.modifier_apply(modifier='sd')
log('subdivided', len(L.data.polygons), 'faces')
# … shrink-wrapped onto the raw sculpt, so its fine detail (scales, fangs, whiskers, the mane's grooves) comes back …
sw = L.modifiers.new('sw', 'SHRINKWRAP')
sw.target = H
sw.wrap_method = 'NEAREST_SURFACEPOINT'
bpy.ops.object.modifier_apply(modifier='sw')
sm = L.modifiers.new('sm', 'CORRECTIVE_SMOOTH')
sm.iterations = 1
sm.smooth_type = 'LENGTH_WEIGHTED'
sm.use_only_smooth = True
bpy.ops.object.modifier_apply(modifier='sm')
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.quads_convert_to_tris()
bpy.ops.object.mode_set(mode='OBJECT')
# … then the socket ring clipped off (faces whose centre is in the back CLIP share of Y)
bm = bmesh.new()
bm.from_mesh(L.data)
kill = [f for f in bm.faces if f.calc_center_median().y > cut]
bmesh.ops.delete(bm, geom=kill, context='FACES')
bm.to_mesh(L.data)
bm.free()
log('clipped at', round(cut, 3), '→', len(L.data.polygons), 'faces')

# 3. into JIAN-local (Blender axes: +Z = the blade = glTF +y; −X = the snout = glTF −x; −Y = the eye = glTF +z):
#    rotate −90° about Z (raw −Y snout → −X, raw +X flank → −Y), scale the FULL raw length to LEN, centre the full
#    bbox at glTF (−0.004, 0.006, 0) = Blender (−0.004, 0, 0.006) (lab P4's guardMatrix)
s = LEN / (y1 - y0)
bbG = [Vector(c) for c in G.bound_box]
cz = (min(v.z for v in bbG) + max(v.z for v in bbG)) / 2
cx = (min(v.x for v in bbG) + max(v.x for v in bbG)) / 2
cy = (y0 + y1) / 2
M = Matrix.Translation((-0.004, 0, 0.006)) @ Matrix.Rotation(-math.pi / 2, 4, 'Z') @ Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -cz))
for o in (G, H, L):
    o.data.transform(M)
    o.data.update()

# 4. no UVs: at ~60 k tris the guard carries its detail in geometry, and the maps are baked into the vertex colours
#    (a 1024² atlas of a TRELLIS head smart-projects into ~3 000 islands whose seams speckle)
n0 = len(L.data.polygons)
# decimate to budget (a second pass if the collapse stops short)
for _ in range(4):
    nt0 = len(L.data.polygons)
    if nt0 <= TRIS * 1.08:
        break
    dec = L.modifiers.new('dec', 'DECIMATE')
    dec.ratio = min(1.0, TRIS / max(1, nt0))
    dec.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
    log('decimate pass', nt0, '→', len(L.data.polygons))
# drop crumbs (loose parts under 0.5 % of the vertices)
bm = bmesh.new()
bm.from_mesh(L.data)
bm.verts.ensure_lookup_table()
seen = set()
parts = []
for v in bm.verts:
    if v.index in seen:
        continue
    stack = [v]
    comp = []
    seen.add(v.index)
    while stack:
        a = stack.pop()
        comp.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen:
                seen.add(b.index)
                stack.append(b)
    parts.append(comp)
big = max(len(c) for c in parts)
kill = [v for c in parts if len(c) < big * 0.005 for v in c]
bmesh.ops.delete(bm, geom=kill, context='VERTS')
bm.to_mesh(L.data)
bm.free()
for p in L.data.polygons:
    p.use_smooth = True
log('game mesh', n0, '→', len(L.data.polygons), 'tris,', len(parts), 'parts,', len(kill), 'crumb verts dropped')

mat = bpy.data.materials.new('brass')
L.data.materials.append(mat)

def vbake(kind, src, **kw):
    """bake into a fresh float colour attribute on L (per corner), return per-VERTEX rgb (averaged over corners)"""
    name = 'b_' + kind + str(len(L.data.color_attributes))
    ca = L.data.color_attributes.new(name, 'FLOAT_COLOR', 'CORNER')
    L.data.color_attributes.active_color = ca
    bpy.ops.object.select_all(action='DESELECT')
    if src is not None:
        src.select_set(True)
    L.select_set(True)
    bpy.context.view_layer.objects.active = L
    bpy.ops.object.bake(type=kind, target='VERTEX_COLORS', use_selected_to_active=src is not None, cage_extrusion=0.0015, max_ray_distance=0.004, **kw)
    n = len(L.data.loops)
    buf = np.zeros(n * 4, dtype=np.float32)
    ca.data.foreach_get('color', buf)
    buf = buf.reshape(n, 4)
    vi = np.zeros(n, dtype=np.int64)
    L.data.loops.foreach_get('vertex_index', vi)
    nv = len(L.data.vertices)
    acc = np.zeros((nv, 3))
    cnt = np.zeros(nv)
    np.add.at(acc, vi, buf[:, :3])
    np.add.at(cnt, vi, 1)
    return acc / np.maximum(cnt, 1)[:, None]

def emit_mat(o, build):
    m = bpy.data.materials.new('emit_' + o.name)
    m.use_nodes = True
    t = m.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    out = t.nodes.new('ShaderNodeOutputMaterial')
    em = t.nodes.new('ShaderNodeEmission')
    t.links.new(em.outputs[0], out.inputs[0])
    build(t, em)
    o.data.materials.clear()
    o.data.materials.append(m)
    return m

# 5a. AO of the game mesh (it is detailed enough), 5 mm
sc.world = bpy.data.worlds.new('w')
sc.world.light_settings.distance = 0.005
ao = vbake('AO', None)[:, 0]
log('baked AO')
# 5b. curvature: the game mesh's own pointiness (the form's mid-scale convex / concave)
def curv_nodes(t, em):
    geo = t.nodes.new('ShaderNodeNewGeometry')
    t.links.new(geo.outputs['Pointiness'], em.inputs['Color'])
emit_mat(L, curv_nodes)
cv = vbake('EMIT', None)[:, 0]
log('baked curvature')
# 5c. albedo detail: the TRELLIS texture's luminance, from the textured mesh
tex_img = None
for m in G.data.materials:
    if m and m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and n.image.size[0] > 0 and tex_img is None:
                tex_img = n.image
def col_nodes(t, em):
    tn = t.nodes.new('ShaderNodeTexImage')
    tn.image = tex_img
    t.links.new(tn.outputs['Color'], em.inputs['Color'])
emit_mat(G, col_nodes)
alb = vbake('EMIT', G)
log('baked albedo')

def norm01(v, lo_p, hi_p, centre=False):
    lo, hi = np.percentile(v, lo_p), np.percentile(v, hi_p)
    if not centre:
        return np.clip((v - lo) / max(hi - lo, 1e-6), 0, 1)
    c = np.median(v)
    span = max(hi - c, c - lo, 1e-6)
    return np.clip(0.5 + (v - c) / span * 0.5, 0, 1)
aoC = 0.25 + 0.75 * norm01(np.clip(ao, 0, 1), 1, 99.5)
cvC = norm01(cv, 2, 98, centre=True)
lum = 0.2126 * alb[:, 0] + 0.7152 * alb[:, 1] + 0.0722 * alb[:, 2]
alC = norm01(lum, 2, 98, centre=True)
log('AO mean %.2f, curvature std %.3f, detail std %.3f' % (aoC.mean(), cvC.std(), alC.std()))

# 6. one byte colour attribute COLOR_0 = (AO, curvature, detail), per point
for a in list(L.data.color_attributes):
    L.data.color_attributes.remove(a)
ca = L.data.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
rgba = np.stack([aoC, cvC, alC, np.ones_like(aoC)], -1).astype(np.float32)
# the exporter writes the attribute's LINEAR `color` values as COLOR_0, so COLOR_0 = these data values as they are
ca.data.foreach_set('color', rgba.ravel())
# the MACRO normal (Blender axes): the normals of a heavily smoothed copy. The lab lights the
# big value shapes from it (a painter's light and shadow) and keeps the sculpt's own normals for glints and ink.
S = L.copy()
S.data = L.data.copy()
sc.collection.objects.link(S)
only(S)
smo = S.modifiers.new('smo', 'SMOOTH')
smo.factor = 0.9
smo.iterations = SMOOTH
bpy.ops.object.modifier_apply(modifier='smo')
nv = len(S.data.vertices)
ns = np.zeros(nv * 3, dtype=np.float32)
S.data.vertices.foreach_get('normal', ns)
ns = ns.reshape(nv, 3)
bpy.data.objects.remove(S, do_unlink=True)
# (a second colour attribute exports as all ones next to COLOR_0: the macro normal rides TEXCOORD_0 instead,
# octahedral-encoded; the exporter flips v, the lab undoes it)
ns = ns / np.maximum(np.abs(ns).sum(1, keepdims=True), 1e-9)
ox, oy = ns[:, 0].copy(), ns[:, 1].copy()
neg = ns[:, 2] < 0
ox[neg] = (1 - np.abs(ns[neg, 1])) * np.sign(ns[neg, 0])
oy[neg] = (1 - np.abs(ns[neg, 0])) * np.sign(ns[neg, 1])
oct_uv = np.stack([ox * 0.5 + 0.5, oy * 0.5 + 0.5], 1)
for u in list(L.data.uv_layers):
    L.data.uv_layers.remove(u)
uvl = L.data.uv_layers.new(name='Ns')
vi = np.zeros(len(L.data.loops), dtype=np.int64)
L.data.loops.foreach_get('vertex_index', vi)
uvl.data.foreach_set('uv', oct_uv[vi].astype(np.float32).ravel())
L.data.color_attributes.active_color = ca
# the material reads the colour attribute, so the glTF exporter writes COLOR_0 (and gltf-transform keeps it)
mat.use_nodes = True
mt = mat.node_tree
bsdf = next(n for n in mt.nodes if n.type == 'BSDF_PRINCIPLED')
vc = mt.nodes.new('ShaderNodeVertexColor')
vc.layer_name = 'Col'
mt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
L.data.materials.clear()
L.data.materials.append(mat)

# 7. export the game mesh only
for o in list(sc.objects):
    if o is not L:
        bpy.data.objects.remove(o, do_unlink=True)
only(L)
raw = os.path.join(OUT, 'guard.raw.glb')
bpy.ops.export_scene.gltf(filepath=raw, export_format='GLB', use_selection=True, export_normals=True, export_texcoords=True,
                          export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False, export_materials='EXPORT', export_image_format='NONE', export_yup=True, export_apply=True)
log('exported', raw, len(L.data.polygons), 'tris')
