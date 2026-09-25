"""lever_rifle.py — Pine Hollow's lever-action carbine (PINE-HOLLOW-REMASTER PH-C11), modelled + baked in Blender, headless.

    blender -b --factory-startup -P scripts/blender/weapons/lever_rifle.py -- <build dir> [--lod=hi,lo] [--bake=2048]
            [--samples=64] [--preview] [--no-bake] [--wood=<walnut diffuse.jpg>]

A Winchester-1894-style carbine in the game's model space (src/player/LeverRifle.ts): the bore on the axis, the muzzle
at −Z, +Y up (glTF). Built here in Blender's frame — +Y forward (the muzzle), +Z up — and turned on export
(game = (x, z, −y)). Every number the game aims with is kept: the sight line 45 mm over the bore, the buckhorn's U-notch
floor where the gold bead (the game's own sphere) sits on it at the eye's distance, the lever / hammer pivots, the gate,
the bolt's channel, the ejection port.

Parts (one glTF mesh each, named for LeverRifle.ts):
  steel   the static metal: a case-hardened receiver (a boolean-cut bolt channel, the loading gate on the right, side-plate
          screws, the saddle-ring stud on the left), upper + lower tangs, the trigger, a round tapered barrel with a crowned
          muzzle, the magazine tube + its cap, the carbine barrel band + the forend band, the semi-buckhorn rear sight on its
          base, the front ramp + blade, the crescent buttplate
  forend  oiled walnut, around the barrel + tube          stock   the straight-grip walnut stock (hidden sighted)
  lever   the loop lever, in its pivot's frame            hammer  the hammer + spur, in its pivot's frame
  bolt    the top bolt (slides back on the cycle)
Two atlases (materials 'lever-steel', 'lever-wood'): albedo (sRGB), normal (OpenGL, tangent space), ARM (AO · roughness ·
metalness) — baked in Cycles from procedural finishes: colour-case mottling on the receiver / hammer / lever, blued steel
with worn edges and a plum patina elsewhere, a Poly Haven CC0 walnut (walnut_veneer_02) graded to an oiled stock, AO of the
assembled gun. LOD 'hi' (desktop, 1024² atlases) and 'lo' (phone, 512²) are built and baked separately (their own UVs).

Writes <build>/<lod>/lever-rifle.glb (float streams, WebP textures, EXT_texture_webp) + the PNG bakes + preview renders;
run.sh meshopt-compresses and copies into public/assets/pine-hollow/weapons/.
"""
import bpy
import bmesh
import json
import math
import os
import struct
import subprocess
import sys

import numpy as np
from mathutils import Matrix, Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(ARGV[0] if ARGV and not ARGV[0].startswith('--') else 'build-rifle')
OPT = {}
for a in ARGV:
    if a.startswith('--'):
        k, _, v = a[2:].partition('=')
        OPT[k] = v if v else True
LODS = str(OPT.get('lod', 'hi,lo')).split(',')
BAKE = int(OPT.get('bake', 2048))
SAMPLES = int(OPT.get('samples', 48))
WOOD_SRC = str(OPT.get('wood', os.path.expanduser('~/.cache/wildshard-blender/weapons-src/walnut_veneer_02_diff_2k.jpg')))
HDRI = str(OPT.get('hdri', os.path.join(os.getcwd(), 'public/assets/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr')))


def log(*a):
    print('[rifle]', *a, flush=True)


# ─────────────────────────── the game's numbers (LeverRifle.ts), in Blender's frame ───────────────────────────
SIGHT_Z = 0.045                       # SIGHT_Y: the sight line over the bore
EYE_Y, REAR_Y, FRONT_Y, MUZZLE_Y = -0.36, 0.13, 0.512, 0.535
BEAD_R = 0.0055
NOTCH_FLOOR = SIGHT_Z - BEAD_R * (-EYE_Y + REAR_Y) / (-EYE_Y + FRONT_Y)   # the bead's apparent radius at the notch
NOTCH_W = 0.0074
RECV_F, RECV_B, RECV_HW = 0.035, -0.1395, 0.0152
RECV_TOP, RECV_BOT = 0.0195, -0.037
LEVER_PIVOT = Vector((0.0, 0.018, -0.031))
HAMMER_PIVOT = Vector((0.0, -0.122, -0.006))
BARREL_R0, BARREL_R1 = 0.0098, 0.0089
TUBE_Z, TUBE_R = -0.0192, 0.0079
BOLT = dict(y0=-0.1055, y1=-0.0305, z0=0.0158, z1=0.0224, hw=0.0063)
CHANNEL = dict(y0=-0.0305, y1=-0.15, hw=0.0068, z0=0.0152)


# ─────────────────────────── geometry helpers ───────────────────────────
def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mesh_obj(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(clean_customdata=False)
    me.update()
    return link(bpy.data.objects.new(name, me))


def arc(cx, cy, r, a0, a1, n):
    """points on a circle (degrees), a0 → a1 inclusive"""
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def quad_bez(p0, c, p1, n):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]) for t in (i / n for i in range(n + 1))]


def dedupe(pts, eps=1e-6):
    out = []
    for p in pts:
        if not out or abs(out[-1][0] - p[0]) > eps or abs(out[-1][1] - p[1]) > eps:
            out.append(p)
    if len(out) > 2 and abs(out[0][0] - out[-1][0]) < eps and abs(out[0][1] - out[-1][1]) < eps:
        out.pop()
    return out


def catmull(pts, n_per):
    """a Catmull-Rom polyline through 2D / 3D points (ends clamped)"""
    P = [np.array(p, dtype=float) for p in pts]
    P = [P[0]] + P + [P[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n_per):
            t = k / n_per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return [tuple(p) for p in out]


# plane frames for a 2D outline (a, b) extruded along the third axis: side (YZ, thick in X) and front (XZ, thick in Y)
PLANE = {
    'YZ': Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1))),   # a → +Y, b → +Z, extrude → +X
    'XZ': Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1))),  # a → +X, b → +Z, extrude → −Y
}


def profile_solid(name, outline, thick, bevel, plane='YZ', at=(0, 0, 0), holes=(), res=2):
    """a flat outline extruded `thick` (centred on `at` along the plane's normal), its rim rounded by `bevel`, as a mesh"""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    for loop in [outline, *holes]:
        loop = dedupe(loop)
        sp = cu.splines.new('POLY')
        sp.points.add(len(loop) - 1)
        for p, (a, b) in zip(sp.points, loop):
            p.co = (a, b, 0, 1)
        sp.use_cyclic_u = True
    cu.extrude = max(thick / 2 - bevel, 1e-6)
    cu.bevel_depth = bevel
    cu.bevel_resolution = res
    cu.offset = -bevel
    tmp = link(bpy.data.objects.new(name + '_c', cu))
    tmp.matrix_world = Matrix.Translation(at) @ PLANE[plane]
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    me.transform(tmp.matrix_world)
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def lathe(name, prof, seg, axis='Y', at=(0, 0, 0), cap0=True, cap1=True, phase=0.0):
    """a surface of revolution: prof = [(along, r)], around `axis` through `at`; r = 0 ends close to a pole"""
    verts, faces, rings = [], [], []
    for (s, r) in prof:
        ring = []
        if r <= 1e-7:
            ring = [len(verts)]
            verts.append((s, 0.0, 0.0))
        else:
            for k in range(seg):
                a = 2 * math.pi * (k + phase) / seg
                ring.append(len(verts))
                verts.append((s, r * math.cos(a), r * math.sin(a)))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        if len(r0) == 1 and len(r1) == 1:
            continue
        if len(r0) == 1:
            faces += [(r0[0], r1[(k + 1) % seg], r1[k]) for k in range(seg)]
        elif len(r1) == 1:
            faces += [(r0[k], r0[(k + 1) % seg], r1[0]) for k in range(seg)]
        else:
            faces += [(r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]) for k in range(seg)]
    if cap0 and len(rings[0]) > 1:
        faces.append(tuple(reversed(rings[0])))
    if cap1 and len(rings[-1]) > 1:
        faces.append(tuple(rings[-1]))
    # local (s, u, v) → world: the axis along s
    M = {'Y': lambda s, u, v: (v, s, u), 'X': lambda s, u, v: (s, u, v), 'Z': lambda s, u, v: (u, v, s)}[axis]
    w = [tuple(np.add(M(*p), at)) for p in verts]
    ob = mesh_obj(name, w, faces)
    fix_normals(ob)
    return ob


