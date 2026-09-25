"""
build_cave.py — the Den's bear cave for PH-B2 (PINE-HOLLOW-REMASTER). Run by scripts/blender/crags/run.sh:

    blender -b --factory-startup -P scripts/blender/crags/build_cave.py -- <cave-in.json> <out dir> [--preview]

Input (export-cave.mjs): the baked heights on a 1 m grid in the cave's frame (lx across, lz into the rock from the mouth
at BEAR_CAVE, y the world height) and the hero arch's pose there.

The cave, ~36 m from the arch to the back wall: an antechamber inside the arch (5 m wide, 4.5 m high), a passage that
narrows and bends left, THE SQUEEZE (1.6 m wide, 2.2 m high, 4 m long), and the bear's room (≈ 12 × 14 m, up to 6 m
high) — its bed of dry grass and twigs in a nook at the back, the bones of old meals by the way in, rubble, a crack in
the roof (a chimney up to the surface) whose light falls on the floor, and drips.

Built as one solid: the passage is a chain of ellipsoids (+ the room's, + the chimney) voxel-remeshed into one cavity,
its floor flattened to a walkable profile, its walls roughened; the rock round it is the same chain inflated (3 m over the
first metres — THE HOOD, the rock over the passage where it runs shallower than the slope — 0.7 m deeper in, where the
heightfield is far overhead) and the cavity is boolean-subtracted from it, so the mesh is closed: the interior and the
hood's outside in one. Exterior faces deep under the ground are dropped; the chimney is opened just under the surface.

Vertex data (the game's crag material, src/world/PineCrags.ts): COLOR_0 = (sky light, sun reach, wet, rock);
TEXCOORD_0 = (tint brightness, tint id: 0.1 bone, 0.4 straw, 0.8 twig) on the bedding and the bones (rock = 0).
Sky light = Cycles AO (sky visibility, 25 m, the ground as an occluder except over the mouth and the chimney) diffused a
little along the surface (the light the walls pass on round the bends).

Output: <out>/cave.glb (nodes `cave`, `cave-far` = the hood's outside decimated for distance, `cave-col` = the collision
shell), <out>/cave.json (the game's cave data: terrain holes, physics cuts, audio spots, footprint, shaft, drips, floor).
"""
import json
import math
import os
import random
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rocklib as R  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
INP, OUT = argv[0], argv[1]
PREVIEW = '--preview' in argv
os.makedirs(OUT, exist_ok=True)
T0 = time.time()


def log(*a):
    print(f'[cave {time.time() - T0:6.1f}s]', *a, flush=True)


S = json.load(open(INP))
G = S['grid']
H = np.array(G['h'], np.float32).reshape(G['nz'], G['nx'])


def ground(lx, lz):
    """the baked heights, bilinear, in the cave frame"""
    fx = (lx - G['x0']) / G['step']; fz = (lz - G['z0']) / G['step']
    i = int(np.clip(math.floor(fx), 0, G['nx'] - 2)); j = int(np.clip(math.floor(fz), 0, G['nz'] - 2))
    tx = min(1, max(0, fx - i)); tz = min(1, max(0, fz - j))
    a = H[j, i] * (1 - tx) + H[j, i + 1] * tx
    b = H[j + 1, i] * (1 - tx) + H[j + 1, i + 1] * tx
    return float(a * (1 - tz) + b * tz)


def B(lx, y, lz):
    """cave frame → Blender (the glTF export turns Blender (x, y, z) into (x, z, −y): lz ↔ −y)"""
    return Vector((lx, -lz, y))


scene = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
if scene.world is None:
    scene.world = bpy.data.worlds.new('world')
rng = random.Random(1337)

# ── the floor profile and the passage ────────────────────────────────────────────────────────────────────────────────
F0 = ground(0, -1.2)                       # the den's ground at the arch's lip: the floor starts level with it


