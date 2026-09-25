"""skinning_knife.py — Pine Hollow's first-person skinning knife in a gloved right hand, modelled + baked in Blender, headless.

    blender -b --factory-startup -P scripts/blender/weapons/skinning_knife.py -- <build dir> [--lod=hi,lo] [--bake=2048]
            [--samples=48] [--preview] [--no-bake] [--wood=<walnut diffuse.jpg>]

The same pipeline as lever_rifle.py (read that first): built in Blender's frame — +Y forward (the blade), +Z up (the
spine), +X right — and turned on export (game = (x, z, −y)): the blade along −Z, the edge down (−Y), the grip centre at
the origin (inside the fist), the wrist + coat sleeve running back (+Z) and a little down / right.

  knife  a drop-point hunter: a 10 cm satin blade (flat-ground bevel, a honed micro-bevel along the edge, a belly
         sweeping up to the tip, a choil), a brass guard with a finger quillon, an 11 cm oval walnut handle (Poly Haven
         CC0 walnut_veneer_02, the rifle's), two brass pins, a flared brass pommel
  hand   a right hand in a tan cowhide work glove, hammer grip: four fingers wrapped round the handle (each finger's
         joints solved so the phalanges hug the oval handle), the thumb laid over the index finger, the back of the
         hand to the right, the wrist + glove cuff back into
  sleeve ~12 cm of a dark wool coat sleeve with a turned hem (a dark lining disc inside, the far end capped)

The glove is sculpted high (a union of capsules + a lofted palm, voxel-remeshed and smoothed), given per-vertex seam /
wrinkle / contact attributes (finger-side stitched seams, knuckle creases, the worn palm), then decimated to the budget
and baked high → low (selected-to-active). The knife + sleeve bake onto themselves. ONE object `knife_hand`, ONE material:
albedo (sRGB), normal (OpenGL tangent space), ARM (AO · roughness · metalness); 'hi' ≤ 3.5 k tris / 1024² (desktop),
'lo' ≤ 1.8 k tris / 512² (phone), each baked on its own UVs.

Writes <build>/<lod>/skinning-knife.glb (float streams, WebP textures, EXT_texture_webp) + stats.json + the sidecar
skinning-knife.json + PNG bakes + preview renders + sheet.jpg (with --preview); run-knife.sh meshopt-compresses + copies.
"""
import bpy
import bmesh
import json
import math
import os
import struct
import subprocess
import sys
import time

import numpy as np
from mathutils import Matrix, Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(ARGV[0] if ARGV and not ARGV[0].startswith('--') else 'build-knife')
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
BUDGET = {'hi': 3480, 'lo': 1780}


def log(*a):
    print('[knife]', *a, flush=True)


# ─────────────────────────── the knife's numbers (Blender frame: +Y = the blade, +Z = the spine) ───────────────────────────
GUARD_B, GUARD_F = 0.0458, 0.0522          # the brass guard
BLADE_0 = 0.049                            # the blade's back face (inside the guard)
TIP_Y, TIP_Z = 0.1525, 0.0030              # the point: 10 cm of blade in front of the guard
BUTT_Y = -0.055                            # the handle's end (the pommel behind it)
H_ST = [0.0465, 0.043, 0.036, 0.024, 0.0, -0.024, -0.036, -0.044, -0.050, -0.055]
H_HX = [0.0101, 0.0104, 0.0107, 0.0111, 0.0114, 0.0114, 0.0112, 0.0110, 0.0110, 0.0113]   # handle half-width (x)
H_HZ = [0.0126, 0.0129, 0.0133, 0.0138, 0.0141, 0.0141, 0.0138, 0.0135, 0.0135, 0.0139]   # handle half-height (z)
PINS = [0.0418, -0.0445]


def hx_at(y):
    return float(np.interp(y, H_ST[::-1], H_HX[::-1]))


def hz_at(y):
    return float(np.interp(y, H_ST[::-1], H_HZ[::-1]))


# ─────────────────────────── geometry helpers (lever_rifle.py's) ───────────────────────────
def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mesh_obj(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(clean_customdata=False)
    me.update()
    return link(bpy.data.objects.new(name, me))


def fix_normals(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)


def quad_bez(p0, c, p1, n):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]) for t in (i / n for i in range(n + 1))]


def superellipse(a, b, p, n, cx=0.0, cz=0.0, phase=0.0):
    """n points around |x/a|^p + |z/b|^p = 1, counter-clockwise from the right"""
    pts = []
    for k in range(n):
        th = 2 * math.pi * (k + phase) / n
        c, s = math.cos(th), math.sin(th)
        pts.append((cx + a * math.copysign(abs(c) ** (2 / p), c), cz + b * math.copysign(abs(s) ** (2 / p), s)))
    return pts


def loft(name, rings, cap0=True, cap1=True, cap0_at=None, cap1_at=None, mats=None):
    """bridge rings of equal point count into a tube; caps fan to the centroid (or cap*_at). `mats(kind, gap, k)` →
    a material index per face (kind 'side' / 'cap0' / 'cap1')"""
    n = len(rings[0])
    verts = [tuple(p) for r in rings for p in r]
    faces, fm = [], []
    for i in range(len(rings) - 1):
        a, b = i * n, (i + 1) * n
        for k in range(n):
            faces.append((a + k, a + (k + 1) % n, b + (k + 1) % n, b + k))
            fm.append(mats('side', i, k) if mats else 0)
    for cap, ring_i, at, kind in ((cap0, 0, cap0_at, 'cap0'), (cap1, len(rings) - 1, cap1_at, 'cap1')):
        if not cap:
            continue
        c = np.array(at) if at is not None else np.mean(np.array(rings[ring_i]), axis=0)
        ci = len(verts)
        verts.append(tuple(c))
        base = ring_i * n
        for k in range(n):
            faces.append((base + k, base + (k + 1) % n, ci))
            fm.append(mats(kind, ring_i, k) if mats else 0)
    ob = mesh_obj(name, verts, faces)
    ob.data.polygons.foreach_set('material_index', np.array(fm, dtype=np.int32))
    fix_normals(ob)
    return ob


def lathe_axis(name, prof, seg, p0, direction, cap0=True, cap1=True):
    """a surface of revolution: prof = [(along, r)] around the axis from p0 along `direction`"""
    d = Vector(direction).normalized()
    u = d.orthogonal().normalized()
    w = d.cross(u)
    verts, faces, rings = [], [], []
    for (s, r) in prof:
        if r <= 1e-7:
            rings.append([len(verts)])
            verts.append(Vector(p0) + d * s)
        else:
            ring = []
            for k in range(seg):
                a = 2 * math.pi * k / seg
                ring.append(len(verts))
                verts.append(Vector(p0) + d * s + u * (r * math.cos(a)) + w * (r * math.sin(a)))
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
    ob = mesh_obj(name, verts, faces)
    fix_normals(ob)
    return ob


def capsule(name, p0, p1, r0, r1, seg=20, cap_n=6):
    """a tapered capsule (for the glove's high sculpt)"""
    p0, p1 = Vector(p0), Vector(p1)
    L = max((p1 - p0).length, 1e-5)
    prof = [(r0 * math.sin(a), r0 * math.cos(a)) for a in (-math.pi / 2 + (math.pi / 2) * k / cap_n for k in range(cap_n + 1))]
    prof += [(L + r1 * math.sin(a), r1 * math.cos(a)) for a in ((math.pi / 2) * k / cap_n for k in range(cap_n + 1))]
    prof[0] = (prof[0][0], 0.0)
    prof[-1] = (prof[-1][0], 0.0)
    return lathe_axis(name, prof, seg, p0, (p1 - p0) if L > 1e-4 else Vector((0, 0, 1)))


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


def tris_of(ob):
    return sum(len(f.vertices) - 2 for f in ob.data.polygons)