def loft(name, rings, cap0=True, cap1=True, cap1_at=None):
    """bridge rings of equal point count (each a list of 3D points, same winding) into a closed tube; the end caps fan to
    the ring's centroid (or `cap1_at`: a recessed / domed end)"""
    n = len(rings[0])
    verts = [p for r in rings for p in r]
    faces = []
    for i in range(len(rings) - 1):
        a, b = i * n, (i + 1) * n
        faces += [(a + k, a + (k + 1) % n, b + (k + 1) % n, b + k) for k in range(n)]
    for cap, ring_i in ((cap0, 0), (cap1, len(rings) - 1)):
        if not cap:
            continue
        c = np.array(cap1_at) if (ring_i and cap1_at is not None) else np.mean(np.array(rings[ring_i]), axis=0)
        ci = len(verts)
        verts.append(tuple(c))
        base = ring_i * n
        faces += [(base + k, base + (k + 1) % n, ci) for k in range(n)]
    ob = mesh_obj(name, verts, faces)
    fix_normals(ob)
    return ob


def sweep(name, centre, section, frame_x=(1, 0, 0), cap=True):
    """sweep a closed 2D section [(u along frame_x, v in-plane normal)] (or a function t → section) along a 3D polyline"""
    X = Vector(frame_x)
    rings = []
    m = len(centre)
    for i, p in enumerate(centre):
        p = Vector(p)
        t = (Vector(centre[min(i + 1, m - 1)]) - Vector(centre[max(i - 1, 0)])).normalized()
        N = t.cross(X).normalized()
        sec = section(i / (m - 1)) if callable(section) else section
        rings.append([tuple(p + X * u + N * v) for (u, v) in sec])
    return loft(name, rings, cap, cap)


def superellipse(a, b, p, n, cx=0.0, cz=0.0, taper=0.0):
    """n points around |x/a|^p + |z/b|^p = 1, counter-clockwise from the right; `taper` narrows the top (x × (1 − taper·s))"""
    pts = []
    for k in range(n):
        th = 2 * math.pi * k / n
        c, s = math.cos(th), math.sin(th)
        x = a * math.copysign(abs(c) ** (2 / p), c)
        z = b * math.copysign(abs(s) ** (2 / p), s)
        pts.append((cx + x * (1 - taper * (z / b)), cz + z))
    return pts


def hull2d(pts):
    pts = sorted(set((round(x, 7), round(y, 7)) for x, y in pts))
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def fix_normals(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def add_bevel(ob, width, segs, angle=35):
    m = ob.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segs
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.use_clamp_overlap = True
    m.harden_normals = False
    return m


def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)