def floor_at(lz):
    """the walkable floor: level through the antechamber and the squeeze, down 0.55 m into the room (≈ 7°)"""
    if lz <= 0:
        return F0
    if lz <= 12:
        return F0 - 0.25 * lz / 12
    if lz <= 19.5:
        return F0 - 0.25 - 0.1 * (lz - 12) / 7.5
    if lz <= 24:
        return F0 - 0.35 - 0.55 * (lz - 19.5) / 4.5
    return F0 - 0.9


# (lz, lx, width, height): the centreline and its section, mouth → the room's door
PATH = [(-4.5, 0.0, 5.4, 4.8), (-1.0, 0.0, 5.0, 4.5), (2.0, 0.0, 4.8, 4.2), (5.0, -0.3, 4.4, 3.8), (8.0, -1.0, 3.8, 3.3),
        (11.0, -1.6, 2.9, 2.8), (13.5, -1.4, 1.95, 2.35), (15.5, -0.8, 1.6, 2.2), (17.5, -0.1, 1.65, 2.25), (19.5, 0.5, 2.8, 2.9),
        (21.0, 0.6, 4.2, 3.4)]
ROOM = [  # (lz, lx, half across, half along, height above the floor) — the room and its lobes
    (27.0, 0.4, 6.0, 7.0, 5.8), (24.0, -3.0, 3.4, 3.8, 4.2), (30.5, 3.8, 3.0, 3.0, 3.2), (33.0, -1.4, 3.2, 2.6, 3.6), (27.5, -4.4, 2.4, 3.0, 3.4)]
CHIMNEY = {'lx': -2.2, 'lz': 25.5, 'w': 0.8, 'l': 3.8, 'turn': 0.35}
NOOK = (31.0, 3.9)                         # the bed
BONES = (23.0, -1.2)                       # the old meals, just inside the room


def sect(lz):
    """the passage's (lx, width, height) at lz, interpolated along PATH"""
    for a, b in zip(PATH, PATH[1:]):
        if a[0] <= lz <= b[0]:
            t = (lz - a[0]) / (b[0] - a[0])
            return tuple(a[k] + (b[k] - a[k]) * t for k in (1, 2, 3))
    last = PATH[-1] if lz > PATH[-1][0] else PATH[0]
    return last[1], last[2], last[3]


def ellipsoid(bm, c, r):
    """a UV-sphere ellipsoid at c (Blender) with radii r (Blender axes), into bm"""
    tmp = bmesh.new()
    bmesh.ops.create_uvsphere(tmp, u_segments=20, v_segments=12, radius=1.0)
    for v in tmp.verts:
        v.co = Vector((c.x + v.co.x * r.x, c.y + v.co.y * r.y, c.z + v.co.z * r.z))
    me = bpy.data.meshes.new('tmp'); tmp.to_mesh(me); tmp.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)


def chain(infl_near, infl_far, lz0, lz1, chimney_top):
    """the cavity (inflation 0) or the rock round it (inflation > 0) as one bmesh of overlapping primitives"""
    bm = bmesh.new()
    lz = lz0
    while lz <= min(lz1, PATH[-1][0]):
        lx, w, h = sect(lz)
        t = min(1.0, max(0.0, (lz - 12.0) / 6.0))
        inf = infl_near * (1 - t) + infl_far * t
        f = floor_at(lz)
        ellipsoid(bm, B(lx, f + h * 0.42, lz), Vector((w / 2 + inf, 0.95 + inf, h * 0.62 + inf)))
        lz += 0.6
    if lz1 >= ROOM[0][0] - 8:
        for (rz, rx, ha, hl, hh) in ROOM:
            f = floor_at(rz)
            inf = infl_far
            ellipsoid(bm, B(rx, f + hh * 0.45, rz), Vector((ha + inf, hl + inf, hh * 0.6 + inf)))
        # the chimney: a slanted slot from the room's roof up past the ground
        c = CHIMNEY
        f = floor_at(c['lz'])
        top = chimney_top + 1.5
        for k in range(8):
            y = f + 3.8 + (top - f - 3.8) * k / 7
            off = 0.35 * math.sin(k * 1.3)
            ellipsoid(bm, B(c['lx'] + off, y, c['lz'] + k * 0.12), Vector((c['w'] / 2 + infl_far * 0.8, c['l'] / 2 + infl_far * 0.5, (top - f - 3.8) / 7 + 0.4)))
    return bm