def smooth(ob, angle=38, weighted=True):
    me = ob.data
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(angle))
    if weighted:
        m = ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
        m.mode = 'FACE_AREA'
        m.weight = 70
        m.keep_sharp = True
        apply_mods(ob)


class Lod:
    def __init__(self, hi):
        self.hi = hi


# ─────────────────────────── the knife ───────────────────────────
KNIFE_MATS = ['spine', 'blade', 'bevel', 'edge', 'brass', 'wood']


def blade_curves():
    """spine / edge heights, half-thickness and grind fraction as functions of y"""
    sp = quad_bez((0.104, 0.0110), (0.141, 0.0108), (TIP_Y, TIP_Z), 40)
    ed = quad_bez((0.084, -0.0152), (0.131, -0.0168), (TIP_Y, TIP_Z), 40)
    spy, spz = np.array([p[0] for p in sp]), np.array([p[1] for p in sp])
    edy, edz = np.array([p[0] for p in ed]), np.array([p[1] for p in ed])

    def z_s(y):
        return 0.0105 + 0.0005 * (y - BLADE_0) / (0.104 - BLADE_0) if y <= 0.104 else float(np.interp(y, spy, spz))

    def z_e(y):
        if y <= 0.0555:
            return -0.0125
        if y <= 0.0585:                                     # the choil: a small half-round notch up into the ricasso
            t = (y - 0.0555) / 0.003
            return -0.0125 + 0.0014 * math.sin(math.pi * t) - 0.0017 * t
        if y <= 0.084:
            return -0.0142 - 0.0010 * (y - 0.0585) / (0.084 - 0.0585)
        return float(np.interp(y, edy, edz))

    def half_t(y):
        return float(np.interp(y, [BLADE_0, 0.12, 0.146, TIP_Y], [0.00165, 0.00125, 0.00055, 0.00032]))   # never thinner than 0.6 mm: the AO rays self-hit

    def grind(y):
        return float(np.interp(y, [BLADE_0, 0.0575, 0.062, 0.128, TIP_Y], [0.0, 0.0, 0.47, 0.50, 0.92]))
    return z_s, z_e, half_t, grind


def build_blade(L):
    z_s, z_e, half_t, grind = blade_curves()
    ys = [BLADE_0, 0.0555, 0.0585, 0.0625]
    n_main = 13 if L.hi else 6
    ys += list(0.0625 + (TIP_Y - 0.0625) * (1 - (1 - np.linspace(0, 1, n_main + 2)[1:-1]) ** 1.45))
    ys = sorted(y for y in ys if y < TIP_Y - 0.0035)      # monotonic, and clear of the point (the cap fans to it)
    rings = []
    for y in ys:
        zs, ze, t, g = z_s(y), z_e(y), half_t(y), grind(y)
        zg = ze + g * (zs - ze)
        hb = min(0.0011, 0.9 * (zg - ze)) if g > 0 else 0.0
        zh = ze + hb
        e = min(0.00022, t * 0.6) if g > 0 else t
        sr = min(0.0006, 0.3 * (zs - zg)) if zs - zg > 1e-4 else 0.0
        ring2 = [(t * 0.5, zs), (t, zs - sr), (t, zg), (e, zh), (0.0, ze), (-e, zh), (-t, zg), (-t, zs - sr), (-t * 0.5, zs)]
        if g == 0:   # the ricasso: squared off below
            ring2 = [(t * 0.5, zs), (t, zs - sr), (t, ze + 0.0004), (t * 0.9, ze), (0.0, ze), (-t * 0.9, ze), (-t, ze + 0.0004), (-t, zs - sr), (-t * 0.5, zs)]
        rings.append([(x, y, z) for (x, z) in ring2])
    # face k lies between ring point k and k+1: 0 / 7 / 8 the spine, 1 / 6 the flats, 2 / 5 the ground bevel, 3 / 4 the honed edge
    kmat = {0: 0, 7: 0, 8: 0, 1: 1, 6: 1, 2: 2, 5: 2, 3: 3, 4: 3}
    ob = loft('blade', rings, cap0=True, cap1=True, cap1_at=(0.0, TIP_Y, TIP_Z), mats=lambda kind, i, k: kmat[k])
    me = ob.data
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(50))
    # hard edges along the grind line, the micro-bevel and the apex (their faces meet at shallow angles)
    n = 9
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    pos = {}
    for i, r in enumerate(rings):
        for k, p in enumerate(r):
            pos[(round(p[0], 7), round(p[1], 7), round(p[2], 7))] = k
    for e in bm.edges:
        ks = [pos.get((round(v.co.x, 7), round(v.co.y, 7), round(v.co.z, 7))) for v in e.verts]
        if ks[0] is not None and ks[0] == ks[1] and ks[0] in (2, 3, 4, 5, 6):
            e.smooth = False
    bm.to_mesh(me)
    bm.free()
    return ob


def build_knife(L):
    parts = []

    def tag(ob, finish_idx=None, uvw=1.0):
        ob['uvw'] = uvw
        ob['part'] = 'knife'
        parts.append(ob)
        return ob
    blade = build_blade(L)
    tag(blade, uvw=2.4)
    # the guard: an oval plate with a finger quillon below the edge, chamfered faces
    right = [(0.0100, 0.0155), (0.0122, 0.0126), (0.0128, 0.0060), (0.0126, -0.0080), (0.0106, -0.0150)]
    bot = [(0.0068 * math.cos(math.radians(a)), -0.0236 + 0.0068 * math.sin(math.radians(a))) for a in np.linspace(-20, -160, 7 if L.hi else 4)]
    # the right side top → bottom, round the quillon, the left side bottom → top
    outline = [(x, z) for (x, z) in right] + bot + [(-x, z) for (x, z) in reversed(right)] + [(-0.0045, 0.0166), (0.0045, 0.0166)]
    zc = 0.0
    gring = lambda y, s: [(x * s, y, zc + (z - zc) * s) for (x, z) in outline]
    guard = loft('guard', [gring(GUARD_B, 0.93), gring(GUARD_B + 0.0009, 1.0), gring(GUARD_F - 0.0009, 1.0), gring(GUARD_F, 0.93)],
                 mats=lambda kind, i, k: 4)
    tag(guard, uvw=1.6)
    # the handle: oval walnut, swelling in the middle
    ys = H_ST if L.hi else [0.0465, 0.036, 0.0, -0.036, -0.047, -0.055]
    npt = 12 if L.hi else 10
    rings = [[(x, y, z) for (x, z) in superellipse(hx_at(y), hz_at(y), 2.25, npt, phase=0.5)] for y in ys]
    handle = loft('handle', rings, mats=lambda kind, i, k: 5)
    tag(handle, uvw=0.9)
    # the pommel: a flared brass cap
    pr = [(-0.0545, 1.0), (-0.0575, 1.12), (-0.0625, 1.10), (-0.0662, 0.86)] if L.hi else [(-0.0545, 1.0), (-0.0582, 1.12), (-0.0655, 0.95)]
    np_ = 14 if L.hi else 10
    prings = [[(x, y, z) for (x, z) in superellipse(hx_at(BUTT_Y) * s, hz_at(BUTT_Y) * s, 2.25, np_, phase=0.5)] for (y, s) in pr]
    pommel = loft('pommel', prings, cap1_at=(0.0, -0.0682, 0.0), mats=lambda kind, i, k: 4)
    tag(pommel, uvw=1.4)
    # brass pins through the handle, a hair proud of the walnut
    for j, py in enumerate(PINS if L.hi else PINS[1:]):
        hw = hx_at(py) + 0.0003
        r = 0.0021
        pin = lathe_axis(f'pin{j}', [(-hw, 0.0), (-hw, r * 0.8), (-hw + 0.0003, r), (hw - 0.0003, r), (hw, r * 0.8), (hw, 0.0)],
                         8 if L.hi else 6, (0, py, 0.0005), (1, 0, 0))
        pin.data.polygons.foreach_set('material_index', np.full(len(pin.data.polygons), 4, dtype=np.int32))
        tag(pin, uvw=1.2)
    for ob in parts:
        for _ in KNIFE_MATS:
            ob.data.materials.append(None)      # the slots keep material_index through the modifier applies
        if ob.name != 'blade':
            smooth(ob, 40)
        else:
            m = ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
            m.mode = 'FACE_AREA'
            m.keep_sharp = True
            apply_mods(ob)
    return parts