def boolean_cut(ob, cutter):
    m = ob.modifiers.new('cut', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.solver = 'EXACT'
    m.object = cutter
    apply_mods(ob)
    bpy.data.objects.remove(cutter)


def box_obj(name, x0, x1, y0, y1, z0, z1):
    v = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    ob = mesh_obj(name, v, f)
    fix_normals(ob)
    return ob


def join(name, obs):
    obs = [o for o in obs if o is not None]
    if len(obs) == 1:
        obs[0].name = name
        return obs[0]
    ctx = {'active_object': obs[0], 'selected_editable_objects': obs, 'selected_objects': obs}
    with bpy.context.temp_override(**ctx):
        bpy.ops.object.join()
    obs[0].name = name
    return obs[0]


# ─────────────────────────── the carbine ───────────────────────────
class Lod:
    def __init__(self, hi):
        self.hi = hi
        self.round = 24 if hi else 12       # barrel / tube segments
        self.ring = 24 if hi else 14        # stock / forend section points
        self.res = 2 if hi else 1           # curve rim bevel resolution
        self.arc = 1.0 if hi else 0.55      # outline arc density
        self.bev = 2 if hi else 1           # bevel modifier segments

    def n(self, k):
        return max(2, int(round(k * self.arc)))


def build(L):
    """→ {part: [objects]}, and per object its finish ('case' / 'blue' / 'wood') + UV weight in custom props"""
    parts = {'steel': [], 'forend': [], 'stock': [], 'lever': [], 'hammer': [], 'bolt': []}

    def tag(ob, part, finish, weight=1.0):
        ob['finish'] = finish
        ob['uvw'] = weight
        parts[part].append(ob)
        return ob

    # ── the receiver: side profile extruded, the bolt channel cut, every edge rounded ──
    top_back = quad_bez((-0.104, RECV_TOP), (-0.128, RECV_TOP), (-0.1385, 0.0035), L.n(8))
    outline = (
        [(RECV_F, 0.0175), (RECV_F - 0.002, 0.0203), (RECV_F - 0.005, RECV_TOP)]
        + top_back
        + [(RECV_B, 0.001), (RECV_B, -0.027)] + quad_bez((RECV_B, -0.027), (RECV_B, RECV_BOT), (RECV_B + 0.015, RECV_BOT), L.n(6))[1:] + [(0.010, RECV_BOT)]
        + quad_bez((0.010, RECV_BOT), (RECV_F, RECV_BOT), (RECV_F, -0.026), L.n(5))[1:]
    )
    recv = profile_solid('receiver', list(reversed(outline)), 2 * RECV_HW, 0.0002, 'YZ', res=1)
    boolean_cut(recv, box_obj('chan', -CHANNEL['hw'], CHANNEL['hw'], CHANNEL['y1'], CHANNEL['y0'], CHANNEL['z0'], 0.04))
    # the lever's slot under the receiver (the bar sits in it, its lower edge proud)
    boolean_cut(recv, box_obj('slot', -0.0048, 0.0048, -0.075, 0.03, RECV_BOT - 0.01, RECV_BOT + 0.006))
    add_bevel(recv, 0.0011, L.bev)
    apply_mods(recv)
    tag(recv, 'steel', 'case', 1.7)

    # the loading gate (right side): a spring cover plate, proud of the side, rounded front
    gy0, gy1, gz0, gz1 = -0.045, -0.011, -0.0292, -0.0132
    gate = (arc(gy1 - 0.0085, (gz0 + gz1) / 2, 0.0088, -90, 90, L.n(8))
            + [(gy0 + 0.003, gz1), (gy0, gz1 - 0.003), (gy0, gz0 + 0.003), (gy0 + 0.003, gz0)])
    tag(profile_solid('gate', gate, 0.0014, 0.00045, 'YZ', at=(RECV_HW + 0.0003, 0, 0), res=L.res), 'steel', 'case', 2.0)
    # screws: side-plate screws both sides, the gate screw, the saddle-ring stud (left)
    def screw(name, x, y, z, r=0.0027, h=0.0011, side=1):
        prof = [(0.0, r * 1.05), (h * 0.45, r), (h * 0.85, r * 0.72), (h, 0.0)]
        prof = [(x + side * s, rr) for s, rr in prof]
        ob = lathe(name, prof, 10 if L.hi else 6, 'X', at=(0, y, z), cap0=True, cap1=False)
        return tag(ob, 'steel', 'blue', 2.5)
    for (y, z) in ((0.020, 0.005), (-0.020, -0.005), (-0.097, -0.022)):
        for sx in (1, -1):
            screw(f'screw{y}{sx}', sx * (RECV_HW - 0.0002), y, z, side=sx)
    screw('gatescrew', RECV_HW - 0.0002, -0.051, -0.021, r=0.0022)
    tag(lathe('saddle', [(-RECV_HW + 0.0002, 0.0052), (-RECV_HW - 0.0018, 0.0048), (-RECV_HW - 0.0028, 0.0034), (-RECV_HW - 0.0031, 0.0)],
              8 if L.hi else 6, 'X', at=(0, -0.088, -0.02), cap0=True, cap1=False), 'steel', 'blue', 2.0)

    # tangs: upper over the wrist, lower under it (the lever latches below)
    up = ([(-0.134, 0.0022), (-0.17, 0.0002), (-0.2, -0.0022)] + arc(-0.2085, -0.0052, 0.0033, 60, 270, L.n(8)) + [(-0.17, -0.0066), (-0.134, -0.0056)])
    tag(profile_solid('tang_up', up, 0.0125, 0.0009, 'YZ', res=L.res), 'steel', 'case', 1.6)
    lo = ([(-0.126, -0.0352), (-0.18, -0.0372), (-0.219, -0.0396)] + arc(-0.2235, -0.0426, 0.0035, 60, 300, L.n(8)) + [(-0.18, -0.0446), (-0.126, -0.0436)])
    tag(profile_solid('tang_lo', list(reversed(lo)), 0.0145, 0.0009, 'YZ', res=L.res), 'steel', 'case', 1.2)
    tag(lathe('tangscrew', [(-0.0027, 0.0026), (-0.0016, 0.0025), (-0.001, 0.0018), (-0.0007, 0.0)], 8 if L.hi else 6, 'Z', at=(0, -0.194, 0), cap0=True, cap1=False), 'steel', 'blue', 2.0)

    # the trigger: a curved blade out of the receiver's rear bottom
    trig = catmull([(0, -0.1035, -0.033), (0, -0.106, -0.0425), (0, -0.1105, -0.0505), (0, -0.1175, -0.0558), (0, -0.1235, -0.0568)], 4 if L.hi else 3)
    tag(sweep('trigger', trig, lambda t: [(u * (0.0027 - 0.0006 * t), v * (0.0023 - 0.0007 * t)) for (u, v) in superellipse(1, 1, 2.6, 8 if L.hi else 6)]), 'steel', 'case', 2.0)

    # ── the barrel: tapered, a rounded crown and the bore; the magazine tube + its cap ──
    bprof = [(0.02, 0.0), (0.02, BARREL_R0), (0.2, BARREL_R0 - (BARREL_R0 - BARREL_R1) * 0.36), (0.4, BARREL_R0 - (BARREL_R0 - BARREL_R1) * 0.73),
             (MUZZLE_Y - 0.0016, BARREL_R1), (MUZZLE_Y - 0.0004, BARREL_R1 - 0.0005), (MUZZLE_Y, BARREL_R1 - 0.0013),
             (MUZZLE_Y, 0.0048), (MUZZLE_Y - 0.0012, 0.0039), (MUZZLE_Y - 0.03, 0.0039), (MUZZLE_Y - 0.03, 0.0)]
    tag(lathe('barrel', bprof, L.round, 'Y', phase=0.5), 'steel', 'blue', 1.0)
    tprof = [(0.03, 0.0), (0.03, TUBE_R), (0.474, TUBE_R), (0.474, TUBE_R + 0.0006), (0.4755, TUBE_R + 0.0006), (0.4875, TUBE_R + 0.0006), (0.4895, TUBE_R - 0.0004),
             (0.4905, 0.0052), (0.4912, 0.0034), (0.4912, 0.0)]
    tag(lathe('tube', tprof, L.round - 4 if L.hi else L.round - 2, 'Y', at=(0, 0, TUBE_Z), phase=0.5), 'steel', 'blue', 0.8)

    # ── walnut: the forend, around the barrel + tube ──
    def forend_ring(y, t):
        hw = 0.0152 - 0.0026 * t
        zb, zt = -0.0358 + 0.0022 * t, 0.0028
        cz = (zt + zb) / 2 + 0.004
        pts = []
        for (x, z) in superellipse(hw, cz - zb, 2.7, L.ring, cz=cz, taper=0.08):
            z = min(z, zt)
            if abs(x) < 0.0086 and z > zt - 0.0008:
                z = -0.004
            pts.append((x, y, max(z, zb)))
        return pts
    fy = np.linspace(0.0352, 0.2685, 9 if L.hi else 5)
    forend = loft('forend', [forend_ring(y, (y - fy[0]) / (fy[-1] - fy[0])) for y in fy])
    add_bevel(forend, 0.0012, 1, 40)
    apply_mods(forend)
    tag(forend, 'forend', 'wood', 1.3)

    # ── bands: the forend band (holds the forend's front) and the carbine's barrel band near the muzzle ──
    def band(name, y, length, shape):
        return tag(profile_solid(name, shape, length, 0.0007, 'XZ', at=(0, y, 0), res=1), 'steel', 'blue', 1.6)
    circ = lambda r, cz, n: [(r * math.cos(2 * math.pi * k / n), cz + r * math.sin(2 * math.pi * k / n)) for k in range(n)]
    fr = [(x * 1.035, z * 1.02 - 0.0003) for (x, _, z) in forend_ring(0.27, 1.0)]
    band('band_rear', 0.2725, 0.0135, hull2d(circ(0.0118, 0, 20 if L.hi else 12) + fr))
    band('band_front', 0.462, 0.011, hull2d(circ(BARREL_R0 - (BARREL_R0 - BARREL_R1) * 0.85 + 0.0022, 0, 20 if L.hi else 12) + circ(TUBE_R + 0.0021, TUBE_Z, 20 if L.hi else 12)))
    screw('bandscrew_r', 0.0128, 0.2725, -0.0105, r=0.0021)
    screw('bandscrew_f', 0.0104, 0.462, -0.0098, r=0.0019)

    # ── the rear sight: a raised base, a slanted elevator, the semi-buckhorn leaf ──
    base = [(0.1485, 0.0088), (0.1385, 0.0226), (0.1345, 0.0252), (0.1135, 0.0256), (0.1115, 0.0236), (0.1115, 0.0088)]
    tag(profile_solid('rs_base', list(reversed(base)), 0.0112, 0.0008, 'YZ', res=L.res), 'steel', 'blue', 2.5)
    elev = [(0.1285, 0.0246), (0.1285, 0.0287), (0.1145, 0.0263), (0.1145, 0.0246)]
    tag(profile_solid('rs_elev', list(reversed(elev)), 0.0082, 0.0003, 'YZ', res=1), 'steel', 'blue', 2.5)
    # the leaf, looking down the barrel: horns curling up and in around a U-notch whose floor is NOTCH_FLOOR
    ur = NOTCH_W / 2
    horn = [(0.0124, 0.0245), (0.0132, 0.035), (0.0134, 0.0415), (0.0128, 0.0468), (0.0114, 0.0508), (0.0097, 0.0534), (0.0083, 0.0536),
            (0.0078, 0.0521), (0.0067, 0.0497), (0.0052, 0.0478), (ur + 0.0003, 0.0466)]
    notch = arc(0.0, NOTCH_FLOOR + ur, ur, 0, -180, L.n(10))  # right side down around the U and up the left
    leaf = horn + [(ur, NOTCH_FLOOR + ur + 0.0004)] + notch[1:-1] + [(-ur, NOTCH_FLOOR + ur + 0.0004)] + [(-x, z) for (x, z) in reversed(horn)]
    tag(profile_solid('rs_leaf', list(reversed(leaf)), 0.0022, 0.0003, 'XZ', at=(0, REAR_Y, 0), res=1), 'steel', 'blue', 3.0)

    # ── the front sight: a ramp brazed to the barrel, a blade that carries the bead (the bead is the game's) ──
    ramp = [(0.4845, 0.0086), (0.492, 0.0128), (0.503, 0.0206), (0.5075, 0.0232), (0.527, 0.0238), (0.5295, 0.0222), (0.5305, 0.0086)]
    tag(profile_solid('fs_ramp', list(reversed(ramp)), 0.0078, 0.0008, 'YZ', res=L.res), 'steel', 'blue', 2.5)
    blade = [(0.5075, 0.0225), (0.5093, 0.0405), (0.5118, 0.0423), (0.5192, 0.0423), (0.5217, 0.0405), (0.5235, 0.0225)]
    tag(profile_solid('fs_blade', list(reversed(blade)), 0.0028, 0.0004, 'YZ', res=1), 'steel', 'blue', 3.0)

    # ── the straight-grip stock ──
    ys = [-0.1392, -0.175, -0.205, -0.235, -0.27, -0.33, -0.40, -0.455, -0.472]
    zt = [-0.0054, -0.0060, -0.0068, -0.0025, 0.0005, 0.0012, -0.0015, -0.0058, -0.0072]
    zb = [-0.0356, -0.0376, -0.0398, -0.0468, -0.0578, -0.0768, -0.0975, -0.1128, -0.1168]
    hw = [0.0151, 0.0147, 0.0143, 0.0146, 0.0156, 0.0174, 0.0191, 0.0201, 0.0203]
    pp = [4.2, 3.0, 2.45, 2.3, 2.3, 2.35, 2.55, 2.8, 2.9]
    tp = [0.0, 0.05, 0.1, 0.14, 0.18, 0.2, 0.2, 0.19, 0.19]
    n_sec = 18 if L.hi else 10
    yy = [ys[0] + (ys[-1] - ys[0]) * ((i / (n_sec - 1)) ** 1.15) for i in range(n_sec)]
    ip = lambda arr, y: float(np.interp(-y, [-v for v in ys], arr))

    def stock_ring(y, crescent=0.0):
        a, t_, b_ = ip(hw, y), ip(zt, y), ip(zb, y)
        b = (t_ - b_) / 2
        out = []
        for (x, z) in superellipse(a, b, ip(pp, y), L.ring, cz=(t_ + b_) / 2, taper=ip(tp, y)):
            s = (z - (t_ + b_) / 2) / b
            out.append((x, y + crescent * (1 - s * s), z))
        return out
    rings = [stock_ring(y) for y in yy]
    # the butt: a crescent (concave) end, 7 mm deep at its middle
    BUTT_Y, CRES = -0.4925, 0.0072
    rings.append(stock_ring(BUTT_Y, CRES))
    bcz = (ip(zt, BUTT_Y) + ip(zb, BUTT_Y)) / 2
    stock = loft('stock', rings, cap1_at=(0, BUTT_Y + CRES * 1.02, bcz))   # the concave (crescent) end
    add_bevel(stock, 0.0015, L.bev, 45)
    apply_mods(stock)
    tag(stock, 'stock', 'wood', 1.0)
    # the crescent buttplate: a steel shell over the end, 4.5 mm thick, a heel lip over the comb
    bp0 = [(x * 1.018, y + 0.0012, (z - bcz) * 1.02 + bcz) for (x, y, z) in stock_ring(BUTT_Y, CRES)]
    bp1 = [(x, y - 0.0045, z) for (x, y, z) in bp0]
    plate = loft('buttplate', [bp0, bp1], cap1_at=(0, BUTT_Y + CRES * 1.02 - 0.0045, bcz))
    add_bevel(plate, 0.0012, L.bev, 40)
    apply_mods(plate)
    tag(plate, 'steel', 'blue', 0.6)
    for z in (-0.03, -0.1):
        sb = (z - bcz) / ((ip(zt, BUTT_Y) - ip(zb, BUTT_Y)) / 2)
        s = lathe(f'bpscrew{z}', [(0.0, 0.0028), (-0.0005, 0.0026), (-0.0009, 0.0018), (-0.0011, 0.0)], 10 if L.hi else 6, 'Y', at=(0, BUTT_Y + CRES * (1 - sb * sb) - 0.0044, z), cap0=True, cap1=False)
        tag(s, 'steel', 'blue', 1.0)

    # ── the moving parts, each in its pivot's frame (origin = the pivot) ──
    # the lever: the bar in its slot under the receiver, the guard around the trigger, the finger loop latching under the lower tang
    lc = [(0, 0.0045, -0.0072), (0, -0.03, -0.0072), (0, -0.074, -0.0074), (0, -0.087, -0.0125), (0, -0.0955, -0.028), (0, -0.1055, -0.0445),
          (0, -0.1235, -0.0545), (0, -0.1505, -0.0545), (0, -0.1725, -0.0462), (0, -0.1848, -0.031), (0, -0.1845, -0.0175), (0, -0.1782, -0.0098)]
    centre = catmull(lc, 3 if L.hi else 2)
    def lever_sec(t):
        hx = 0.0044 if t < 0.2 else 0.0044 - 0.0004 * min(1.0, (t - 0.2) * 4)
        hv = 0.0042 if t < 0.2 else 0.0036
        return [(u * hx, v * hv) for (u, v) in superellipse(1, 1, 3.2 if t < 0.2 else 2.4, 10 if L.hi else 6)]
    lever = sweep('lever', centre, lever_sec)
    boss = lathe('lever_boss', [(-0.0052, 0.0), (-0.0052, 0.0052), (-0.0046, 0.0058), (0.0046, 0.0058), (0.0052, 0.0052), (0.0052, 0.0)], 16 if L.hi else 10, 'X')
    lever = join('lever', [lever, boss])
    tag(lever, 'lever', 'case', 1.5)
    # the hammer: body, the striking face, the spur swept back (chequered on top in the bake)
    hm = ([(0.0053, 0.002), (0.0047, 0.012), (0.0043, 0.0205), (0.0036, 0.0255), (0.0012, 0.0284), (-0.006, 0.0298), (-0.014, 0.0314), (-0.0205, 0.0326)]
          + arc(-0.0228, 0.0305, 0.0024, 60, 250, L.n(6)) + [(-0.0185, 0.0264), (-0.0108, 0.0236), (-0.0062, 0.0188), (-0.0056, 0.008)]
          + arc(0.0, 0.0, 0.0056, 185, 355, L.n(8)))
    hammer = profile_solid('hammer', list(reversed(hm)), 0.0074, 0.0008, 'YZ', res=L.res)
    tag(hammer, 'hammer', 'case', 2.5)
    # the bolt: flush in its channel, a rounded back, the extractor along its top
    bo = [(BOLT['y1'], BOLT['z0']), (BOLT['y1'], BOLT['z1'] - 0.0012), (BOLT['y1'] - 0.0012, BOLT['z1']), (BOLT['y0'] + 0.004, BOLT['z1'])] + arc(BOLT['y0'] + 0.004, BOLT['z1'] - 0.004, 0.004, 90, 180, L.n(4)) + [(BOLT['y0'], BOLT['z0'])]
    bolt = profile_solid('bolt', list(reversed(bo)), 2 * BOLT['hw'], 0.0006, 'YZ', res=L.res)
    ext = profile_solid('extractor', [(BOLT['y1'] - 0.002, BOLT['z1'] - 0.0005), (BOLT['y1'] - 0.002, BOLT['z1'] + 0.0008), (BOLT['y1'] - 0.034, BOLT['z1'] + 0.0006), (BOLT['y1'] - 0.036, BOLT['z1'] - 0.0005)][::-1], 0.003, 0.0003, 'YZ', res=1)
    bolt = join('bolt', [bolt, ext])
    tag(bolt, 'bolt', 'blue', 2.0)

    # pivots: move the lever / hammer so their origin is their pivot (built around the origin: place them)
    for ob, piv in ((parts['lever'][0], LEVER_PIVOT), (parts['hammer'][0], HAMMER_PIVOT)):
        ob.location = piv
    # the hammer cocked (the rest pose the viewmodel idles in), for the AO bake
    parts['hammer'][0].rotation_euler = (0.5, 0, 0)
    for ob in bpy.context.scene.objects:
        if ob.type == 'MESH':
            smooth(ob)
    return parts


def smooth(ob, angle=38):
    """smooth shading split at `angle`, then face-area weighted normals: the flats stay flat, the bevels carry the turn"""
    me = ob.data
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(angle))
    m = ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
    m.mode = 'FACE_AREA'
    m.weight = 80
    m.keep_sharp = True
    apply_mods(ob)