def remeshed(bm, name, voxel):
    ob = R.bm_to_object(bm, name, scene)
    mod = ob.modifiers.new('rm', 'REMESH'); mod.mode = 'VOXEL'; mod.voxel_size = voxel; mod.use_smooth_shade = False
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


chim_top = ground(CHIMNEY['lx'], CHIMNEY['lz'])
log(f'floor at the lip {F0:.2f}; the ground over the chimney {chim_top:.1f}')

def apply_bool(ob, cutter, op):
    mod = ob.modifiers.new('b', 'BOOLEAN'); mod.operation = op; mod.solver = 'EXACT'; mod.object = cutter
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def floor_block():
    """a closed solid whose top is the floor profile (0.5 m grid over the cave) and whose bottom is far under it"""
    xs = np.arange(-16, 16.01, 0.5); zs = np.arange(-9, 44.01, 0.5)
    nx, nz = len(xs), len(zs)
    verts = [B(x, floor_at(z) + 0.02 * noise.noise(Vector((x * 0.9, z * 0.9, 0.0))), z) for z in zs for x in xs]
    verts += [B(x, -60.0, z) for z in zs for x in xs]
    faces = []
    off = nx * nz
    for j in range(nz - 1):
        for i in range(nx - 1):
            a = j * nx + i
            faces.append((a, a + nx, a + nx + 1, a + 1))                       # the top, facing up
            faces.append((off + a, off + a + 1, off + a + nx + 1, off + a + nx))  # the bottom, facing down
    for i in range(nx - 1):                                                    # the four sides
        faces.append((i, i + 1, off + i + 1, off + i))
        a, b = (nz - 1) * nx + i, (nz - 1) * nx + i + 1
        faces.append((b, a, off + a, off + b))
    for j in range(nz - 1):
        a, b = j * nx, (j + 1) * nx
        faces.append((b, a, off + a, off + b))
        a, b = j * nx + nx - 1, (j + 1) * nx + nx - 1
        faces.append((a, b, off + b, off + a))
    me = bpy.data.meshes.new('floorblock'); me.from_pydata(verts, [], faces); me.validate(); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('floorblock', me); scene.collection.objects.link(ob)
    return ob


cav = remeshed(chain(0, 0, -4.5, 40, chim_top), 'cavity', 0.2)
# the floor: the cavity above the walkable profile (a flat floor, a crease where the walls meet it)
fblk = floor_block()
apply_bool(cav, fblk, 'DIFFERENCE')
bpy.data.objects.remove(fblk)
log('cavity with its floor', R.tri_count(cav))
# the walls and the roof: rough granite (along the normals: outward of the cavity volume)
me = cav.data
bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
o = Vector((13.1, 7.7, 3.3))
for v in bm.verts:
    lz = -v.co.y
    f = floor_at(lz)
    k = min(1.0, max(0.0, (v.co.z - f - 0.12) / 0.5))
    if k <= 0:
        continue
    n = 0.26 * noise.fractal(v.co * 0.45 + o, 0.9, 2.0, 3) + 0.1 * (noise.cell(v.co * 1.1 + o) - 0.5) + 0.05 * noise.noise(v.co * 3.0 + o)
    v.co += v.normal * n * k
bm.to_mesh(me); bm.free()
log('cavity', R.tri_count(cav))

rock = remeshed(chain(3.0, 0.7, -1.2, 40, chim_top), 'rock', 0.3)
bm = bmesh.new(); bm.from_mesh(rock.data)
res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=B(0, 0, -1.6), plane_no=Vector((0, 1, 0)), clear_outer=True)
edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
if edges:
    bmesh.ops.holes_fill(bm, edges=edges, sides=0)
bmesh.ops.triangulate(bm, faces=bm.faces[:])
bm.normal_update()
for v in bm.verts:   # the hood's outside: blocky, jointed
    n = 0.5 * noise.fractal(v.co * 0.25 + o, 0.9, 2.0, 3) + 0.35 * (noise.cell(v.co * 0.45 + o) - 0.5)
    v.co += v.normal * n