# ─────────────────────────── the gloved hand ───────────────────────────
FINGERS = [  # name, y, gloved radius, phalanx lengths (MCP→PIP, PIP→DIP, DIP→tip)
    ('index', 0.0290, 0.0097, (0.043, 0.025, 0.022)),
    ('middle', 0.0092, 0.0100, (0.047, 0.029, 0.023)),
    ('ring', -0.0102, 0.0096, (0.044, 0.027, 0.022)),
    ('pinky', -0.0282, 0.0086, (0.035, 0.021, 0.020)),
]
SQUEEZE = 0.0012     # the leather pressed onto the handle


def solve_finger(y, r, lens):
    """the finger's joints in the (x, z) plane at y: MCP position + the three flexion angles picked so the phalanges hug
    the oval handle (distance to its surface ≈ the finger radius − the squeeze), never sinking into it"""
    hx, hz = hx_at(y), hz_at(y)
    L1, L2, L3 = lens
    A0 = np.radians(np.arange(165, 250, 2.5))
    B1 = -np.radians(np.arange(55, 131, 2.5))
    B2 = -np.radians(np.arange(25, 106, 2.5))
    a0, b1, b2 = [g.ravel() for g in np.meshgrid(A0, B1, B2, indexing='ij')]
    rr = [r * 1.04, r, r * 0.95, r * 0.86]

    def dist(px, pz):
        rho = np.sqrt((px / hx) ** 2 + (pz / hz) ** 2)
        return np.sqrt(px * px + pz * pz) * (1 - 1 / np.maximum(rho, 1e-6))
    best = (1e9, None)
    for mx in np.arange(hx + 0.004, hx + 0.0181, 0.0035):
        for mz in np.arange(-hz - 0.009, -hz - 0.0029, 0.002):
            h1 = a0
            p1x, p1z = mx + L1 * np.cos(h1), mz + L1 * np.sin(h1)
            h2 = h1 + b1
            p2x, p2z = p1x + L2 * np.cos(h2), p1z + L2 * np.sin(h2)
            h3 = h2 + b2
            p3x, p3z = p2x + (L3 - rr[3] * 0.7) * np.cos(h3), p2z + (L3 - rr[3] * 0.7) * np.sin(h3)
            cost = np.zeros_like(a0)
            cnt = 0
            for (ax, az, bx, bz, ra, rb, t0) in ((mx, mz, p1x, p1z, rr[0], rr[1], 0.35), (p1x, p1z, p2x, p2z, rr[1], rr[2], 0.0), (p2x, p2z, p3x, p3z, rr[2], rr[3], 0.0)):
                for t in np.linspace(t0, 1.0, 6):
                    px, pz = ax + (bx - ax) * t, az + (bz - az) * t
                    e = dist(px, pz) - ((ra + (rb - ra) * t) - SQUEEZE)
                    cost += np.where(e > 0, e * e, 14 * e * e)
                    cnt += 1
            cost /= cnt
            # natural flexion (the PIP bends most, the DIP less), and the tip must not bury itself deep in the palm
            cost += 2e-6 * ((np.degrees(b1) + 95) / 30) ** 2 + 2e-6 * ((np.degrees(b2) + 60) / 30) ** 2
            tip_in = np.maximum(0, p3x - (hx + 0.004))
            cost += 1 * tip_in ** 2
            i = int(np.argmin(cost))
            if cost[i] < best[0]:
                best = (float(cost[i]), (mx, mz, a0[i], b1[i], b2[i]))
    mx, mz, h1, bb1, bb2 = best[1]
    P = [(mx, mz)]
    h = h1
    for Lk, turn in ((L1, 0.0), (L2, bb1), (L3, bb2)):
        h += turn
        P.append((P[-1][0] + Lk * math.cos(h), P[-1][1] + Lk * math.sin(h)))
    log(f'  finger y={y:+.4f}: rms {math.sqrt(best[0]) * 1000:.2f} mm, mcp ({mx:.4f}, {mz:.4f}) flex {math.degrees(bb1):.0f}° {math.degrees(bb2):.0f}°')
    return P, rr


def hand_chains():
    """[{'name', 'kind', 'pts': [4 × Vector], 'r': [4 radii]}] — the fingers + the thumb"""
    chains = []
    for (name, y, r, lens) in FINGERS:
        P, rr = solve_finger(y, r, lens)
        # a touch of convergence: the fingertips lean toward the thumb side (forward) as they curl
        pts = [Vector((x, y + 0.0012 * i * (1 if name in ('ring', 'pinky') else 0.4), z)) for i, (x, z) in enumerate(P)]
        chains.append({'name': name, 'kind': 'finger', 'pts': pts, 'r': rr})
    ix = chains[0]
    d_mid = (ix['pts'][2] + ix['pts'][3]) * 0.5
    rt = 0.0108
    ip = d_mid + Vector((-0.0035, 0.0045, ix['r'][2] + rt - 0.0032))
    tip = ip + Vector((-0.0085, 0.0080, -0.0115))
    mcp = ip + Vector((0.0175, -0.0165, -0.0035))
    cmc = Vector((0.0265, 0.0040, 0.0105))
    chains.append({'name': 'thumb', 'kind': 'thumb', 'pts': [cmc, mcp, ip, tip], 'r': [0.0135, 0.0114, 0.0107, 0.0094]})
    return chains


PALM = [  # y, centre x, centre z, half x, half z, superellipse power
    (0.0445, 0.0215, -0.0010, 0.0095, 0.0170, 2.2),
    (0.0380, 0.0228, 0.0005, 0.0130, 0.0215, 2.4),
    (0.0240, 0.0242, 0.0010, 0.0145, 0.0238, 2.6),
    (0.0000, 0.0247, 0.0000, 0.0150, 0.0240, 2.6),
    (-0.0240, 0.0250, -0.0010, 0.0150, 0.0236, 2.6),
    (-0.0390, 0.0258, -0.0020, 0.0148, 0.0222, 2.5),
    (-0.0520, 0.0282, -0.0030, 0.0152, 0.0218, 2.4),
    (-0.0640, 0.0312, -0.0040, 0.0172, 0.0240, 2.3),
    (-0.0780, 0.0340, -0.0050, 0.0200, 0.0272, 2.2),
    (-0.0920, 0.0360, -0.0062, 0.0220, 0.0296, 2.2),
    (-0.1150, 0.0385, -0.0080, 0.0226, 0.0302, 2.2),
]
WRIST = Vector((0.0340, -0.0780, -0.0050))