# ─────────────────────────── UVs ───────────────────────────
def unwrap(obs, margin):
    """smart-project each object, equalise texel density, weight by `uvw`, pack into one square"""
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:
        if not ob.data.uv_layers:
            ob.data.uv_layers.new(name='UVMap')
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(52), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode='OBJECT')
    for ob in obs:
        w = math.sqrt(float(ob.get('uvw', 1.0)))
        uv = ob.data.uv_layers.active.data
        a = np.zeros(len(uv) * 2, dtype=np.float32)
        uv.foreach_get('uv', a)
        a *= w
        uv.foreach_set('uv', a)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=margin, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')


# ─────────────────────────── materials (the bake's procedural finishes) ───────────────────────────
class NB:
    def __init__(self, mat):
        self.t = mat.node_tree
        self.t.nodes.clear()

    def n(self, kind, **kw):
        node = self.t.nodes.new(kind)
        for k, v in kw.items():
            if k.startswith('i_'):
                node.inputs[k[2:].replace('_', ' ')].default_value = v
            else:
                setattr(node, k, v)
        return node

    def l(self, a, b):
        self.t.links.new(a, b)

    def math(self, op, a, b=None, clamp=False):
        m = self.n('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                self.l(v, m.inputs[i])
        return m.outputs[0]

    def mix(self, fac, a, b):
        m = self.n('ShaderNodeMix', data_type='RGBA', blend_type='MIX')
        for sock, v in ((m.inputs[0], fac), (m.inputs[6], a), (m.inputs[7], b)):
            if isinstance(v, (int, float)):
                sock.default_value = v
            elif isinstance(v, tuple):
                sock.default_value = (*v, 1.0) if len(v) == 3 else v
            else:
                self.l(v, sock)
        return m.outputs[2]

    def ramp(self, fac, stops, alpha=False):
        """stops: (pos, rgb) or (pos, rgb, a); → the colour, or (colour, alpha)"""
        r = self.n('ShaderNodeValToRGB')
        el = r.color_ramp.elements
        while len(el) > 1:
            el.remove(el[-1])
        for i, st in enumerate(stops):
            e = el[0] if i == 0 else el.new(st[0])
            e.position = st[0]
            e.color = (*st[1], st[2] if len(st) > 2 else 1.0)
        self.l(fac, r.inputs[0])
        return (r.outputs[0], r.outputs[1]) if alpha else r.outputs[0]

    def noise(self, vec, scale, detail=4.0, rough=0.55, distort=0.0, w=None):
        nz = self.n('ShaderNodeTexNoise', noise_dimensions='4D' if w is not None else '3D', i_Scale=scale, i_Detail=detail, i_Roughness=rough, i_Distortion=distort)
        if w is not None:
            nz.inputs['W'].default_value = w
        self.l(vec, nz.inputs['Vector'])
        return nz


def finish_material(name, finish, target):
    """one bake material: outputs switchable between the albedo / roughness-metal emission and the bumped BSDF (normal bake).
    `target` = the image node's image (swapped per pass)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = NB(mat)
    out = b.n('ShaderNodeOutputMaterial', target='CYCLES')
    img = b.n('ShaderNodeTexImage', name='bake_target')
    img.image = target
    b.t.nodes.active = img
    geo = b.n('ShaderNodeNewGeometry')
    pos = geo.outputs['Position']
    # curvature: 1 − the bevelled normal · the true normal (edges light up); convexity from the AO node
    bev = b.n('ShaderNodeBevel', samples=12, i_Radius=0.0016)
    dot = b.n('ShaderNodeVectorMath', operation='DOT_PRODUCT')
    b.l(bev.outputs['Normal'], dot.inputs[0])
    b.l(geo.outputs['Normal'], dot.inputs[1])
    edge = b.math('SUBTRACT', 1.0, dot.outputs['Value'])
    ao = b.n('ShaderNodeAmbientOcclusion', samples=16, inside=False, i_Distance=0.012)
    cav = b.math('SUBTRACT', 1.0, ao.outputs['AO'])                      # 0 open … 1 in a crevice
    edge_m = b.math('MULTIPLY', b.math('MULTIPLY', edge, 18.0, clamp=True), b.math('POWER', ao.outputs['AO'], 3.0), clamp=True)
    grain = b.noise(pos, 900.0, 3.0, 0.6)                                  # breakup for the wear
    wear = b.math('MULTIPLY', edge_m, b.math('ADD', b.math('MULTIPLY', grain.outputs['Fac'], 1.6), -0.35), clamp=True)
    micro = b.noise(pos, 2600.0, 2.0, 0.5)                                 # fine surface noise (bump)
    if finish == 'wood':
        # the walnut veneer, projected along the gun (grain runs with the stock): sides from (y, z), top / belly from (y, x)
        wimg = bpy.data.images.load(WOOD_SRC, check_existing=True)
        S = 1 / 0.42
        def proj(ax_u, ax_v, off):
            sep = b.n('ShaderNodeSeparateXYZ')
            b.l(pos, sep.inputs[0])
            comb = b.n('ShaderNodeCombineXYZ')
            b.l(b.math('ADD', b.math('MULTIPLY', sep.outputs[ax_u], S), off), comb.inputs[0])
            b.l(b.math('ADD', b.math('MULTIPLY', sep.outputs[ax_v], S * 1.6), 0.31 + off), comb.inputs[1])
            tex = b.n('ShaderNodeTexImage', image=wimg, extension='REPEAT', interpolation='Cubic')
            b.l(comb.outputs[0], tex.inputs[0])
            return tex.outputs['Color']
        side = proj('Y', 'Z', 0.0)
        topv = proj('Y', 'X', 0.17)
        nsep = b.n('ShaderNodeSeparateXYZ')
        b.l(geo.outputs['Normal'], nsep.inputs[0])
        wz = b.math('POWER', b.math('ABSOLUTE', nsep.outputs['Z']), 2.2)
        raw = b.mix(wz, side, topv)
        # grade the pale veneer to oiled American walnut: deeper, warmer, more contrast
        hsv = b.n('ShaderNodeHueSaturation', i_Hue=0.49, i_Saturation=1.1, i_Value=1.0)
        b.l(raw, hsv.inputs['Color'])
        gam = b.n('ShaderNodeGamma', i_Gamma=2.15)
        b.l(hsv.outputs[0], gam.inputs[0])
        tint = b.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
        tint.inputs[0].default_value = 1.0
        b.l(gam.outputs[0], tint.inputs[6])
        tint.inputs[7].default_value = (0.86, 0.58, 0.40, 1)
        col = tint.outputs[2]
        # handling: worn lighter on the edges, grime in the inletting next to the steel, a little figure
        fig = b.noise(pos, 38.0, 3.0, 0.6, distort=0.8)
        col = b.mix(b.math('MULTIPLY', b.math('SUBTRACT', fig.outputs['Fac'], 0.3), 1.1, clamp=True), col, (0.10, 0.05, 0.025))
        col = b.mix(b.math('MULTIPLY', wear, 0.55), col, (0.36, 0.22, 0.12))
        col = b.mix(b.math('MULTIPLY', cav, 0.9, clamp=True), col, (0.05, 0.03, 0.02))
        lum = b.n('ShaderNodeRGBToBW')
        b.l(raw, lum.inputs[0])
        rough = b.math('ADD', 0.42, b.math('MULTIPLY', b.math('SUBTRACT', 0.6, lum.outputs[0]), 0.5))
        rough = b.math('ADD', rough, b.math('MULTIPLY', wear, -0.12))
        metal = 0.0
        height = b.math('ADD', b.math('MULTIPLY', lum.outputs[0], 1.0), b.math('MULTIPLY', micro.outputs['Fac'], 0.25))
        bump_str, bump_dist = 0.6, 0.0012
    else:
        if finish == 'case':
            # colour-case hardening: bone-charcoal swirls — straw, amber, peacock blue, plum — faded with age toward grey
            # a silver-grey ground, smoky in places; thin 'watered' bands of peacock blue, plum, straw and amber over it
            low = b.noise(pos, 18.0, 3.0, 0.5)
            ground = b.mix(b.math('MULTIPLY', b.math('SUBTRACT', low.outputs['Fac'], 0.3), 1.5, clamp=True), (0.25, 0.245, 0.24), (0.11, 0.10, 0.095))
            v1 = b.noise(pos, 42.0, 5.0, 0.6, distort=3.2)
            v2 = b.noise(pos, 95.0, 3.0, 0.5, distort=1.5, w=3.1)
            f = b.math('ADD', b.math('MULTIPLY', v1.outputs['Fac'], 0.85), b.math('MULTIPLY', v2.outputs['Fac'], 0.2))
            f = b.math('SUBTRACT', f, 0.05)
            col_c, col_a = b.ramp(f, [(0.33, (0.05, 0.08, 0.22), 0.0), (0.38, (0.05, 0.08, 0.22), 0.55), (0.42, (0.16, 0.07, 0.15), 0.55), (0.46, (0.30, 0.18, 0.09), 0.6),
                                      (0.50, (0.50, 0.37, 0.15), 0.85), (0.55, (0.36, 0.20, 0.07), 0.85), (0.60, (0.20, 0.14, 0.10), 0.55), (0.64, (0.07, 0.10, 0.22), 0.4),
                                      (0.69, (0.07, 0.10, 0.22), 0.0)], alpha=True)
            fade = b.noise(pos, 9.0, 2.0, 0.5)
            amt = b.math('MULTIPLY', col_a, b.math('ADD', 0.45, b.math('MULTIPLY', fade.outputs['Fac'], 0.5)), clamp=True)
            base = b.mix(amt, ground, col_c)
            rough_b = b.math('ADD', 0.32, b.math('MULTIPLY', v2.outputs['Fac'], 0.14))
        else:
            # hot-blued steel, 100 years on: blue-black, going plum-brown in patches and where hands hold it
            v = b.noise(pos, 24.0, 3.0, 0.55)
            base = b.mix(b.math('MULTIPLY', b.math('SUBTRACT', v.outputs['Fac'], 0.42), 1.8, clamp=True), (0.030, 0.034, 0.046), (0.075, 0.052, 0.045))
            speck = b.noise(pos, 380.0, 2.0, 0.5)
            base = b.mix(b.math('MULTIPLY', b.math('SUBTRACT', speck.outputs['Fac'], 0.62), 4.0, clamp=True), base, (0.055, 0.05, 0.052))
            rough_b = b.math('ADD', 0.32, b.math('MULTIPLY', v.outputs['Fac'], 0.12))
        # edges worn to bright steel; dirt + a brown patina in the crevices
        col = b.mix(wear, base, (0.44, 0.435, 0.43))
        col = b.mix(b.math('MULTIPLY', cav, 0.8, clamp=True), col, (0.09, 0.065, 0.045))
        rough = b.math('ADD', rough_b, b.math('MULTIPLY', wear, -0.12))
        rough = b.math('ADD', rough, b.math('MULTIPLY', cav, 0.35))
        metal = b.math('SUBTRACT', 1.0, b.math('MULTIPLY', cav, 0.6))
        # polishing streaks along the bore axis + pitting (the bump)
        sep = b.n('ShaderNodeSeparateXYZ')
        b.l(pos, sep.inputs[0])
        streak_v = b.n('ShaderNodeCombineXYZ')
        b.l(b.math('MULTIPLY', sep.outputs['X'], 1.0), streak_v.inputs[0])
        b.l(b.math('MULTIPLY', sep.outputs['Y'], 0.03), streak_v.inputs[1])
        b.l(b.math('MULTIPLY', sep.outputs['Z'], 1.0), streak_v.inputs[2])
        streak = b.noise(streak_v.outputs[0], 1400.0, 2.0, 0.5)
        pits = b.noise(pos, 1800.0, 1.0, 0.5)
        height = b.math('ADD', b.math('MULTIPLY', streak.outputs['Fac'], 0.5), b.math('MULTIPLY', b.math('SUBTRACT', 1.0, b.math('GREATER_THAN', pits.outputs['Fac'], 0.66)), 0.35))
        bump_str, bump_dist = 0.3, 0.0003
    bump = b.n('ShaderNodeBump', i_Strength=bump_str, i_Distance=bump_dist)
    b.l(height, bump.inputs['Height'])
    b.l(geo.outputs['Normal'], bump.inputs['Normal'])
    # outputs: emission for the albedo / rm passes, the principled for the normal pass
    em_alb = b.n('ShaderNodeEmission')
    b.l(col, em_alb.inputs['Color'])
    rm = b.n('ShaderNodeCombineColor')
    rm.inputs[0].default_value = 1.0
    b.l(rough, rm.inputs[1])
    if isinstance(metal, float):
        rm.inputs[2].default_value = metal
    else:
        b.l(metal, rm.inputs[2])
    em_rm = b.n('ShaderNodeEmission')
    b.l(rm.outputs[0], em_rm.inputs['Color'])
    bsdf = b.n('ShaderNodeBsdfPrincipled')
    b.l(bump.outputs['Normal'], bsdf.inputs['Normal'])
    b.l(col, bsdf.inputs['Base Color'])
    b.l(rough, bsdf.inputs['Roughness'])
    if isinstance(metal, float):
        bsdf.inputs['Metallic'].default_value = metal
    else:
        b.l(metal, bsdf.inputs['Metallic'])
    mat['outs'] = True
    mat['_alb'] = em_alb.name
    mat['_rm'] = em_rm.name
    mat['_bsdf'] = bsdf.name
    b.l(em_alb.outputs[0], out.inputs['Surface'])
    return mat


def set_output(mat, which):
    t = mat.node_tree
    out = next(n for n in t.nodes if n.type == 'OUTPUT_MATERIAL')
    src = t.nodes[mat[{'alb': '_alb', 'rm': '_rm', 'bsdf': '_bsdf'}[which]]]
    for lk in list(out.inputs['Surface'].links):
        t.links.remove(lk)
    t.links.new(src.outputs[0], out.inputs['Surface'])


def set_target(mat, image):
    node = mat.node_tree.nodes['bake_target']
    node.image = image
    mat.node_tree.nodes.active = node


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
    sc.render.bake.margin = max(4, BAKE // 256)
    sc.render.bake.margin_type = 'EXTEND'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('bake')
    sc.world.light_settings.distance = 0.05   # the AO pass: 5 cm, a gun's scale


def new_image(name, size, srgb, float_buf=False):
    im = bpy.data.images.new(name, size, size, alpha=False, float_buffer=float_buf)
    im.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    return im


def bake_atlas(atlas, obs, mats, size, outdir):
    """albedo / rm / normal / ao for the objects of one atlas → PNGs (albedo, normal, arm)"""
    ims = {k: new_image(f'{atlas}_{k}', size, k == 'alb', float_buf=k != 'alb') for k in ('alb', 'rm', 'nrm', 'ao')}
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    sc = bpy.context.scene
    for key, kind, out in (('alb', 'EMIT', 'alb'), ('rm', 'EMIT', 'rm'), ('nrm', 'NORMAL', 'bsdf'), ('ao', 'AO', 'bsdf')):
        for m in mats:
            set_output(m, out)
            set_target(m, ims[key])
        sc.cycles.samples = SAMPLES if key != 'nrm' else 8
        t0 = __import__('time').time()
        if kind == 'NORMAL':
            bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', normal_r='POS_X', normal_g='POS_Y', normal_b='POS_Z', margin=sc.render.bake.margin, use_clear=True)
        else:
            bpy.ops.object.bake(type=kind, margin=sc.render.bake.margin, use_clear=True)
        log(f'  bake {atlas}.{key} {size}² in {__import__("time").time() - t0:.1f}s')
    # pack ARM = (AO, roughness, metalness)
    px = lambda im: np.array(im.pixels[:], dtype=np.float32).reshape(size, size, 4)
    ao, rm = px(ims['ao']), px(ims['rm'])
    arm = np.stack([np.clip(ao[..., 0] * 0.85 + 0.15, 0, 1), np.clip(rm[..., 1], 0.04, 1), np.clip(rm[..., 2], 0, 1), np.ones_like(ao[..., 0])], -1)
    armim = new_image(f'{atlas}_arm', size, False, True)
    armim.pixels[:] = arm.ravel()
    paths = {}
    for key, im in (('albedo', ims['alb']), ('normal', ims['nrm']), ('arm', armim)):
        p = os.path.join(outdir, f'{atlas}-{key}.png')
        im.filepath_raw = p
        im.file_format = 'PNG'
        im.save()
        paths[key] = p
    return paths


# ─────────────────────────── export ───────────────────────────
def part_arrays(obs, pivot=None):
    """the objects of one part → float arrays in the game's frame (x, z, −y); UV v flipped for glTF"""
    P, N, U, I = [], [], [], []
    base = 0
    for ob in obs:
        me = ob.data
        me.calc_loop_triangles()
        M = ob.matrix_world.copy()
        if pivot is not None:
            M = Matrix.Translation(-pivot) @ M
        R = M.to_3x3().inverted().transposed()
        uvl = me.uv_layers.active.data
        cn = me.corner_normals
        key = {}
        for tri in me.loop_triangles:
            face = []
            for li in tri.loops:
                vi = me.loops[li].vertex_index
                p = M @ me.vertices[vi].co
                n = (R @ cn[li].vector).normalized()
                uv = uvl[li].uv
                k = (vi, round(n.x, 4), round(n.y, 4), round(n.z, 4), round(uv.x, 5), round(uv.y, 5))
                idx = key.get(k)
                if idx is None:
                    idx = base + len(key)
                    key[k] = idx
                    P.append((p.x, p.z, -p.y))
                    N.append((n.x, n.z, -n.y))
                    U.append((uv.x, 1.0 - uv.y))
                face.append(idx)
            I.append(face)
        base += len(key)
    return (np.array(P, np.float32), np.array(N, np.float32), np.array(U, np.float32), np.array(I, np.uint32).ravel())


def write_glb(path, meshes, textures, materials):
    """meshes: [(name, material index, (P, N, U, I))]; textures: [(bytes, mime)]; materials: [dict]"""
    blob = bytearray()
    views, accessors, gmeshes, nodes, images = [], [], [], [], []

    def align():
        while len(blob) % 4:
            blob.append(0)

    def view(data, target=None):
        align()
        off = len(blob)
        blob.extend(data)
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        return len(views) - 1

    def acc(arr, comp, typ, target, minmax=False):
        a = {'bufferView': view(arr.tobytes(), target), 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
        if minmax:
            a['min'] = [float(x) for x in arr.min(axis=0)]
            a['max'] = [float(x) for x in arr.max(axis=0)]
        accessors.append(a)
        return len(accessors) - 1

    for (name, mi, (P, N, U, I)) in meshes:
        attrs = {'POSITION': acc(P, 5126, 'VEC3', 34962, True), 'NORMAL': acc(N, 5126, 'VEC3', 34962), 'TEXCOORD_0': acc(U, 5126, 'VEC2', 34962)}
        ind = acc(I.astype(np.uint16) if I.max() < 65535 else I, 5123 if I.max() < 65535 else 5125, 'SCALAR', 34963)
        gmeshes.append({'name': name, 'primitives': [{'attributes': attrs, 'indices': ind, 'material': mi, 'mode': 4}]})
        nodes.append({'name': name, 'mesh': len(gmeshes) - 1})
    for data, mime in textures:
        images.append({'bufferView': view(data), 'mimeType': mime})
    align()
    doc = {
        'asset': {'version': '2.0', 'generator': 'wildshard scripts/blender/weapons/lever_rifle.py'},
        'extensionsUsed': ['EXT_texture_webp'], 'extensionsRequired': ['EXT_texture_webp'],
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}],
        'nodes': nodes, 'meshes': gmeshes, 'accessors': accessors, 'bufferViews': views,
        'buffers': [{'byteLength': len(blob)}], 'images': images,
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'textures': [{'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': i}}} for i in range(len(images))],
        'materials': materials,
    }
    js = json.dumps(doc, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(blob)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack('<II', len(blob), 0x004E4942))
        f.write(bytes(blob))