bm.to_mesh(rock.data); bm.free()
log('rock', R.tri_count(rock))

def stats(ob, tag):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    nm = sum(1 for e in bm.edges if not e.is_manifold); vol = bm.calc_volume(signed=True); bm.free()
    log(tag, ob.name, 'tris', R.tri_count(ob), 'non-manifold edges', nm, 'volume', round(vol))


for o in (rock, cav):   # both outward-facing (a remesh / a boolean can hand one back inside out)
    bm = bmesh.new(); bm.from_mesh(o.data)
    if bm.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        log('flipped', o.name)
    bm.to_mesh(o.data); bm.free()
stats(rock, 'rock'); stats(cav, 'cavity')
cav_bvh = BVHTree.FromObject(cav, bpy.context.evaluated_depsgraph_get())


def interior(co):
    """on the cavity's surface (the interior's faces)"""
    hit = cav_bvh.find_nearest(co)
    return hit[0] is not None and hit[3] < 0.12


def inside_cavity(co):
    hit = cav_bvh.find_nearest(co)
    return hit[0] is not None and (co - hit[0]).dot(hit[1]) < 0


def chimney_top(c):
    return math.hypot(c.x - CHIMNEY['lx'], -c.y - CHIMNEY['lz']) < 3.5 and c.z > ground(c.x, -c.y) - 0.35


# the interior: the cavity's own (closed, manifold) surface turned inward, cut at the rock's front and under the chimney's top
inner = R.copy_object(cav, 'inner', scene)
bm = bmesh.new(); bm.from_mesh(inner.data)
bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
bmesh.ops.delete(bm, geom=[f for f in bm.faces if -f.calc_center_median().y < -1.6 or chimney_top(f.calc_center_median())], context='FACES')
bm.to_mesh(inner.data); bm.free()
# the hood: the rock's outside where it is not the mouth (inside the cavity) and not deep under the ground
bm = bmesh.new(); bm.from_mesh(rock.data)
kill = []
for f in bm.faces:
    c = f.calc_center_median(); lz = -c.y
    if inside_cavity(c) or chimney_top(c):
        kill.append(f); continue
    if lz > 16 and all(v.co.z < ground(v.co.x, -v.co.y) - 1.0 for v in f.verts):
        kill.append(f)
bmesh.ops.delete(bm, geom=kill, context='FACES')
bm.to_mesh(rock.data); bm.free()
cav.hide_render = True
bpy.ops.object.select_all(action='DESELECT')
inner.select_set(True); rock.select_set(True); bpy.context.view_layer.objects.active = rock
bpy.ops.object.join()
for p in rock.data.polygons:
    p.material_index = 0
log('trimmed', R.tri_count(rock))

shell = rock
shell.name = 'cave'; shell.data.name = 'cave'
col = R.copy_object(shell, 'cave-col', scene)
R.decimate(shell, 17000)
R.decimate(col, 5000)
R.smooth_by_angle(shell, 50)

# the far hood: the outside only, over the first 16 m
far = R.copy_object(shell, 'cave-far', scene)
bm = bmesh.new(); bm.from_mesh(far.data)
bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[f for f in bm.faces if interior(f.calc_center_median()) or -f.calc_center_median().y > 17], context='FACES')
bm.to_mesh(far.data); bm.free()
R.decimate(far, 1400)
log('cave', R.tri_count(shell), 'far', R.tri_count(far), 'col', R.tri_count(col))

# ── the bed, the bones, the rubble (merged into the cave; tint in the UV) ─────────────────────────────────────────────
props = bmesh.new()
tints = []   # per prop vertex (brightness, id, rock)


def add_bm(b, tint):
    me2 = bpy.data.meshes.new('p'); b.to_mesh(me2); b.free()
    n0 = len(props.verts)
    props.from_mesh(me2); bpy.data.meshes.remove(me2)
    props.verts.ensure_lookup_table()
    for v in props.verts[n0:]:
        tints.append(tint(v.co))