def build_glove_high(chains):
    obs = []
    rings = [[(x, y, z) for (x, z) in superellipse(a, b, p, 40, cx, cz)] for (y, cx, cz, a, b, p) in PALM]
    obs.append(loft('palm', rings))
    for c in chains:
        P, R = c['pts'], c['r']
        if c['kind'] == 'finger':
            end = P[2] + (P[3] - P[2]).normalized() * ((P[3] - P[2]).length - R[3] * 0.7)
            segs = [(P[0], P[1], R[0], R[1]), (P[1], P[2], R[1], R[2]), (P[2], end, R[2], R[3])]
            # the knuckle (MCP) under the leather
            obs.append(capsule(c['name'] + '_mcp', P[0] + Vector((0.002, 0, -0.001)), P[0] + Vector((0.004, 0, 0.002)), R[0] * 1.08, R[0] * 1.02))
        else:
            end = P[2] + (P[3] - P[2]).normalized() * ((P[3] - P[2]).length - R[3] * 0.6)
            segs = [(P[0], P[1], R[0], R[1]), (P[1], P[2], R[1], R[2]), (P[2], end, R[2], R[3])]
            # the thenar: the ball of the thumb, into the palm
            obs.append(capsule('thenar', Vector((0.0255, 0.0000, 0.0060)), P[1] + Vector((0.004, -0.002, -0.006)), 0.0150, 0.0125))
            # the palm's pads roll over the top of the handle to meet the fingertips
            obs.append(capsule('pad0', Vector((0.0060, 0.034, 0.0180)), Vector((0.0045, 0.0, 0.0192)), 0.0086, 0.0092))
            obs.append(capsule('pad1', Vector((0.0045, 0.0, 0.0192)), Vector((0.0075, -0.027, 0.0180)), 0.0092, 0.0086))
            obs.append(capsule('pad2', Vector((0.0075, -0.027, 0.0180)), Vector((0.0190, -0.048, 0.0120)), 0.0086, 0.0100))   # into the heel
        for j, (a, b, ra, rb) in enumerate(segs):
            obs.append(capsule(f"{c['name']}{j}", a, b, ra, rb))
    glove = join('glove_high', obs)
    m = glove.modifiers.new('remesh', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = 0.00065
    m.adaptivity = 0.0
    apply_mods(glove)
    m = glove.modifiers.new('smooth', 'SMOOTH')
    m.factor = 0.6
    m.iterations = 6
    apply_mods(glove)
    glove.data.shade_smooth()
    return glove


def glove_attributes(glove, chains):
    """per-vertex: seam (m to the nearest stitched seam), along (m along it, for the stitch dashes), wrinkle (−1…1 creases
    at the knuckles), contact (m to the handle's surface: the worn palm)"""
    me = glove.data
    V = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', V)
    V = V.reshape(-1, 3)
    N = len(V)
    best_d = np.full(N, 1e9)
    info = [None] * 0
    seg_list = []
    for ci, c in enumerate(chains):
        P = [np.array(p) for p in c['pts']]
        cum = 0.0
        for k in range(3):
            seg_list.append((ci, k, P[k], P[k + 1], c['r'][k], c['r'][k + 1], cum))
            cum += np.linalg.norm(P[k + 1] - P[k])
    D = np.zeros((N, len(seg_list)))
    T = np.zeros((N, len(seg_list)))
    for si, (ci, k, a, b, ra, rb, cum) in enumerate(seg_list):
        ab = b - a
        t = np.clip(((V - a) @ ab) / (ab @ ab), 0, 1)
        C = a + t[:, None] * ab
        D[:, si] = np.linalg.norm(V - C, axis=1) - (ra + (rb - ra) * t)
        T[:, si] = t
    near = np.argmin(D, axis=1)
    dmin = D[np.arange(N), near]
    seam = np.ones(N)
    along = np.zeros(N)
    wrinkle = np.zeros(N)
    for si, (ci, k, a, b, ra, rb, cum) in enumerate(seg_list):
        sel = (near == si) & (dmin < 0.0035)
        if not sel.any():
            continue
        c = chains[ci]
        ab = b - a
        L = np.linalg.norm(ab)
        u = ab / L
        t = T[sel, si]
        C = a + t[:, None] * ab
        # the finger's dorsal direction: away from the handle's axis
        mid = (a + b) / 2
        dvec = mid - np.array([0.0, mid[1], 0.0])
        dvec -= (dvec @ u) * u
        dvec /= np.linalg.norm(dvec)
        side = np.cross(u, dvec)
        v = V[sel] - C
        v -= (v @ u)[:, None] * u
        th = np.arctan2(v @ side, v @ dvec)
        rloc = ra + (rb - ra) * t
        s = cum + t * L
        if c['kind'] == 'finger':
            sd = rloc * np.abs(np.abs(th) - math.radians(98))
            sd = np.where(s < 0.010, 1.0, sd)                          # no seam where the finger meets the palm
            seam[sel] = sd
            along[sel] = s
            joints = [cum_j for (ci2, k2, _, _, _, _, cum_j) in seg_list if ci2 == ci and k2 in (1, 2)]
        else:
            ring = np.abs(s - 0.021) + np.where(s < 0.021, 0.0, 0.0)    # the keystone seam round the thumb's base
            sd = np.minimum(rloc * np.abs(np.abs(th) - math.radians(96)) + np.where(s < 0.024, 1.0, 0.0), ring)
            seam[sel] = sd
            along[sel] = np.where(ring < 0.002, th * rloc, s)
            joints = [cum_j for (ci2, k2, _, _, _, _, cum_j) in seg_list if ci2 == ci and k2 in (1, 2)]
        dors = np.clip(np.cos(th), 0, 1)
        w = np.zeros(sel.sum())
        for j, J in enumerate(joints):
            g = np.exp(-((s - J) / 0.0068) ** 2)
            w += g * np.sin(2 * math.pi * (s - J) / 0.0038 + 1.3 * j + 0.8 * th) * (0.55 + 0.45 * (1 - dors))
        wrinkle[sel] = w
    # the back of the hand + the wrist (vertices on no finger): three stitched 'points' down the back, the cuff seam, the
    # elastic's gathers round the wrist
    Nrm = np.zeros(N * 3)
    me.vertices.foreach_get('normal', Nrm)
    Nrm = Nrm.reshape(-1, 3)
    free = dmin >= 0.0035
    y, cx, cz = V[:, 1], np.interp(V[:, 1], [p[0] for p in PALM[::-1]], [p[1] for p in PALM[::-1]]), np.interp(V[:, 1], [p[0] for p in PALM[::-1]], [p[2] for p in PALM[::-1]])
    ang = np.arctan2(V[:, 2] - cz, V[:, 0] - cx)
    back = free & (Nrm[:, 0] > 0.55) & (y > -0.056) & (y < -0.004)
    zk = np.array([-0.0095, -0.0010, 0.0075])
    pts_d = np.min(np.abs(V[:, 2][:, None] - zk[None, :]), axis=1)
    fade = np.clip((y + 0.004) / -0.01, 0, 1) * np.clip((y + 0.056) / 0.008, 0, 1)
    pts_d = pts_d + (1 - fade) * 0.004
    upd = back & (pts_d < seam)
    seam[upd] = pts_d[upd]
    along[upd] = y[upd]
    cuff = free & (np.abs(y + 0.0585) < seam)
    seam[cuff] = np.abs(y[cuff] + 0.0585)
    along[cuff] = ang[cuff] * 0.024
    shir = free & (y < -0.0605) & (y > -0.080)
    win = np.clip((-0.0605 - y) / 0.003, 0, 1)
    wrinkle[shir] = (np.sin(ang * 26 + 3 * np.sin(ang * 7)) * win)[shir] * 0.9
    # the handle's surface distance (the worn, darkened palm + finger pads)
    hx = np.interp(V[:, 1], H_ST[::-1], H_HX[::-1])
    hz = np.interp(V[:, 1], H_ST[::-1], H_HZ[::-1])
    rho = np.sqrt((V[:, 0] / hx) ** 2 + (V[:, 2] / hz) ** 2)
    contact = np.sqrt(V[:, 0] ** 2 + V[:, 2] ** 2) * (1 - 1 / np.maximum(rho, 1e-6))
    contact = np.where((V[:, 1] > BUTT_Y - 0.01) & (V[:, 1] < GUARD_B + 0.004), contact, 1.0)
    for name, arr in (('seam', seam), ('along', along), ('wrinkle', wrinkle), ('contact', contact)):
        at = me.attributes.new(name, 'FLOAT', 'POINT')
        at.data.foreach_set('value', arr.astype(np.float32))
    log(f'  glove high: {len(me.vertices)} verts, seam verts {(seam < 0.0015).sum()}, wrinkle verts {(np.abs(wrinkle) > 0.2).sum()}')


def glove_low(glove_hi, target_tris):
    me = glove_hi.data.copy()
    for name in ('seam', 'along', 'wrinkle', 'contact'):
        if name in me.attributes:
            me.attributes.remove(me.attributes[name])
    ob = link(bpy.data.objects.new('glove', me))
    cur = tris_of(ob)
    m = ob.modifiers.new('dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = target_tris / cur
    m.use_collapse_triangulate = True
    apply_mods(ob)
    ob.data.shade_smooth()
    ob['uvw'] = 1.0
    ob['part'] = 'glove'
    return ob


# ─────────────────────────── the coat sleeve ───────────────────────────
SLEEVE_H = Vector((0.0358, -0.0725, -0.0060))
SLEEVE_D = Vector((0.20, -1.0, -0.17)).normalized()


def build_sleeve(L):
    D = SLEEVE_D
    U = (Vector((1, 0, 0)) - D * D.x).normalized()
    W = D.cross(U)
    if W.z < 0:
        W = -W
    n = 18 if L.hi else 12
    spec = [(0.022, 0.0305, 'lin'), (0.005, 0.0330, 'lin'), (-0.0008, 0.0352, 'wool'), (0.0016, 0.0388, 'wool'), (0.011, 0.0403, 'wool'),
            (0.036, 0.0418, 'wool'), (0.075, 0.0428, 'wool'), (0.118, 0.0436, 'wool')]
    if not L.hi:
        spec = [s for i, s in enumerate(spec) if i != 6]
    rings = []
    for j, (s, r, _) in enumerate(spec):
        ring = []
        for k in range(n):
            a = 2 * math.pi * (k + 0.5) / n
            fold = 1 + (0.035 * math.sin(3 * a + s * 55) + 0.02 * math.sin(5 * a + 1.7 + s * 30)) * (1 if j >= 4 else 0.3)
            ring.append(SLEEVE_H + D * s + U * (r * fold * math.cos(a)) + W * (r * 1.08 * fold * math.sin(a)))
        rings.append(ring)
    mats = lambda kind, i, k: 1 if kind != 'side' or spec[i][2] == 'lin' else 0
    ob = loft('sleeve', rings, mats=mats)
    ob.data.materials.append(None)
    ob.data.materials.append(None)
    smooth(ob, 60)
    ob['uvw'] = 0.3
    ob['part'] = 'sleeve'
    return ob


# ─────────────────────────── UVs ───────────────────────────
def unwrap(obs, margin):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:
        if not ob.data.uv_layers:
            ob.data.uv_layers.new(name='UVMap')
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
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

    def noise(self, vec, scale, detail=4.0, rough=0.55, distort=0.0):
        nz = self.n('ShaderNodeTexNoise', noise_dimensions='3D', i_Scale=scale, i_Detail=detail, i_Roughness=rough, i_Distortion=distort)
        self.l(vec, nz.inputs['Vector'])
        return nz

    def attr(self, name):
        a = self.n('ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name=name)
        return a.outputs['Fac']

    def maprange(self, v, a0, a1, b0, b1):
        m = self.n('ShaderNodeMapRange', clamp=True, i_From_Min=a0, i_From_Max=a1, i_To_Min=b0, i_To_Max=b1)
        self.l(v, m.inputs['Value'])
        return m.outputs['Result']

    def scaled(self, vec, sx, sy, sz):
        sep = self.n('ShaderNodeSeparateXYZ')
        self.l(vec, sep.inputs[0])
        comb = self.n('ShaderNodeCombineXYZ')
        self.l(self.math('MULTIPLY', sep.outputs['X'], sx), comb.inputs[0])
        self.l(self.math('MULTIPLY', sep.outputs['Y'], sy), comb.inputs[1])
        self.l(self.math('MULTIPLY', sep.outputs['Z'], sz), comb.inputs[2])
        return comb.outputs[0]


def finish_material(name, finish, target):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = NB(mat)
    out = b.n('ShaderNodeOutputMaterial', target='CYCLES')
    img = b.n('ShaderNodeTexImage', name='bake_target')
    img.image = target
    b.t.nodes.active = img
    if finish == 'target':      # the low glove: only the bake target
        em = b.n('ShaderNodeEmission')
        b.l(em.outputs[0], out.inputs['Surface'])
        return mat
    geo = b.n('ShaderNodeNewGeometry')
    pos = geo.outputs['Position']
    bev = b.n('ShaderNodeBevel', samples=12, i_Radius=0.0012)
    dot = b.n('ShaderNodeVectorMath', operation='DOT_PRODUCT')
    b.l(bev.outputs['Normal'], dot.inputs[0])
    b.l(geo.outputs['Normal'], dot.inputs[1])
    edge = b.math('SUBTRACT', 1.0, dot.outputs['Value'])
    ao = b.n('ShaderNodeAmbientOcclusion', samples=16, inside=False, i_Distance=0.008)
    cav = b.math('SUBTRACT', 1.0, ao.outputs['AO'])
    edge_m = b.math('MULTIPLY', b.math('MULTIPLY', edge, 18.0, clamp=True), b.math('POWER', ao.outputs['AO'], 3.0), clamp=True)
    grain = b.noise(pos, 700.0, 3.0, 0.6)
    wear = b.math('MULTIPLY', edge_m, b.math('ADD', b.math('MULTIPLY', grain.outputs['Fac'], 1.6), -0.35), clamp=True)
    bump_str, bump_dist = 0.3, 0.0003
    if finish in ('blade', 'spine', 'bevel', 'edge'):
        # satin stainless: brushed along the blade on the flats + spine, ground across it on the bevel, honed bright at the edge
        if finish == 'bevel':
            sv = b.scaled(pos, 1.0, 1.0, 0.025)
        else:
            sv = b.scaled(pos, 1.0, 0.02, 1.0)
        streak = b.noise(sv, 2400.0, 2.0, 0.5)
        haze = b.noise(pos, 60.0, 3.0, 0.5)
        base_c, base_r = {'blade': ((0.60, 0.60, 0.585), 0.24), 'spine': ((0.54, 0.54, 0.53), 0.34),
                          'bevel': ((0.47, 0.47, 0.46), 0.33), 'edge': ((0.86, 0.86, 0.85), 0.08)}[finish]
        s = streak.outputs['Fac']
        col = b.mix(b.math('MULTIPLY', b.math('SUBTRACT', s, 0.35), 1.6, clamp=True), tuple(c * 0.86 for c in base_c), tuple(min(1, c * 1.08) for c in base_c))
        col = b.mix(b.math('MULTIPLY', b.math('SUBTRACT', haze.outputs['Fac'], 0.55), 1.2, clamp=True), col, tuple(c * 0.9 for c in base_c))
        rough = b.math('ADD', base_r, b.math('MULTIPLY', b.math('SUBTRACT', s, 0.5), 0.12 if finish != 'edge' else 0.04))
        rough = b.math('ADD', rough, b.math('MULTIPLY', b.math('SUBTRACT', haze.outputs['Fac'], 0.5), 0.08))
        metal = 1.0
        height = b.math('MULTIPLY', s, 1.0)
        bump_str, bump_dist = (0.08, 0.00012) if finish != 'bevel' else (0.14, 0.00015)
    elif finish == 'brass':
        low = b.noise(pos, 90.0, 3.0, 0.55)
        pat = b.math('MULTIPLY', b.math('SUBTRACT', low.outputs['Fac'], 0.38), 2.0, clamp=True)
        col = b.mix(pat, (0.66, 0.46, 0.16), (0.36, 0.25, 0.09))
        col = b.mix(wear, col, (0.86, 0.66, 0.30))
        col = b.mix(b.math('MULTIPLY', cav, 0.9, clamp=True), col, (0.10, 0.08, 0.04))
        rough = b.math('ADD', 0.28, b.math('MULTIPLY', pat, 0.2))
        rough = b.math('ADD', rough, b.math('MULTIPLY', wear, -0.1))
        metal = b.math('SUBTRACT', 1.0, b.math('MULTIPLY', cav, 0.5))
        micro = b.noise(pos, 2200.0, 2.0, 0.5)
        height = micro.outputs['Fac']
        bump_str, bump_dist = 0.12, 0.0002
    elif finish == 'wood':
        wimg = bpy.data.images.load(WOOD_SRC, check_existing=True)
        S = 1 / 0.30

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
        hsv = b.n('ShaderNodeHueSaturation', i_Hue=0.495, i_Saturation=0.9, i_Value=1.0)
        b.l(raw, hsv.inputs['Color'])
        gam = b.n('ShaderNodeGamma', i_Gamma=2.35)
        b.l(hsv.outputs[0], gam.inputs[0])
        tint = b.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
        tint.inputs[0].default_value = 1.0
        b.l(gam.outputs[0], tint.inputs[6])
        tint.inputs[7].default_value = (0.78, 0.56, 0.42, 1)
        col = tint.outputs[2]
        col = b.mix(b.math('MULTIPLY', wear, 0.5), col, (0.36, 0.22, 0.12))
        col = b.mix(b.math('MULTIPLY', cav, 0.9, clamp=True), col, (0.05, 0.03, 0.02))
        lum = b.n('ShaderNodeRGBToBW')
        b.l(raw, lum.inputs[0])
        rough = b.math('ADD', 0.36, b.math('MULTIPLY', b.math('SUBTRACT', 0.6, lum.outputs[0]), 0.4))
        metal = 0.0
        micro = b.noise(pos, 2600.0, 2.0, 0.5)
        height = b.math('ADD', lum.outputs[0], b.math('MULTIPLY', micro.outputs['Fac'], 0.25))
        bump_str, bump_dist = 0.5, 0.0006
    elif finish == 'leather':
        seam = b.attr('seam')
        along = b.attr('along')
        wrk = b.attr('wrinkle')
        contact = b.attr('contact')
        # cowhide: blotchy tan-brown, a pebbled grain, stitched seams, creases at the knuckles, a worn dark palm
        blot = b.noise(pos, 32.0, 4.0, 0.6, distort=0.4)
        mid = b.noise(pos, 160.0, 3.0, 0.55)
        f = b.math('ADD', b.math('MULTIPLY', blot.outputs['Fac'], 1.0), b.math('MULTIPLY', mid.outputs['Fac'], 0.35))
        col = b.mix(b.math('MULTIPLY', b.math('SUBTRACT', f, 0.55), 1.8, clamp=True), (0.30, 0.170, 0.075), (0.175, 0.092, 0.038))
        vor = b.n('ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE', i_Scale=1900.0)
        b.l(pos, vor.inputs['Vector'])
        pebble = b.maprange(vor.outputs['Distance'], 0.0, 0.12, 0.0, 1.0)
        groove = b.maprange(seam, 0.0, 0.0013, 1.0, 0.0)
        frac = b.math('FRACT', b.math('DIVIDE', along, 0.0031))
        dash = b.math('MULTIPLY', b.maprange(frac, 0.52, 0.60, 1.0, 0.0), b.maprange(frac, 0.02, 0.10, 0.0, 1.0))
        stitch = b.math('MULTIPLY', b.maprange(seam, 0.00035, 0.0007, 1.0, 0.0), dash)
        crease = b.math('MULTIPLY', b.math('ABSOLUTE', wrk), 1.0)
        trough = b.maprange(wrk, -0.9, -0.2, 1.0, 0.0)
        worn = b.maprange(contact, 0.0005, 0.0035, 1.0, 0.0)
        col = b.mix(b.math('MULTIPLY', trough, 0.55), col, (0.075, 0.042, 0.02))
        col = b.mix(b.math('MULTIPLY', worn, 0.6), col, (0.10, 0.058, 0.03))
        col = b.mix(b.math('MULTIPLY', wear, 0.75, clamp=True), col, (0.36, 0.25, 0.14))
        col = b.mix(b.math('MULTIPLY', cav, 1.0, clamp=True), col, (0.05, 0.03, 0.015))
        col = b.mix(b.math('MULTIPLY', groove, 0.7), col, (0.06, 0.035, 0.018))
        col = b.mix(stitch, col, (0.46, 0.37, 0.22))
        rough = b.math('ADD', 0.56, b.math('MULTIPLY', b.math('SUBTRACT', mid.outputs['Fac'], 0.5), 0.12))
        rough = b.math('ADD', rough, b.math('MULTIPLY', worn, -0.2))
        rough = b.math('ADD', rough, b.math('MULTIPLY', wear, -0.16))
        rough = b.math('ADD', rough, b.math('MULTIPLY', stitch, 0.1))
        metal = 0.0
        height = b.math('ADD', b.math('MULTIPLY', pebble, 0.07), b.math('MULTIPLY', wrk, 0.55))
        height = b.math('ADD', height, b.math('MULTIPLY', groove, -0.7))
        height = b.math('ADD', height, b.math('MULTIPLY', stitch, 0.45))
        bump_str, bump_dist = 1.0, 0.0006
        _ = crease
    elif finish in ('wool', 'lining'):
        # charcoal wool twill: a diagonal rib, a fuzzy mottle, the hem's stitch line
        wave = b.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL', i_Scale=520.0, i_Distortion=2.0, i_Detail=2.0)
        b.l(pos, wave.inputs['Vector'])
        fuzz = b.noise(pos, 900.0, 4.0, 0.7)
        mot = b.noise(pos, 45.0, 3.0, 0.6)
        if finish == 'wool':
            col = b.mix(b.math('MULTIPLY', b.math('SUBTRACT', mot.outputs['Fac'], 0.35), 1.6, clamp=True), (0.050, 0.047, 0.040), (0.030, 0.029, 0.026))
            col = b.mix(b.math('MULTIPLY', wave.outputs['Fac'], 0.35), col, (0.070, 0.066, 0.056))
            col = b.mix(b.math('MULTIPLY', cav, 0.8, clamp=True), col, (0.012, 0.011, 0.010))
            # the hem stitch: 11 mm up the sleeve from the fold
            rel = b.n('ShaderNodeVectorMath', operation='SUBTRACT')
            b.l(pos, rel.inputs[0])
            rel.inputs[1].default_value = tuple(SLEEVE_H)
            dd = b.n('ShaderNodeVectorMath', operation='DOT_PRODUCT')
            b.l(rel.outputs[0], dd.inputs[0])
            dd.inputs[1].default_value = tuple(SLEEVE_D)
            hem = b.math('MULTIPLY', b.maprange(dd.outputs['Value'], 0.0095, 0.0105, 0.0, 1.0), b.maprange(dd.outputs['Value'], 0.0115, 0.0125, 1.0, 0.0))
            col = b.mix(b.math('MULTIPLY', hem, 0.6), col, (0.018, 0.017, 0.015))
            hem_h = b.math('MULTIPLY', hem, -0.8)
        else:
            col = b.mix(b.math('MULTIPLY', mot.outputs['Fac'], 0.5), (0.012, 0.011, 0.010), (0.02, 0.018, 0.016))
            hem_h = 0.0
        rough = b.math('ADD', 0.88, b.math('MULTIPLY', fuzz.outputs['Fac'], 0.08))
        metal = 0.0
        height = b.math('ADD', b.math('MULTIPLY', wave.outputs['Fac'], 0.5), b.math('MULTIPLY', fuzz.outputs['Fac'], 0.4))
        if not isinstance(hem_h, float):
            height = b.math('ADD', height, hem_h)
        bump_str, bump_dist = 0.5, 0.0005
    else:
        raise ValueError(finish)
    bump = b.n('ShaderNodeBump', i_Strength=bump_str, i_Distance=bump_dist)
    b.l(height, bump.inputs['Height'])
    b.l(geo.outputs['Normal'], bump.inputs['Normal'])
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
    mat['_alb'] = em_alb.name
    mat['_rm'] = em_rm.name
    mat['_bsdf'] = bsdf.name
    b.l(em_alb.outputs[0], out.inputs['Surface'])
    return mat


def set_output(mat, which):
    if '_alb' not in mat:
        return
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
    sc.render.bake.margin = 0
    if sc.world is None:
        sc.world = bpy.data.worlds.new('bake')
    sc.world.light_settings.distance = 0.03


def new_float_image(name, size):
    im = bpy.data.images.new(name, size, size, alpha=True, float_buffer=True)
    im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(np.zeros(size * size * 4, dtype=np.float32))
    return im


def ray_visible(ob, on):
    for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'):
        setattr(ob, k, on)


def bake_all(direct, glove_lo, glove_hi, mats, target_mat, size, outdir):
    """albedo / rm / normal / ao: the knife + sleeve onto themselves, the glove high → low; merged, then dilated"""
    sc = bpy.context.scene
    ims = {k: new_float_image(f'atlas_{k}', size) for k in ('alb', 'rm', 'nrm', 'ao')}
    ray_visible(glove_lo, False)
    for key, kind, out in (('alb', 'EMIT', 'alb'), ('rm', 'EMIT', 'rm'), ('nrm', 'NORMAL', 'bsdf'), ('ao', 'AO', 'bsdf')):
        for m in mats + [target_mat]:
            set_output(m, out)
            set_target(m, ims[key])
        sc.cycles.samples = SAMPLES if key not in ('nrm', 'alb', 'rm') else (8 if key == 'nrm' else 16)
        kw = dict(type=kind, margin=0, use_clear=False)
        if kind == 'NORMAL':
            kw.update(normal_space='TANGENT', normal_r='POS_X', normal_g='POS_Y', normal_b='POS_Z')
        t0 = time.time()
        # 1. the knife + sleeve, directly
        bpy.ops.object.select_all(action='DESELECT')
        for ob in direct:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = direct[0]
        bpy.ops.object.bake(**kw)
        # 2. the glove: the sculpt → the decimated low
        bpy.ops.object.select_all(action='DESELECT')
        glove_hi.hide_render = False
        glove_hi.select_set(True)
        glove_lo.select_set(True)
        bpy.context.view_layer.objects.active = glove_lo
        bpy.ops.object.bake(use_selected_to_active=True, cage_extrusion=0.0022, max_ray_distance=0.006, **kw)
        log(f'  bake {key} {size}² in {time.time() - t0:.1f}s')
    px = lambda im: np.array(im.pixels[:], dtype=np.float32).reshape(size, size, 4)
    alb, rm, nrm, ao = px(ims['alb']), px(ims['rm']), px(ims['nrm']), px(ims['ao'])
    cover = (alb[..., 3] > 0.5) | (nrm[..., 3] > 0.5)
    log(f'  atlas coverage {cover.mean() * 100:.1f}%')
    arm = np.stack([np.clip(ao[..., 0] * 0.85 + 0.15, 0, 1), np.clip(rm[..., 1], 0.04, 1), np.clip(rm[..., 2], 0, 1)], -1)
    srgb = lambda c: np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0.0031308, None), 1 / 2.4) - 0.055)
    outs = {'albedo': np.clip(srgb(np.clip(alb[..., :3], 0, 1)), 0, 1), 'normal': np.clip(nrm[..., :3], 0, 1), 'arm': arm}
    paths = {}
    for key, arr in outs.items():
        arr = dilate(arr, cover, 24)
        im = bpy.data.images.new(f'out_{key}', size, size, alpha=False)
        im.colorspace_settings.name = 'Non-Color'
        im.pixels.foreach_set(np.concatenate([arr, np.ones((size, size, 1), np.float32)], -1).astype(np.float32).ravel())
        p = os.path.join(outdir, f'knife-{key}.png')
        im.filepath_raw = p
        im.file_format = 'PNG'
        im.save()
        paths[key] = p
    return paths