def webp(png, size, q, lossless_alpha=False):
    tmp = png.replace('.png', f'.{size}.png')
    subprocess.run(['magick', png, '-filter', 'Lanczos', '-resize', f'{size}x{size}', tmp], check=True)
    out = png.replace('.png', f'.{size}.webp')
    subprocess.run(['cwebp', '-quiet', '-q', str(q), '-m', '6', '-sharp_yuv', tmp, '-o', out], check=True)
    with open(out, 'rb') as f:
        return f.read()


# ─────────────────────────── preview ───────────────────────────
def preview(outdir, mats_final):
    sc = bpy.context.scene
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    sc.view_settings.view_transform = 'AgX'
    world = bpy.data.worlds.new('w')
    sc.world = world
    world.use_nodes = True
    wt = world.node_tree
    env = wt.nodes.new('ShaderNodeTexEnvironment')
    if os.path.exists(HDRI):
        env.image = bpy.data.images.load(HDRI)
    wt.links.new(env.outputs[0], wt.nodes['Background'].inputs[0])
    wt.nodes['Background'].inputs[1].default_value = 1.0
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    link(cam)
    sc.camera = cam
    shots = {
        'side-right': ((1.6, 0.02, -0.03), (0, 0.02, -0.03), 42),
        'side-left': ((-1.6, 0.02, -0.03), (0, 0.02, -0.03), 42),
        'rear-right': ((0.28, -0.12, -0.03), (0, -0.12, -0.03), 40),
        'fp-hip': ((0.12, -0.62, 0.14), (0.0, 0.1, -0.01), 50),
        'receiver': ((0.22, -0.18, 0.1), (0.0, -0.05, -0.02), 40),
        'ads': ((0.0, EYE_Y, SIGHT_Z), (0.0, 1.0, SIGHT_Z), 58),
    }
    for name, (loc, look, fov) in shots.items():
        cam.location = loc
        d = Vector(look) - Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cam.data.angle = math.radians(fov)
        cam.data.clip_start = 0.01
        if name == 'ads':
            for ob in bpy.context.scene.objects:
                if ob.get('part') == 'stock':
                    ob.hide_render = True
        sc.render.filepath = os.path.join(outdir, f'preview-{name}.png')
        bpy.ops.render.render(write_still=True)
        for ob in bpy.context.scene.objects:
            ob.hide_render = False
    log('  previews written')