nz, nx = NOOK
fb = floor_at(nz)
# the bed: a low oval mound of dry grass, a litter ring, twigs
m = bmesh.new(); bmesh.ops.create_uvsphere(m, u_segments=24, v_segments=10, radius=1.0)
for v in m.verts:
    z = max(0.0, v.co.z)
    r = 1 + 0.12 * noise.noise(v.co * 3.1)
    v.co = B(nx + v.co.x * 1.35 * r, fb - 0.05 + z * 0.38 * (1 + 0.3 * noise.noise(v.co * 5.0)), nz + v.co.y * 1.05 * r)
add_bm(m, lambda c: (0.8 + 0.35 * noise.noise(c * 4.0), 0.4, 0.0))
d = bmesh.new(); bmesh.ops.create_circle(d, cap_ends=True, segments=20, radius=1.0)
for v in d.verts:
    v.co = B(nx + v.co.x * 2.2 + 0.2, fb + 0.02, nz + v.co.y * 1.8)
add_bm(d, lambda c: (0.5, 0.4, 0.0))
for _ in range(70):
    a = rng.uniform(0, math.tau); r = math.sqrt(rng.random()) * 1.9
    L = rng.uniform(0.3, 1.0); t = rng.uniform(0.018, 0.04)
    tw = bmesh.new(); bmesh.ops.create_cube(tw, size=1.0)
    yaw = rng.uniform(0, math.tau)
    cx, cz = nx + math.cos(a) * r * 1.2, nz + math.sin(a) * r
    lift = 0.3 * max(0, 1 - r / 1.3)
    for v in tw.verts:
        p = Vector((v.co.x * L, v.co.y * t, v.co.z * t))
        p = Vector((p.x * math.cos(yaw) - p.y * math.sin(yaw), p.x * math.sin(yaw) + p.y * math.cos(yaw), p.z + rng.uniform(-0.02, 0.02)))
        v.co = B(cx + p.x, fb + 0.03 + lift + p.z + p.x * 0.1, cz + p.y)
    add_bm(tw, lambda c: (0.8, 0.8, 0.0))
# the bones: a deer's skull (antler stubs), long bones, ribs, a jaw
bz, bx = BONES
fb = floor_at(bz)


def tube(p0, p1, r, seg=5):
    t = bmesh.new()
    bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r * 0.85, depth=1.0)
    d = p1 - p0
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    for v in t.verts:
        v.co = p0 + q @ Vector((v.co.x, v.co.y, (v.co.z + 0.5) * d.length))
    return t


bone = lambda c: (0.85 + 0.2 * noise.noise(c * 7.0), 0.1, 0.0)  # noqa: E731
sk = bmesh.new(); bmesh.ops.create_uvsphere(sk, u_segments=12, v_segments=8, radius=1.0)
for v in sk.verts:
    v.co = B(bx + v.co.x * 0.11, fb + 0.1 + v.co.z * 0.09, bz + v.co.y * 0.17 + (0.08 if v.co.y > 0.3 else 0))
add_bm(sk, bone)
for s in (-1, 1):
    add_bm(tube(B(bx + s * 0.06, fb + 0.15, bz - 0.08), B(bx + s * 0.22, fb + 0.3, bz - 0.2), 0.022), bone)
for _ in range(8):
    a = rng.uniform(0, math.tau); r = rng.uniform(0.3, 1.6)
    c = Vector((bx + math.cos(a) * r, 0, bz + math.sin(a) * r))
    L = rng.uniform(0.25, 0.5); yaw = rng.uniform(0, math.tau)
    p0 = B(c.x - math.cos(yaw) * L / 2, fb + 0.03, c.z - math.sin(yaw) * L / 2)
    p1 = B(c.x + math.cos(yaw) * L / 2, fb + 0.04, c.z + math.sin(yaw) * L / 2)
    add_bm(tube(p0, p1, rng.uniform(0.02, 0.032)), bone)