def dilate(arr, mask, iters):
    """push the islands' colours out into the empty texels (the bake margin)"""
    a = arr.copy()
    a[~mask] = 0
    m = mask.astype(np.float32)
    for _ in range(iters):
        acc = np.zeros_like(a)
        cnt = np.zeros(m.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            acc += np.roll(np.roll(a * m[..., None], dy, 0), dx, 1)
            cnt += np.roll(np.roll(m, dy, 0), dx, 1)
        grow = (m == 0) & (cnt > 0)
        a[grow] = acc[grow] / cnt[grow][:, None]
        m[grow] = 1
    if (m == 0).any():
        a[m == 0] = a[m > 0].mean(axis=0)
    return a


# ─────────────────────────── export ───────────────────────────
def mesh_arrays(ob):
    """the object → float arrays in the game's frame (x, z, −y); UV v flipped for glTF"""
    me = ob.data
    me.calc_loop_triangles()
    M = ob.matrix_world.copy()
    R = M.to_3x3().inverted().transposed()
    uvl = me.uv_layers.active.data
    cn = me.corner_normals
    P, N, U, I = [], [], [], []
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
                idx = len(key)
                key[k] = idx
                P.append((p.x, p.z, -p.y))
                N.append((n.x, n.z, -n.y))
                U.append((uv.x, 1.0 - uv.y))
            face.append(idx)
        I.append(face)
    return (np.array(P, np.float32), np.array(N, np.float32), np.array(U, np.float32), np.array(I, np.uint32).ravel())


def write_glb(path, meshes, textures, materials):
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
        'asset': {'version': '2.0', 'generator': 'wildshard scripts/blender/weapons/skinning_knife.py'},
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


def webp(png, size, q):
    tmp = png.replace('.png', f'.{size}.png')
    subprocess.run(['magick', png, '-filter', 'Lanczos', '-resize', f'{size}x{size}', tmp], check=True)
    out = png.replace('.png', f'.{size}.webp')
    subprocess.run(['cwebp', '-quiet', '-q', str(q), '-m', '6', '-sharp_yuv', tmp, '-o', out], check=True)
    with open(out, 'rb') as f:
        return f.read()


# ─────────────────────────── preview + the sheet ───────────────────────────
FP_POSE = (math.radians(14), math.radians(-6), math.radians(20))   # a viewmodel pose: tip pitched up, yawed left
SHOTS = [  # name, label, camera, look-at, fov
    ('fp', 'first-person (lower right; posed tip up-left)', (-0.115, -0.34, 0.14), (-0.115, 0.66, -0.07), 60),
    ('side-left', 'left side (the player-facing side)', (-0.62, -0.02, 0.01), (0.0, -0.02, 0.0), 36),
    ('side-right', 'right side (back of the hand)', (0.62, -0.02, 0.01), (0.0, -0.02, 0.0), 36),
    ('three-quarter', '3/4 front-left, above', (-0.30, 0.32, 0.20), (0.01, -0.01, -0.005), 36),
    ('grip', 'grip close-up (front-left, below)', (-0.16, 0.12, -0.05), (0.008, 0.0, 0.0), 40),
    ('top', 'top', (0.0, -0.02, 0.62), (0.0, -0.02, 0.0), 36),
]


def preview(outdir, shots=SHOTS, res=(1000, 700), samples=96):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = res
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
    # a key light from above-front-left so the shapes read (the HDRI is soft)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.0
    sun.data.angle = math.radians(3)
    sun.rotation_euler = Vector((0.35, 0.5, -1.0)).to_track_quat('-Z', 'Y').to_euler()
    link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    link(cam)
    sc.camera = cam
    pose = link(bpy.data.objects.new('pose', None))
    for ob in list(sc.objects):
        if ob.type == 'MESH':
            ob.parent = pose
    files = []
    for name, label, loc, look, fov in shots:
        pose.rotation_euler = FP_POSE if name == 'fp' else (0, 0, 0)
        bpy.context.view_layer.update()
        cam.location = loc
        d = Vector(look) - Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cam.data.angle = math.radians(fov)
        cam.data.clip_start = 0.005
        p = os.path.join(outdir, f'preview-{name}.png')
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        files.append((p, label))
    pose.rotation_euler = (0, 0, 0)
    for ob in list(sc.objects):
        if ob.parent == pose:
            mw = ob.matrix_world.copy()
            ob.parent = None
            ob.matrix_world = mw
    bpy.data.objects.remove(pose)
    log('  previews written')
    return files


def make_sheet(files, out_jpg, title):
    font = '/System/Library/Fonts/Supplemental/Arial.ttf'
    tiles = []
    for p, label in files:
        t = p.replace('.png', '.tile.png')
        subprocess.run(['magick', p, '-resize', '760x', '-gravity', 'north', '-background', '#15181c', '-splice', '0x34', '-font', font,
                        '-fill', '#e8e2d4', '-pointsize', '21', '-annotate', '+0+6', label, t], check=True)
        tiles.append(t)
    tmp = out_jpg.replace('.jpg', '.grid.png')
    subprocess.run(['magick', 'montage', *tiles, '-tile', '2x', '-geometry', '+5+5', '-background', '#0d0f12', tmp], check=True)
    for q in (84, 78, 72, 66, 60):
        subprocess.run(['magick', tmp, '-gravity', 'north', '-background', '#0d0f12', '-splice', '0x44', '-font', font, '-fill', '#f2ecdf',
                        '-pointsize', '26', '-annotate', '+0+8', title, '-quality', str(q), '-sampling-factor', '4:2:0', out_jpg], check=True)
        if os.path.getsize(out_jpg) <= 400 * 1024:
            break
    log('  sheet', out_jpg, os.path.getsize(out_jpg) // 1024, 'KB')


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


def flat_material(name, col, rough, metal):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*col, 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    return m


# ─────────────────────────── main ───────────────────────────
def g(v):
    """Blender frame → the game's"""
    return [round(float(v[0]), 5), round(float(v[2]), 5), round(float(-v[1]), 5)]


def run_lod(lod):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    L = Lod(lod == 'hi')
    outdir = os.path.join(OUT, lod)
    os.makedirs(outdir, exist_ok=True)
    knife = build_knife(L)
    sleeve = build_sleeve(L)
    chains = hand_chains()
    t0 = time.time()
    ghi = build_glove_high(chains)
    glove_attributes(ghi, chains)
    log(f'  glove sculpt in {time.time() - t0:.1f}s: {tris_of(ghi)} tris')
    fixed = sum(tris_of(o) for o in knife) + tris_of(sleeve)
    glo = glove_low(ghi, BUDGET[lod] - fixed - 20)
    tris = {'knife': sum(tris_of(o) for o in knife), 'sleeve': tris_of(sleeve), 'glove': tris_of(glo)}
    log(f'{lod}: tris', tris, 'total', sum(tris.values()), ' per knife part', {o.name: tris_of(o) for o in knife})
    size = BAKE if L.hi else BAKE // 2
    lows = knife + [sleeve, glo]
    unwrap(lows, 0.004 if L.hi else 0.006)
    stats = {'lod': lod, 'tris': tris, 'total': sum(tris.values())}
    ghi.hide_render = True
    if 'no-bake' in OPT:
        # a quick look at the shapes: flat finishes, no bake
        fm = {'spine': flat_material('f-steel', (0.6, 0.6, 0.6), 0.25, 1.0), 'blade': None, 'bevel': flat_material('f-bevel', (0.45, 0.45, 0.45), 0.35, 1.0),
              'edge': flat_material('f-edge', (0.85, 0.85, 0.85), 0.08, 1.0), 'brass': flat_material('f-brass', (0.66, 0.46, 0.16), 0.3, 1.0),
              'wood': flat_material('f-wood', (0.22, 0.10, 0.05), 0.45, 0.0)}
        fm['blade'] = fm['spine']
        for ob in knife:
            for i, nm in enumerate(KNIFE_MATS):
                ob.data.materials[i] = fm[nm]       # (materials.clear() would drop the per-face indices)
        sleeve.data.materials[0] = flat_material('f-wool', (0.04, 0.04, 0.035), 0.9, 0.0)
        sleeve.data.materials[1] = flat_material('f-lin', (0.01, 0.01, 0.01), 0.9, 0.0)
        glo.data.materials.append(flat_material('f-leather', (0.25, 0.15, 0.07), 0.65, 0.0))
        if 'preview' in OPT:
            files = preview(outdir, res=(800, 560), samples=32)
            make_sheet(files, os.path.join(outdir, 'sheet.jpg'), f'skinning knife — shape check ({lod}, {sum(tris.values())} tris)')
    else:
        setup_cycles()
        dummy = bpy.data.images.new('dummy', 8, 8)
        mats = {f: finish_material(f'bake-{f}', f, dummy) for f in KNIFE_MATS + ['leather', 'wool', 'lining', 'target']}
        for ob in knife:
            for i, nm in enumerate(KNIFE_MATS):
                ob.data.materials[i] = mats[nm]     # (materials.clear() would drop the per-face indices)
        sleeve.data.materials[0] = mats['wool']
        sleeve.data.materials[1] = mats['lining']
        ghi.data.materials.clear()
        ghi.data.materials.append(mats['leather'])
        glo.data.materials.clear()
        glo.data.materials.append(mats['target'])
        paths = bake_all(knife + [sleeve], glo, ghi, [mats[k] for k in KNIFE_MATS + ['leather', 'wool', 'lining']], mats['target'], size, outdir)
        # one object, one material
        bpy.data.objects.remove(ghi)
        ray_visible(glo, True)
        obj = join('knife_hand', [glo] + knife + [sleeve])
        final = final_material('knife-hand', paths)
        obj.data.materials.clear()
        obj.data.materials.append(final)
        for p in obj.data.polygons:
            p.material_index = 0
        if 'preview' in OPT:
            files = preview(outdir)
            tier = 'desktop LOD, 1024² atlas' if L.hi else 'phone LOD, 512² atlas'
            make_sheet(files, os.path.join(outdir, 'sheet.jpg'), f'Pine Hollow — skinning knife in a gloved hand ({tier}, {sum(tris.values())} tris, Cycles)')
        tex_size = 1024 if L.hi else 512
        textures = [(webp(paths[k], tex_size, {'albedo': 86, 'normal': 90, 'arm': 84}[k]), 'image/webp') for k in ('albedo', 'normal', 'arm')]
        material = {'name': 'knife-hand', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 2},
                                                                   'metallicFactor': 1.0, 'roughnessFactor': 1.0},
                    'normalTexture': {'index': 1}, 'occlusionTexture': {'index': 2}}
        arrays = mesh_arrays(obj)
        write_glb(os.path.join(outdir, 'skinning-knife.glb'), [('knife_hand', 0, arrays)], textures, [material])
        P = arrays[0]
        stats['glb_tris'] = int(len(arrays[3]) // 3)
        stats['verts'] = int(len(P))
        # the sidecar: the points the game hangs things on (game frame)
        z_s, z_e, _, _ = blade_curves()
        edge_y = 0.5 * (0.0585 + TIP_Y)
        side = {
            'tris': stats['glb_tris'],
            'bbox': {'min': [round(float(v), 5) for v in P.min(axis=0)], 'max': [round(float(v), 5) for v in P.max(axis=0)]},
            'bladeTip': g((0.0, TIP_Y, TIP_Z)),
            'edgeMid': g((0.0, edge_y, z_e(edge_y))),
            'gripCentre': [0, 0, 0],
            'wristCentre': g(WRIST),
            'textures': tex_size,
        }
        with open(os.path.join(outdir, 'skinning-knife.json'), 'w') as f:
            json.dump(side, f, indent=1)
        log(f'{lod}: wrote', os.path.join(outdir, 'skinning-knife.glb'), side)
    with open(os.path.join(outdir, 'stats.json'), 'w') as f:
        json.dump(stats, f, indent=1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir, 'skinning-knife.blend'))


if __name__ == '__main__':
    for lod in LODS:
        run_lod(lod)
    log('done')