def final_material(name, paths):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    t = mat.node_tree
    bsdf = t.nodes['Principled BSDF']
    def tex(p, srgb):
        n = t.nodes.new('ShaderNodeTexImage')
        n.image = bpy.data.images.load(p)
        n.image.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
        return n
    a, nr, arm = tex(paths['albedo'], True), tex(paths['normal'], False), tex(paths['arm'], False)
    sep = t.nodes.new('ShaderNodeSeparateColor')
    t.links.new(arm.outputs[0], sep.inputs[0])
    mix = t.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs[0].default_value = 1.0
    t.links.new(a.outputs[0], mix.inputs[6])
    t.links.new(sep.outputs[0], mix.inputs[7])
    t.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    t.links.new(sep.outputs[1], bsdf.inputs['Roughness'])
    t.links.new(sep.outputs[2], bsdf.inputs['Metallic'])
    nm = t.nodes.new('ShaderNodeNormalMap')
    t.links.new(nr.outputs[0], nm.inputs['Color'])
    t.links.new(nm.outputs[0], bsdf.inputs['Normal'])
    return mat


# ─────────────────────────── main ───────────────────────────
def run_lod(lod):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    L = Lod(lod == 'hi')
    outdir = os.path.join(OUT, lod)
    os.makedirs(outdir, exist_ok=True)
    parts = build(L)
    for p, obs in parts.items():
        for ob in obs:
            ob['part'] = p
    wood = parts['forend'] + parts['stock']
    steel = parts['steel'] + parts['lever'] + parts['hammer'] + parts['bolt']
    tris = {p: sum(sum(len(f.vertices) - 2 for f in ob.data.polygons) for ob in obs) for p, obs in parts.items()}
    log(f'{lod}: tris', tris, 'total', sum(tris.values()))
    log('  per object', sorted(((sum(len(f.vertices) - 2 for f in ob.data.polygons), ob.name) for obs in parts.values() for ob in obs), reverse=True)[:14])
    size = BAKE if L.hi else BAKE // 2
    unwrap(wood, 0.006)
    unwrap(steel, 0.004 if L.hi else 0.006)
    stats = {'lod': lod, 'tris': tris, 'total': sum(tris.values())}
    if 'no-bake' in OPT and 'preview' in OPT:
        setup_cycles()
        for f, col, rough, met in (('wood', (0.25, 0.12, 0.06), 0.45, 0.0), ('blue', (0.05, 0.055, 0.07), 0.35, 1.0), ('case', (0.35, 0.3, 0.28), 0.3, 1.0)):
            m = bpy.data.materials.new('flat-' + f)
            m.use_nodes = True
            bs = m.node_tree.nodes['Principled BSDF']
            bs.inputs['Base Color'].default_value = (*col, 1)
            bs.inputs['Roughness'].default_value = rough
            bs.inputs['Metallic'].default_value = met
            for ob in wood + steel:
                if ob['finish'] == f:
                    ob.data.materials.clear()
                    ob.data.materials.append(m)
        preview(outdir, None)
    if 'no-bake' not in OPT:
        setup_cycles()
        dummy = new_image('dummy', 8, False)
        mats = {f: finish_material(f'bake-{f}', f, dummy) for f in ('wood', 'blue', 'case')}
        for ob in wood + steel:
            ob.data.materials.clear()
            ob.data.materials.append(mats[ob['finish']])
        wood_png = bake_atlas('wood', wood, [mats['wood']], size, outdir)
        steel_png = bake_atlas('steel', steel, [mats['blue'], mats['case']], size, outdir)
        if 'preview' in OPT and L.hi:
            fw, fs = final_material('lever-wood', wood_png), final_material('lever-steel', steel_png)
            for ob in wood:
                ob.data.materials.clear()
                ob.data.materials.append(fw)
            for ob in steel:
                ob.data.materials.clear()
                ob.data.materials.append(fs)
            preview(outdir, (fw, fs))
        # the GLB: parts in the game's frame, the lever / hammer about their pivots (the hammer at rest, rotation 0)
        parts['hammer'][0].rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        tex_size = 1024 if L.hi else 512
        textures, texi = [], {}
        for atlas, pngs in (('wood', wood_png), ('steel', steel_png)):
            for key in ('albedo', 'normal', 'arm'):
                texi[(atlas, key)] = len(textures)
                textures.append((webp(pngs[key], tex_size, {'albedo': 86, 'normal': 90, 'arm': 84}[key]), 'image/webp'))
        def gl_mat(name, atlas):
            return {'name': name, 'pbrMetallicRoughness': {'baseColorTexture': {'index': texi[(atlas, 'albedo')]}, 'metallicRoughnessTexture': {'index': texi[(atlas, 'arm')]},
                                                           'metallicFactor': 1.0, 'roughnessFactor': 1.0},
                    'normalTexture': {'index': texi[(atlas, 'normal')]}, 'occlusionTexture': {'index': texi[(atlas, 'arm')]}}
        materials = [gl_mat('lever-steel', 'steel'), gl_mat('lever-wood', 'wood')]
        meshes = [
            ('steel', 0, part_arrays(parts['steel'])),
            ('forend', 1, part_arrays(parts['forend'])),
            ('stock', 1, part_arrays(parts['stock'])),
            ('lever', 0, part_arrays(parts['lever'], LEVER_PIVOT)),
            ('hammer', 0, part_arrays(parts['hammer'], HAMMER_PIVOT)),
            ('bolt', 0, part_arrays(parts['bolt'])),
        ]
        write_glb(os.path.join(outdir, 'lever-rifle.glb'), meshes, textures, materials)
        stats['glb_tris'] = {n: int(len(a[3]) // 3) for n, _, a in meshes}
        stats['verts'] = {n: int(len(a[0])) for n, _, a in meshes}
        log(f'{lod}: wrote', os.path.join(outdir, 'lever-rifle.glb'), stats['glb_tris'])
    with open(os.path.join(outdir, 'stats.json'), 'w') as f:
        json.dump(stats, f, indent=1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir, 'lever-rifle.blend'))


for lod in LODS:
    run_lod(lod)
log('done')