for k in range(7):   # a rib cage on its side
    for j in range(4):
        a0, a1 = j / 4 * math.pi * 0.8, (j + 1) / 4 * math.pi * 0.8
        z0 = bz + 0.9 + k * 0.1
        p0 = B(bx + 0.9 + math.cos(a0) * 0.28, fb + 0.02 + math.sin(a0) * 0.2, z0)
        p1 = B(bx + 0.9 + math.cos(a1) * 0.28, fb + 0.02 + math.sin(a1) * 0.2, z0)
        add_bm(tube(p0, p1, 0.012, 4), bone)
# rubble along the floor (granite: tint rock)
for _ in range(26):
    lz = rng.uniform(1.5, 34); lx, w, h = sect(min(lz, 21))
    if lz > 21:
        lx = rng.uniform(-4.5, 4.5)
    else:
        lx += rng.uniform(-w / 2 + 0.3, w / 2 - 0.3)
    s = rng.uniform(0.12, 0.4)
    st = R.convex_block(rng, s * 1.3, s, s * 0.7, cuts=5, chamfer=(0, 0), wobble=0, seg=10, lump=0.12, round_=0.3, sub=1)
    yaw = rng.uniform(0, math.tau)
    R.transform_bm(st, R.M(lx, -lz, floor_at(lz) - s * 0.2, yaw))
    add_bm(st, lambda c: (1.0, 0.0, 1.0))
pob = R.bm_to_object(props, 'props', scene, clean=False)
log('props', R.tri_count(pob))

# ── the vertex data: sky light (AO through the mouth and the chimney), sun reach, wet, rock/tint ──────────────────────
# the ground as the bake's occluder: the grid, minus the mouth's hole and the chimney's top
verts, faces = [], []
nxg, nzg = G['nx'], G['nz']
for j in range(nzg):
    for i in range(nxg):
        lx, lz = G['x0'] + i, G['z0'] + j
        verts.append(B(lx, float(H[j, i]), lz))
for j in range(nzg - 1):
    for i in range(nxg - 1):
        lx, lz = G['x0'] + i + 0.5, G['z0'] + j + 0.5
        if -3 < lz < 15 and abs(lx - sect(lz)[0]) < 5:
            continue
        if math.hypot(lx - CHIMNEY['lx'], lz - CHIMNEY['lz']) < 3.2:
            continue
        a = j * nxg + i
        faces.append((a, a + 1, a + nxg + 1, a + nxg))
gm = bpy.data.meshes.new('groundocc'); gm.from_pydata(verts, [], faces)
gob = bpy.data.objects.new('groundocc', gm); scene.collection.objects.link(gob)
arch = None
try:
    bpy.ops.import_scene.gltf(filepath=S['arch']['glb'])
    arch = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    A = S['arch']
    for o in arch:
        o.location = B(A['lx'], A['y'], A['lz'])
        o.rotation_mode = 'XYZ'; o.rotation_euler = (0, 0, A['yaw'])
        o.scale = (A['scale'],) * 3
except Exception as e:  # noqa: BLE001 — the arch is only an occluder for the bake
    log('arch import failed', e)
log('bake the sky light …')
col.hide_render = True; far.hide_render = True
ao = R.bake_vertex_ao([shell, pob], 25.0, scene, samples=160)
far.hide_render = False; shell.hide_render = True; pob.hide_render = True
ao.update(R.bake_vertex_ao([far], 25.0, scene, samples=64))
shell.hide_render = False; pob.hide_render = False
bpy.data.objects.remove(gob)
for o in arch or []:
    bpy.data.objects.remove(o)


def diffuse(ob, a, rounds=70, keep=0.955):
    """the light the walls pass on: each round a vertex takes the brighter of itself and `keep` × its neighbours' mean"""
    me = ob.data
    n = len(me.vertices)
    e = np.empty(len(me.edges) * 2, np.int32); me.edges.foreach_get('vertices', e); e = e.reshape(-1, 2)
    a = a.copy()
    deg = np.bincount(e.ravel(), minlength=n).astype(np.float32); deg[deg == 0] = 1
    for _ in range(rounds):
        s = np.zeros(n, np.float32)
        np.add.at(s, e[:, 0], a[e[:, 1]]); np.add.at(s, e[:, 1], a[e[:, 0]])
        a = np.maximum(a, keep * s / deg)
    return a


def data_for(ob, a, is_props=False):
    me = ob.data
    v = R.vertex_array(ob)
    n = len(v)
    lz = -v[:, 1]; y = v[:, 2]
    inside = np.zeros(n, bool)
    if not is_props:
        for i in range(n):
            inside[i] = interior(Vector(v[i]))
    else:
        inside[:] = True
    sky = np.clip(a, 0, 1)
    sun = np.where(inside, np.clip(1 - (lz + 1.0) / 3.5, 0, 1), 1.0)
    floor = np.array([floor_at(z) for z in lz], np.float32)
    wet = np.where(inside, 0.12 * np.clip(1 - (y - floor) / 0.4, 0, 1), 0.0)
    for (dx, dy, dz, df) in DRIPS:
        d = np.hypot(v[:, 0] - dx, lz - dz)
        wet = np.maximum(wet, np.where(inside, 0.85 * np.clip(1 - d / 0.8, 0, 1) * np.clip(1 - (y - df) / 0.3, 0, 1), 0))
        wet = np.maximum(wet, np.where(inside & (y > df + 0.3), 0.45 * np.clip(1 - d / 0.45, 0, 1), 0))
    rockw = np.ones(n, np.float32)
    uv_vert = np.zeros((n, 2), np.float32)
    if is_props:
        t = np.array(tints, np.float32)
        rockw = t[:, 2]; uv_vert = t[:, :2]
        uv_vert[rockw > 0.5] = 0
    R.set_colors(ob, np.stack([sky, sun, wet, rockw], 1))
    li = np.empty(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', li)
    uvl = me.uv_layers.new(name='T'); uvl.data.foreach_set('uv', uv_vert[li].ravel())


# the drips: over the passage and the room, the roof found by a ray up from the floor
bvh = BVHTree.FromObject(shell, bpy.context.evaluated_depsgraph_get())
DRIPS = []
for (dlz, dlx) in [(6.5, -0.4), (9.5, -1.2), (16.0, -0.6), (22.5, 1.0), (26.8, 1.8), (28.5, -1.0), (31.8, 2.2), (25.0, -3.6)]:
    f = floor_at(dlz)
    hit = bvh.ray_cast(B(dlx, f + 0.3, dlz), Vector((0, 0, 1)), 12)
    if hit[0] is not None:
        DRIPS.append((dlx, float(hit[0].z) - 0.03, dlz, f))
log('drips', len(DRIPS))

def cave_light(ob, a):
    """the sky light inside: the AO (sky visibility through the mouth and up the chimney) plus what the lit den floor and
    the walls pass on down the passage (falling off with the depth past the arch), a pool round the chimney's foot, and a
    floor of starlight-dark so the room never reads as a void"""
    v = R.vertex_array(ob)
    lz = -v[:, 1]; lx = v[:, 0]; y = v[:, 2]
    sx, sy, sz = SHAFT_FOOT
    d = np.hypot(lx - sx, lz - sz)
    bounce = 0.55 * np.exp(-np.clip(lz, 0, None) / 8.0)
    pool = 0.42 * np.exp(-(d * d) / (2 * 2.6 * 2.6)) * np.clip(1.2 - (y - sy) / 6.0, 0.3, 1.0)
    return np.clip(np.maximum.reduce([a, bounce, pool, np.full_like(a, 0.045)]), 0, 1)


SHAFT_FOOT = (CHIMNEY['lx'] + 0.7, floor_at(CHIMNEY['lz'] + 0.6), CHIMNEY['lz'] + 0.6)
sky_shell = diffuse(shell, cave_light(shell, ao['cave']))
data_for(shell, sky_shell)
data_for(far, np.clip(ao['cave-far'], 0, 1))
data_for(pob, cave_light(pob, ao['props']), True)
# the props join the cave's render mesh
bpy.ops.object.select_all(action='DESELECT')
pob.select_set(True); shell.select_set(True); bpy.context.view_layer.objects.active = shell
bpy.ops.object.join()
for o in (shell, far, col):
    o.data.materials.clear()

# ── the game's data (cave.json) ──────────────────────────────────────────────────────────────────────────────────────
cv = R.vertex_array(cav)
clz, clx, cy = -cv[:, 1], cv[:, 0], cv[:, 2]
holes, cuts = [], []
lz = -4.0
while lz < 19.0:
    sel = (clz >= lz) & (clz < lz + 1)
    if sel.any():
        x0, x1, ytop = float(clx[sel].min()), float(clx[sel].max()), float(cy[sel].max())
        f = floor_at(lz + 0.5)
        gmax = max(ground(x, z) for x in np.linspace(x0 - 2, x1 + 2, 9) for z in (lz - 1, lz + 0.5, lz + 2))
        if gmax > f - 0.2:
            box = {'lx': (x0 + x1) / 2, 'lz': lz + 0.5, 'hw': (x1 - x0) / 2 + 0.35, 'hd': 0.5 + 0.35, 'y0': f - 0.15, 'y1': ytop + 0.35}
            if lz >= 2.0:   # nearer the mouth the ground is under the floor, and a hole there would open past the hood's front
                holes.append(box)
                cuts.append({'lx': box['lx'], 'lz': box['lz'], 'hw': box['hw'] + 0.4, 'hd': 0.55, 'below': f - 1.0})
    lz += 1.0
spots = [{'lx': sect(z)[0], 'lz': z, 'r': 2.2} for z in (4.0, 8.0, 12.0, 16.0, 20.0)] + [{'lx': r[1], 'lz': r[0], 'r': min(r[2], r[3]) + 0.5} for r in ROOM]
# the footprint: the cavity's outline in the frame (a convex hull of lx, lz of its interior past the lip)
pts = np.stack([clx[clz > 0.5], clz[clz > 0.5]], 1)


def hull2(p):
    p = sorted(set(map(tuple, np.round(p, 1).tolist())))
    if len(p) < 3:
        return p

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for q in p:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0:
            lo.pop()
        lo.append(q)
    for q in reversed(p):
        while len(up) >= 2 and cross(up[-2], up[-1], q) <= 0:
            up.pop()
        up.append(q)
    return lo[:-1] + up[:-1]


cz, cxx = CHIMNEY['lz'], CHIMNEY['lx']
hit = bvh.ray_cast(B(cxx, floor_at(cz) + 0.3, cz), Vector((0, 0, 1)), 8)
roof = float(hit[0].z) if hit[0] is not None else floor_at(cz) + 5
meta = {
    'version': 1,
    'holes': holes, 'cuts': cuts, 'spots': spots, 'inside': hull2(pts),
    'shaft': {'top': [cxx, roof + 0.4, cz], 'foot': [cxx + 0.7, floor_at(cz + 0.6), cz + 0.6], 'r0': 0.45, 'r1': 1.35},
    'drips': [list(d) for d in DRIPS],
    'floor': [[float(z), float(floor_at(z))] for z in np.arange(-4.0, 36.5, 1.0)],
    'tris': {'cave': R.tri_count(shell), 'far': R.tri_count(far), 'col': R.tri_count(col)},
}
json.dump(meta, open(f'{OUT}/cave.json', 'w'), indent=1)
log('holes', len(holes), 'cuts', len(cuts), 'inside', len(meta['inside']))

if PREVIEW:
    # a cut-away: the cave from above with the roof hidden past the lip, and a view down the passage
    pass

bpy.data.objects.remove(cav)
bpy.ops.object.select_all(action='DESELECT')
for o in (shell, far, col):
    o.select_set(True)
bpy.context.view_layer.objects.active = shell
bpy.ops.export_scene.gltf(
    filepath=f'{OUT}/cave.glb', export_format='GLB', use_selection=True,
    export_normals=True, export_texcoords=True, export_materials='NONE', export_vertex_color='ACTIVE',
    export_all_vertex_colors=False, export_yup=True, export_apply=False, export_extras=False,
)
log('done', f'{OUT}/cave.glb')
