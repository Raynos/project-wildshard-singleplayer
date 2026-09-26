"""fei_zhua.py — lab P9 "grapple" (E169): the Fei Zhua 飛爪 wrist grapple, modelled + AO-baked in Blender, headless.

    /opt/homebrew/bin/blender -b --factory-startup -P src/dev/nd-lab/grapple/blender/fei_zhua.py -- <out dir> [--samples=96]

Writes <out>/fei-zhua.glb (float streams; run meshopt after). Built in Blender's frame — +Y forward (the forearm toward the
muzzle), +Z up (the back of the forearm), +X the inner side (toward the screen centre for a left arm) — and written in
glTF's frame (x, z, −y), so in three.js the muzzle points down −Z and the top of the arm is +Y.

Parts (one glTF node each; the node translation is the part's pivot, the vertices are relative to it):
  bracer   carbon bracer, two leather straps, brass buckles                                 pivot: the wrist (origin)
  housing  the brass launcher: body plates, dragon-scale armour, rivets, the barrel + bands, the muzzle collar with its
           three talon guides, the capacitor (glow core, brass caps, cage), three status LEDs, the filament guide
  spool    the line drum on the inner side (brass flanges with spokes, cyan filament windings)  pivot: its axle (spins on X)
  claw     the flying hub: body, rings, the steel nose spike, three hinge knuckles, the rear eyelet (glow) pivot: its centre
  talon    ONE talon (the game clones it at 0 / 120 / 240°): link arm, piston, joint, the curved hook blade
           pivot: its hinge (turns on X: + opens outward)
  fist     a gloved left fist (a stand-in: lab P8 owns the hands)
  sleeve   the dark cloth sleeve with a red cord wrap (a stand-in: lab P8 owns the arms)

COLOR_0 (normalised bytes) carries data, not colour: r = baked AO (Cycles, the assembled arm; the claw on its own),
g = convexity (0.5 flat, > 0.5 a convex bevel: edge wear, < 0.5 a crease: grime), b = material class / 16, a = emit group / 8.
Classes: 0 brass · 1 dark brass · 2 carbon · 3 gunmetal · 4 leather · 5 glow · 6 red silk · 7 cloth · 8 blade brass.
Emit groups (only on class 5): 1–3 the status LEDs · 4 the capacitor core · 5 the spool filament · 6 the claw eyelet.
"""
import bpy
import bmesh
import json
import math
import os
import struct
import sys

import numpy as np
from mathutils import Matrix, Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(ARGV[0] if ARGV and not ARGV[0].startswith('--') else 'build-fei-zhua')
OPT = {}
for a in ARGV:
    if a.startswith('--'):
        k, _, v = a[2:].partition('=')
        OPT[k] = v if v else True
SAMPLES = int(OPT.get('samples', 96))

C = dict(brass=0, dbrass=1, carbon=2, gun=3, leather=4, glow=5, silk=6, cloth=7, blade=8)


def log(*a):
    print('[feizhua]', *a, flush=True)


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


def fix_normals(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def loft(name, rings, cap0=True, cap1=True):
    """bridge rings of equal point count into a tube; caps fan to the ring centroid"""
    n = len(rings[0])
    verts = [p for r in rings for p in r]
    faces = []
    for i in range(len(rings) - 1):
        a, b = i * n, (i + 1) * n
        faces += [(a + k, a + (k + 1) % n, b + (k + 1) % n, b + k) for k in range(n)]
    for cap, ri in ((cap0, 0), (cap1, len(rings) - 1)):
        if not cap:
            continue
        c = np.mean(np.array(rings[ri]), axis=0)
        ci = len(verts)
        verts.append(tuple(c))
        base = ri * n
        faces += [(base + k, base + (k + 1) % n, ci) for k in range(n)]
    ob = mesh_obj(name, verts, faces)
    fix_normals(ob)
    return ob


def lathe(name, prof, seg, axis='Y', at=(0, 0, 0), phase=0.0):
    """a surface of revolution: prof = [(along, r)] around `axis` through `at`; r = 0 closes to a pole"""
    verts, faces, rings = [], [], []
    for (s, r) in prof:
        if r <= 1e-7:
            rings.append([len(verts)])
            verts.append((s, 0.0, 0.0))
            continue
        ring = []
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
    if len(rings[0]) > 1:
        faces.append(tuple(reversed(rings[0])))
    if len(rings[-1]) > 1:
        faces.append(tuple(rings[-1]))
    M = {'Y': lambda s, u, v: (v, s, u), 'X': lambda s, u, v: (s, u, v), 'Z': lambda s, u, v: (u, v, s)}[axis]
    ob = mesh_obj(name, [tuple(np.add(M(*p), at)) for p in verts], faces)
    fix_normals(ob)
    return ob


def box(name, x0, x1, y0, y1, z0, z1):
    v = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    ob = mesh_obj(name, v, f)
    fix_normals(ob)
    return ob


def sweep(name, centre, section, up=(0, 0, 1), cap=True):
    """sweep a closed 2D section [(u, v)] (or t → section) along a 3D polyline; u along the side axis, v along `up`"""
    U = Vector(up)
    rings = []
    m = len(centre)
    for i, p in enumerate(centre):
        p = Vector(p)
        t = (Vector(centre[min(i + 1, m - 1)]) - Vector(centre[max(i - 1, 0)])).normalized()
        side = t.cross(U).normalized()
        nv = side.cross(t).normalized()
        sec = section(i / (m - 1)) if callable(section) else section
        rings.append([tuple(p + side * u + nv * v) for (u, v) in sec])
    return loft(name, rings, cap, cap)


def tube(name, path, radius, seg=12, up=(0, 0, 1), cap=True):
    """a round tube along a polyline; radius a number or t → r; cap=False + a repeated first point = a closed ring"""
    def sec(t):
        r = radius(t) if callable(radius) else radius
        return [(r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg)) for k in range(seg)]
    return sweep(name, path, sec, up, cap)


def annulus_x(name, x0, x1, r0, r1, seg):
    """a flat ring (washer) around the X axis: inner radius r0, outer r1, from x0 to x1"""
    verts, faces = [], []
    for (x, r) in ((x0, r0), (x0, r1), (x1, r1), (x1, r0)):
        for k in range(seg):
            a = 2 * math.pi * k / seg
            verts.append((x, r * math.cos(a), r * math.sin(a)))
    for j in range(4):
        a, b = j * seg, ((j + 1) % 4) * seg
        faces += [(a + k, a + (k + 1) % seg, b + (k + 1) % seg, b + k) for k in range(seg)]
    ob = mesh_obj(name, verts, faces)
    fix_normals(ob)
    return ob


def superellipse(a, b, p, n, cz=0.0):
    pts = []
    for k in range(n):
        th = 2 * math.pi * k / n
        c, s = math.cos(th), math.sin(th)
        pts.append((a * math.copysign(abs(c) ** (2 / p), c), cz + b * math.copysign(abs(s) ** (2 / p), s)))
    return pts


def bez(p0, p1, p2, p3, n):
    P = [np.array(p, float) for p in (p0, p1, p2, p3)]
    out = []
    for i in range(n + 1):
        t = i / n
        q = (1 - t) ** 3 * P[0] + 3 * (1 - t) ** 2 * t * P[1] + 3 * (1 - t) * t * t * P[2] + t ** 3 * P[3]
        out.append(tuple(q))
    return out


def dome(name, r, sx=1.0, sy=1.0, sz=1.0, seg=10, rings=4):
    """a half ellipsoid (flat side down, on z = 0)"""
    verts, faces = [], []
    ring_ids = []
    for i in range(rings + 1):
        phi = math.pi / 2 * i / rings
        rr, z = r * math.cos(phi), r * math.sin(phi)
        if i == rings:
            ring_ids.append([len(verts)])
            verts.append((0, 0, z * sz))
            break
        ids = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            ids.append(len(verts))
            verts.append((rr * math.cos(a) * sx, rr * math.sin(a) * sy, z * sz))
        ring_ids.append(ids)
    for r0, r1 in zip(ring_ids, ring_ids[1:]):
        if len(r1) == 1:
            faces += [(r0[k], r0[(k + 1) % seg], r1[0]) for k in range(seg)]
        else:
            faces += [(r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]) for k in range(seg)]
    faces.append(tuple(reversed(ring_ids[0])))
    ob = mesh_obj(name, verts, faces)
    fix_normals(ob)
    return ob


def xf(ob, M):
    ob.data.transform(M)
    ob.data.update()
    return ob


def add_bevel(ob, width, segs=2, angle=35):
    m = ob.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segs
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.use_clamp_overlap = True
    return m


def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)


def subsurf(ob, levels=1):
    m = ob.modifiers.new('sub', 'SUBSURF')
    m.levels = levels
    m.render_levels = levels
    apply_mods(ob)
    return ob


def bevelled(ob, width, segs=2, angle=35):
    add_bevel(ob, width, segs, angle)
    apply_mods(ob)
    return ob


def tag(ob, cls, emit=0):
    """per-vertex material class + emit group, as float point attributes (they survive the joins)"""
    me = ob.data
    n = len(me.vertices)
    for key, val in (('cls', cls), ('emit', emit)):
        at = me.attributes.get(key) or me.attributes.new(key, 'FLOAT', 'POINT')
        at.data.foreach_set('value', np.full(n, float(val), np.float32))
    return ob


def join(name, obs):
    obs = [o for o in obs if o is not None]
    if len(obs) == 1:
        obs[0].name = name
        return obs[0]
    with bpy.context.temp_override(active_object=obs[0], selected_editable_objects=obs, selected_objects=obs):
        bpy.ops.object.join()
    obs[0].name = name
    return obs[0]


def smooth(ob, angle=34):
    me = ob.data
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(angle))
    m = ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
    m.mode = 'FACE_AREA'
    m.weight = 70
    m.keep_sharp = True
    apply_mods(ob)


# ─────────────────────────── dimensions (metres, Blender frame) ───────────────────────────
def arm_r(y):
    """the forearm's half width (x) and half height (z) at y (wrist y = 0, elbow y ≈ −0.26)"""
    t = min(max(-y / 0.26, 0.0), 1.0)
    return 0.041 + 0.010 * t, 0.031 + 0.010 * t


BARREL_Z, BARREL_R = 0.060, 0.0205
MUZZLE_Y = 0.104
CLAW_Y = 0.112              # the claw hub's centre when docked
HINGE_R, HINGE_DY = 0.0168, 0.010
SPOOL = Vector((0.0395, -0.112, 0.040))
SPOOL_R = 0.0205


# ─────────────────────────── the arm parts ───────────────────────────
def build_bracer():
    parts = []
    ys = np.linspace(-0.206, -0.004, 34)
    rings = []
    for i, y in enumerate(ys):
        rx, rz = arm_r(y)
        lip = 1.0
        if i in (0, len(ys) - 1):
            lip = 0.97
        elif i in (1, 2, len(ys) - 2, len(ys) - 3):
            lip = 1.07
        rings.append([(x * lip, y, z * lip) for (x, z) in superellipse(rx + 0.004, rz + 0.004, 2.5, 56)])
    b = loft('bracer_shell', rings)
    parts.append(tag(b, C['carbon']))
    # two leather straps with brass buckles on the inner (+X) side
    for yc in (-0.168, -0.070):
        rr = []
        for y in (yc - 0.0095, yc - 0.0085, yc + 0.0085, yc + 0.0095):
            rx, rz = arm_r(y)
            e = 0.0072 if abs(y - yc) < 0.009 else 0.0058
            rr.append([(x, y, z) for (x, z) in superellipse(rx + e, rz + e, 2.5, 56)])
        s = loft('strap', rr)
        parts.append(tag(s, C['leather']))
        rx, rz = arm_r(yc)
        fr = []
        # buckle: a square frame + the tongue
        bx = rx + 0.0085
        for (ya, yb, za, zb) in ((yc - 0.012, yc + 0.012, 0.0085, 0.012), (yc - 0.012, yc + 0.012, -0.012, -0.0085),
                                 (yc - 0.012, yc - 0.0085, -0.012, 0.012), (yc + 0.0085, yc + 0.012, -0.012, 0.012)):
            fr.append(tag(bevelled(box('buckle', bx - 0.0012, bx + 0.0016, ya, yb, za, zb), 0.0006, 1), C['brass']))
        fr.append(tag(bevelled(box('tongue', bx - 0.001, bx + 0.0022, yc - 0.0015, yc + 0.0015, -0.009, 0.009), 0.0005, 1), C['dbrass']))
        parts += fr
    # the brass cuffs (comp-B's signature): a wide riveted wrist cuff and a narrow elbow band, raised rims, engraved
    for (ya, yb, nriv) in ((-0.048, -0.003, 14), (-0.207, -0.187, 0)):
        rr = []
        for (y, e) in ((ya, 0.0050), (ya + 0.0012, 0.0086), (ya + 0.0045, 0.0086), (ya + 0.0052, 0.0072), (yb - 0.0052, 0.0072),
                       (yb - 0.0045, 0.0086), (yb - 0.0012, 0.0086), (yb, 0.0050)):
            rx, rz = arm_r(y)
            rr.append([(x, y, z) for (x, z) in superellipse(rx + e, rz + e, 2.5, 64)])
        parts.append(tag(loft('cuff', rr), C['brass']))
        for k in range(nriv):
            a = 2 * math.pi * (k + 0.5) / nriv
            for yy in (ya + 0.0028, yb - 0.0028):
                rx, rz = arm_r(yy)
                c, sn = math.cos(a), math.sin(a)
                # the superellipse point at this angle, pushed out to the rim
                px = (rx + 0.0088) * math.copysign(abs(c) ** (2 / 2.5), c)
                pz = (rz + 0.0088) * math.copysign(abs(sn) ** (2 / 2.5), sn)
                r = dome('rivet', 0.0016, 1, 1, 0.8, 8, 2)
                n = Vector((px / (rx * rx), 0, pz / (rz * rz))).normalized()
                q = Vector((0, 0, 1)).rotation_difference(n)
                parts.append(tag(xf(r, Matrix.Translation((px, yy, pz)) @ q.to_matrix().to_4x4()), C['dbrass']))
    ob = join('bracer', parts)
    return ob


def housing_section(y, w0, w1, z0, z1, n=40):
    """the housing's cross-section: a rounded trapezoid (bottom w0 wide at z0, top w1 at z1)"""
    pts = []
    for (x, z) in superellipse(1.0, 1.0, 3.2, n):
        t = (z + 1) / 2
        hw = (w0 + (w1 - w0) * t) / 2
        pts.append((x * hw, y, z0 + (z1 - z0) * t))
    return pts


def build_housing():
    parts = []
    # the body: two brass plates with a panel gap between them, over a carbon skirt that sits on the bracer
    def body(name, y0, y1, w0, w1, z0, z1, taper_front=0.0):
        rings = []
        ys = np.linspace(y0, y1, 12)
        for y in ys:
            t = (y - y0) / (y1 - y0)
            k = 1.0 - taper_front * t * t
            rings.append(housing_section(y, w0 * k, w1 * k, z0, z1 - 0.004 * t * taper_front * 3))
        ob = loft(name, rings)
        return bevelled(ob, 0.0016, 2, 30)
    parts.append(tag(body('skirt', -0.172, -0.004, 0.060, 0.056, 0.020, 0.040), C['carbon']))
    parts.append(tag(body('rearplate', -0.166, -0.074, 0.056, 0.042, 0.030, 0.066), C['brass']))
    parts.append(tag(body('frontplate', -0.071, 0.004, 0.056, 0.044, 0.030, 0.064, 0.1), C['brass']))
    # the raised spine ridge on the rear plate (the capacitor cradle)
    parts.append(tag(bevelled(box('cradle', -0.013, 0.013, -0.160, -0.080, 0.060, 0.070), 0.002, 2), C['dbrass']))
    # the barrel: a lathe along Y with bands, a flared muzzle collar
    prof = [(-0.03, 0.0), (-0.03, BARREL_R * 0.9), (-0.028, BARREL_R), (0.018, BARREL_R), (0.0185, BARREL_R + 0.0022),
            (0.0245, BARREL_R + 0.0022), (0.025, BARREL_R), (0.052, BARREL_R), (0.0525, BARREL_R + 0.0022), (0.0585, BARREL_R + 0.0022),
            (0.059, BARREL_R), (0.084, BARREL_R), (0.086, BARREL_R + 0.0045), (0.098, BARREL_R + 0.0062),
            (MUZZLE_Y, BARREL_R + 0.0062), (MUZZLE_Y + 0.0015, BARREL_R + 0.0035), (MUZZLE_Y + 0.0015, 0.0172),
            (0.080, 0.0172), (0.080, 0.0)]
    brl = lathe('barrel', prof, 48, 'Y', (0, 0, BARREL_Z))
    parts.append(tag(brl, C['brass']))
    # a carbon sleeve between the bands
    parts.append(tag(lathe('barrel_carbon', [(0.0262, 0.0), (0.0262, BARREL_R + 0.0012), (0.0508, BARREL_R + 0.0012), (0.0508, 0.0)], 48, 'Y', (0, 0, BARREL_Z)), C['carbon']))
    # the barrel's saddle onto the front plate
    parts.append(tag(bevelled(box('saddle', -0.014, 0.014, -0.036, 0.012, 0.050, BARREL_Z), 0.002, 2), C['brass']))
    # three talon guides on the muzzle collar (at the talons' angles: 90°, 210°, 330°)
    for ang in (90, 210, 330):
        a = math.radians(ang)
        g = bevelled(box('guide', -0.0032, 0.0032, 0.080, MUZZLE_Y + 0.004, 0.0, 0.0065), 0.0012, 2)
        R = Matrix.Rotation(a - math.pi / 2, 4, 'Y')
        # rotate about the barrel axis: local +Z → the radial direction at `ang`
        rad = Matrix.Translation((0, 0, BARREL_R + 0.0035))
        M = Matrix.Translation((0, 0, BARREL_Z)) @ Matrix.Rotation(-(a - math.pi / 2), 4, 'Y') @ rad
        del R
        parts.append(tag(xf(g, M), C['dbrass']))
    # the capacitor: a glow core in a brass cage with end caps, lying in the cradle
    cy0, cy1, cz = -0.152, -0.088, 0.078
    parts.append(tag(lathe('cap_core', [(cy0 + 0.006, 0.0), (cy0 + 0.006, 0.0062), (cy1 - 0.006, 0.0062), (cy1 - 0.006, 0.0)], 24, 'Y', (0, 0, cz)), C['glow'], 4))
    for (ya, yb) in ((cy0, cy0 + 0.0075), (cy1 - 0.0075, cy1)):
        cap = lathe('cap_end', [(ya, 0.0), (ya, 0.0085), (ya + 0.001, 0.0098), (yb - 0.001, 0.0098), (yb, 0.0085), (yb, 0.0)], 32, 'Y', (0, 0, cz))
        parts.append(tag(cap, C['brass']))
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        p0 = (0.0093 * math.cos(a), cy0 + 0.006, cz + 0.0093 * math.sin(a))
        p1 = (0.0093 * math.cos(a), cy1 - 0.006, cz + 0.0093 * math.sin(a))
        parts.append(tag(tube('cage', [p0, p1], 0.0011, 8), C['gun']))
    # the conduit from the capacitor to the barrel
    parts.append(tag(tube('conduit', bez((0.0, cy1 - 0.004, cz), (0.0, -0.07, cz + 0.004), (0.0, -0.05, 0.072), (0.0, -0.028, BARREL_Z + 0.012), 10), 0.0034, 12), C['dbrass']))
    # dragon-scale armour on the front plate: offset rows of overlapping domed scales
    for row in range(5):
        y = -0.062 + row * 0.0118
        n = 5 if row % 2 == 0 else 4
        for i in range(n):
            x = (i - (n - 1) / 2) * 0.0092
            zt = 0.063 - 0.004 * (x / 0.02) ** 2
            sc = dome('scale', 0.0056, 1.0, 1.22, 0.36, 10, 3)
            M = Matrix.Translation((x, y, zt - 0.0008)) @ Matrix.Rotation(math.radians(-14), 4, 'X') @ Matrix.Rotation(math.atan2(-x, 0.05), 4, 'Y')
            parts.append(tag(xf(sc, M), C['brass']))
    # rivets along both plates' lower edge on the inner side, and on the rear plate's top corners
    for y in np.arange(-0.158, 0.0, 0.0155):
        r = dome('rivet', 0.0019, 1, 1, 0.8, 8, 2)
        M = Matrix.Translation((0.0288, y, 0.030)) @ Matrix.Rotation(math.radians(90), 4, 'Y')
        parts.append(tag(xf(r, M), C['brass']))
        if y < -0.082:
            r = dome('rivet', 0.0017, 1, 1, 0.8, 8, 2)
            M = Matrix.Translation((0.0243, y, 0.048)) @ Matrix.Rotation(math.radians(90), 4, 'Y')
            parts.append(tag(xf(r, M), C['dbrass']))
    # the three status LEDs on the inner face, in brass bezels
    for i, y in enumerate((-0.050, -0.039, -0.028)):
        bez_ = lathe('bezel', [(0.0, 0.0), (0.0, 0.0034), (0.0014, 0.0034), (0.0016, 0.0024), (0.0016, 0.0)], 16, 'X', (0.0245, y, 0.047))
        parts.append(tag(bez_, C['dbrass']))
        led = dome('led', 0.0022, 1, 1, 0.8, 12, 3)
        parts.append(tag(xf(led, Matrix.Translation((0.0258, y, 0.047)) @ Matrix.Rotation(math.radians(90), 4, 'Y')), C['glow'], i + 1))
    # the filament guide: from the spool's top to an eyelet at the barrel's rear
    gy = SPOOL.y + 0.006
    parts.append(tag(tube('guide_arm', bez((0.036, gy, 0.0645), (0.030, -0.07, 0.068), (0.020, -0.045, BARREL_Z + 0.008), (0.012, -0.028, BARREL_Z + 0.010), 10), 0.0019, 10), C['dbrass']))
    parts.append(tag(bevelled(annulus_x('guide_eye', 0.0345, 0.0375, 0.0022, 0.0046, 20), 0.0004, 1), C['brass']))
    parts[-1].data.transform(Matrix.Translation((0, gy, 0.0645)))
    ob = join('housing', parts)
    return ob


def build_spool():
    """the drum at the origin (the node pivot sits at SPOOL); axle along X"""
    parts = []
    w = 0.0072
    for sx in (-1, 1):
        # a flange: rim ring + hub + five spokes
        x = sx * w
        rim = bevelled(annulus_x('rim', x - 0.0011, x + 0.0011, SPOOL_R - 0.0032, SPOOL_R, 48), 0.0005, 1)
        parts.append(tag(rim, C['brass']))
        hub = lathe('hub', [(x - 0.0012, 0.0), (x - 0.0012, 0.0062), (x + 0.0012, 0.0062), (x + 0.0012, 0.0)], 24, 'X')
        parts.append(tag(hub, C['brass']))
        for k in range(5):
            a = 2 * math.pi * k / 5 + (0.3 if sx > 0 else 0.0)
            sp = bevelled(box('spoke', x - 0.0010, x + 0.0010, -0.0019, 0.0019, 0.0055, SPOOL_R - 0.0028), 0.0005, 1)
            parts.append(tag(xf(sp, Matrix.Rotation(a, 4, 'X')), C['dbrass']))
    # the drum core and the filament windings (a slightly lumpy glowing wrap)
    parts.append(tag(lathe('core', [(-w, 0.0), (-w, 0.0085), (w, 0.0085), (w, 0.0)], 24, 'X'), C['gun']))
    prof = [(-w + 0.001, 0.0)] + [(-w + 0.001 + (2 * w - 0.002) * i / 12, 0.0142 + 0.0006 * math.sin(i * 2.1)) for i in range(13)] + [(w - 0.001, 0.0)]
    parts.append(tag(lathe('winding', prof, 40, 'X'), C['glow'], 5))
    parts.append(tag(lathe('axle', [(-w - 0.004, 0.0), (-w - 0.004, 0.0028), (w + 0.006, 0.0028), (w + 0.006, 0.0)], 16, 'X'), C['gun']))
    parts.append(tag(lathe('nut', [(w + 0.0035, 0.0), (w + 0.0035, 0.0042), (w + 0.0065, 0.0042), (w + 0.0065, 0.0)], 6, 'X'), C['brass']))
    return join('spool', parts)


def build_fist():
    """a gloved left fist (stand-in): palm block, four curled fingers, the thumb wrapped over the inner side"""
    parts = []
    palm = box('palm', -0.036, 0.034, 0.004, 0.074, -0.020, 0.020)
    palm = subsurf(bevelled(palm, 0.008, 2), 1)
    parts.append(tag(palm, C['leather']))
    wrist = loft('wrist', [[(x, y, z) for (x, z) in superellipse(*[v * s for v in arm_r(y)], 2.4, 32)] for (y, s) in ((-0.012, 1.0), (0.006, 1.0), (0.018, 0.92))])
    parts.append(tag(wrist, C['leather']))
    for i in range(4):
        x = -0.026 + i * 0.0175
        L = 1.0 - abs(i - 1.3) * 0.07
        r = 0.0088 - i * 0.0004
        path = [(x, 0.070, 0.010), (x, 0.086 * L + 0.006, 0.006), (x, 0.093 * L + 0.004, -0.010), (x, 0.086 * L, -0.024), (x, 0.066, -0.028)]
        fg = tube('finger', path, lambda t, r=r: r * (1.0 - 0.12 * t), 14, (1, 0, 0))
        parts.append(tag(subsurf(fg, 1), C['leather']))
        kn = dome('knuckle', 0.0074, 1.0, 1.0, 0.55, 12, 3)
        parts.append(tag(xf(kn, Matrix.Translation((x, 0.066, 0.017))), C['leather']))
    thumb = tube('thumb', [(0.030, 0.018, -0.004), (0.040, 0.040, -0.012), (0.036, 0.062, -0.022), (0.020, 0.074, -0.028), (0.004, 0.076, -0.028)],
                 lambda t: 0.0105 * (1.0 - 0.18 * t), 14, (0, 0, 1))
    parts.append(tag(subsurf(thumb, 1), C['leather']))
    # a brass-studded knuckle strap
    strap = bevelled(box('kstrap', -0.036, 0.034, 0.046, 0.058, 0.018, 0.024), 0.002, 2)
    parts.append(tag(strap, C['dbrass']))
    return join('fist', parts)


def build_sleeve():
    parts = []
    ys = np.linspace(-0.62, -0.170, 30)
    rings = []
    for y in ys:
        rx, rz = arm_r(y)
        out = []
        for k, (x, z) in enumerate(superellipse(rx + 0.012, rz + 0.012, 2.2, 48)):
            a = 2 * math.pi * k / 48
            f = 1.0 + 0.045 * math.sin(a * 5 + y * 60) * math.sin(y * 31) + 0.02 * math.sin(a * 9 - y * 90)
            out.append((x * f, y, z * f))
        rings.append(out)
    parts.append(tag(loft('cloth', rings), C['cloth']))
    # the red silk cord: a tight binding wrap near the bracer (5 turns) and a looser one up the sleeve (2 turns)
    for (ya, yb, turns, r, ph) in ((-0.214, -0.176, 7.0, 0.0016, 0.0), (-0.214, -0.18, 6.0, 0.0015, 2.1), (-0.37, -0.23, 2.5, 0.0016, 0.7)):
        path = []
        m = int(40 * turns)
        for i in range(m):
            t = i / (m - 1)
            a = t * turns * 2 * math.pi + ph
            # an irregular, hand-bound wrap: the pitch wanders
            y = ya + (yb - ya) * (t + 0.02 * math.sin(a * 0.7 + ph))
            rx, rz = arm_r(y)
            path.append(((rx + 0.0132) * math.cos(a), y, (rz + 0.0132) * math.sin(a)))
        parts.append(tag(tube('cord', path, r, 8, (0, 1, 0)), C['silk']))
    return join('sleeve', parts)


# ─────────────────────────── the claw ───────────────────────────
def build_claw():
    """the hub at the origin, its axis +Y (the flight direction), talon 0's hinge at +Z"""
    parts = []
    prof = [(-0.020, 0.0), (-0.020, 0.0105), (-0.017, 0.0145), (-0.008, 0.0158), (-0.006, 0.0164), (0.004, 0.0164), (0.006, 0.0158),
            (0.016, 0.0150), (0.018, 0.0120), (0.018, 0.0)]
    parts.append(tag(lathe('hub', prof, 48, 'Y'), C['brass']))
    parts.append(tag(lathe('hub_band', [(-0.005, 0.0), (-0.005, 0.0171), (0.003, 0.0171), (0.003, 0.0)], 48, 'Y'), C['dbrass']))
    # the nose: a faceted steel spike
    parts.append(tag(lathe('nose', [(0.017, 0.0), (0.017, 0.0098), (0.024, 0.0085), (0.040, 0.0), ], 6, 'Y', phase=0.5), C['gun']))
    # the rear eyelet where the filament ties on (glows while the line is live)
    parts.append(tag(lathe('eye_post', [(-0.028, 0.0), (-0.028, 0.0035), (-0.019, 0.0035), (-0.019, 0.0)], 12, 'Y'), C['gun']))
    ring = tube('eyelet', [(0.0055 * math.cos(2 * math.pi * k / 24), -0.0325, 0.0055 * math.sin(2 * math.pi * k / 24)) for k in range(25)], 0.0016, 8, (0, 1, 0), False)
    parts.append(tag(ring, C['glow'], 6))
    # three hinge knuckles (clevis pairs) at the talons' angles
    for ang in (90, 210, 330):
        a = math.radians(ang)
        for sx in (-1, 1):
            ear = bevelled(box('ear', sx * 0.0048 - 0.0014, sx * 0.0048 + 0.0014, HINGE_DY - 0.006, HINGE_DY + 0.0045, 0.010, HINGE_R + 0.0035), 0.0008, 1)
            parts.append(tag(xf(ear, Matrix.Rotation(-(a - math.pi / 2), 4, 'Y')), C['dbrass']))
    return join('claw', parts)


def build_talon():
    """one talon in its hinge frame: X = the hinge axis, +Y forward, +Z outward (radial)"""
    parts = []
    parts.append(tag(lathe('pin', [(-0.0062, 0.0), (-0.0062, 0.0032), (0.0062, 0.0032), (0.0062, 0.0)], 16, 'X'), C['gun']))
    # the link arm: a bevelled bar with a lightening slot look (two rails) and a piston
    arm = bevelled(box('link', -0.0042, 0.0042, -0.003, 0.042, -0.0032, 0.0052), 0.0014, 2)
    parts.append(tag(arm, C['brass']))
    parts.append(tag(bevelled(box('rib', -0.0036, 0.0036, 0.008, 0.032, 0.0036, 0.0054), 0.0008, 1), C['dbrass']))
    parts.append(tag(tube('piston', [(0.0, 0.004, -0.0048), (0.0, 0.036, -0.0036)], 0.0017, 10, (1, 0, 0)), C['gun']))
    parts.append(tag(lathe('joint', [(-0.0045, 0.0), (-0.0045, 0.0042), (0.0045, 0.0042), (0.0045, 0.0)], 16, 'X', (0, 0.041, 0.0006)), C['dbrass']))
    # the blade: a curved raptor hook; a lens section with the sharp edge inward (−Z) and a rounded spine outward
    path = bez((0.0, 0.038, 0.0012), (0.0, 0.080, 0.030), (0.0, 0.134, 0.022), (0.0, 0.132, -0.030), 44)

    def sec(t):
        w = 0.0078 * (1.0 - t ** 1.3) + 0.0004
        h = 0.0150 * (1.0 - t) ** 0.75 + 0.0006
        pts = []
        for k in range(14):
            a = 2 * math.pi * k / 14
            c, s = math.cos(a), math.sin(a)
            # v > 0 is the outward spine (round), v < 0 the inner cutting edge (sharp: pinched)
            v = h * s if s > 0 else h * 1.25 * s
            u = w * c * (1.0 - 0.75 * max(-s, 0.0) ** 1.4)
            pts.append((u, v))
        return pts
    blade = sweep('blade', path, sec, (0, 0, 1))
    parts.append(tag(blade, C['blade']))
    # the root collar where the blade meets the joint
    parts.append(tag(lathe('collar', [(0.036, 0.0), (0.036, 0.0052), (0.043, 0.0048), (0.043, 0.0)], 16, 'Y', (0, 0, 0.0012)), C['dbrass']))
    ob = join('talon', parts)
    return xf(ob, Matrix.Scale(1.1, 4))


# ─────────────────────────── bake + attributes ───────────────────────────
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
    if sc.world is None:
        sc.world = bpy.data.worlds.new('bake')
    sc.world.light_settings.distance = 0.022


def bake_ao(obs):
    """Cycles AO into a point colour attribute 'ao' on every object of the group (they occlude each other)"""
    mat = bpy.data.materials.get('bakemat') or bpy.data.materials.new('bakemat')
    for ob in obs:
        if not ob.data.materials:
            ob.data.materials.append(mat)
        ca = ob.data.color_attributes.get('ao') or ob.data.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT')
        ob.data.color_attributes.active_color = ca
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    sc = bpy.context.scene
    sc.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='AO')
    bpy.ops.object.select_all(action='DESELECT')


def convexity(ob):
    """per vertex: −mean(n · edge direction) → 0.5 flat, > 0.5 convex (a bevel), < 0.5 concave"""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    out = np.full(len(bm.verts), 0.5, np.float32)
    for v in bm.verts:
        if not v.link_edges:
            continue
        n = v.normal
        acc = 0.0
        for e in v.link_edges:
            d = (e.other_vert(v).co - v.co)
            if d.length > 1e-9:
                acc += n.dot(d.normalized())
        acc /= len(v.link_edges)
        out[v.index] = min(max(0.5 - acc * 2.2, 0.0), 1.0)
    bm.free()
    return out


def part_arrays(ob, pivot):
    """the part → (P, N, C) float arrays in glTF's frame (x, z, −y), relative to the pivot; C = RGBA 0..1"""
    me = ob.data
    me.calc_loop_triangles()
    npv = len(me.vertices)
    ao = np.ones(npv, np.float32)
    ca = me.color_attributes.get('ao')
    if ca is not None:
        buf = np.zeros(npv * 4, np.float32)
        ca.data.foreach_get('color', buf)
        ao = buf[0::4].copy()
    cls = np.zeros(npv, np.float32)
    emit = np.zeros(npv, np.float32)
    for key, arr in (('cls', cls), ('emit', emit)):
        at = me.attributes.get(key)
        if at is not None:
            at.data.foreach_get('value', arr)
    cvx = convexity(ob)
    M = Matrix.Translation(-pivot) @ ob.matrix_world
    R = M.to_3x3().inverted().transposed()
    cn = me.corner_normals
    P, N, Cc, I = [], [], [], []
    key = {}
    for tri in me.loop_triangles:
        face = []
        for li in tri.loops:
            vi = me.loops[li].vertex_index
            n = (R @ cn[li].vector).normalized()
            k = (vi, round(n.x, 3), round(n.y, 3), round(n.z, 3))
            idx = key.get(k)
            if idx is None:
                idx = len(key)
                key[k] = idx
                p = M @ me.vertices[vi].co
                P.append((p.x, p.z, -p.y))
                N.append((n.x, n.z, -n.y))
                Cc.append((float(ao[vi]), float(cvx[vi]), float(cls[vi]) / 16.0, float(emit[vi]) / 8.0))
            face.append(idx)
        I.append(face)
    return np.array(P, np.float32), np.array(N, np.float32), np.array(Cc, np.float32), np.array(I, np.uint32).ravel()


def write_glb(path, parts):
    """parts: [(name, pivot Vector (Blender frame), (P, N, C, I))] → one node per part with the pivot as its translation"""
    blob = bytearray()
    views, accessors, meshes, nodes = [], [], [], []

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

    def acc(arr, comp, typ, target, minmax=False, normalized=False):
        a = {'bufferView': view(arr.tobytes(), target), 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
        if normalized:
            a['normalized'] = True
        if minmax:
            a['min'] = [float(x) for x in arr.min(axis=0)]
            a['max'] = [float(x) for x in arr.max(axis=0)]
        accessors.append(a)
        return len(accessors) - 1

    stats = {}
    for (name, pivot, (P, N, Cc, I)) in parts:
        c8 = np.clip(np.round(Cc * 255.0), 0, 255).astype(np.uint8)
        attrs = {'POSITION': acc(P, 5126, 'VEC3', 34962, True), 'NORMAL': acc(N, 5126, 'VEC3', 34962), 'COLOR_0': acc(c8, 5121, 'VEC4', 34962, normalized=True)}
        big = I.max() >= 65535
        ind = acc(I if big else I.astype(np.uint16), 5125 if big else 5123, 'SCALAR', 34963)
        meshes.append({'name': name, 'primitives': [{'attributes': attrs, 'indices': ind, 'mode': 4}]})
        nodes.append({'name': name, 'mesh': len(meshes) - 1, 'translation': [pivot.x, pivot.z, -pivot.y]})
        stats[name] = {'tris': int(len(I) // 3), 'verts': int(P.shape[0])}
    align()
    doc = {
        'asset': {'version': '2.0', 'generator': 'wildshard src/dev/nd-lab/grapple/blender/fei_zhua.py'},
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}],
        'nodes': nodes, 'meshes': meshes, 'accessors': accessors, 'bufferViews': views,
        'buffers': [{'byteLength': len(blob)}],
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
    return stats


def preview(path, obs):
    """a quick Eevee still of the assembled arm (for the log / the README)"""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1200, 800
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    link(cam)
    cam.location = (0.42, -0.28, 0.30)
    d = Vector((0.0, -0.03, 0.035)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 55
    sc.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (0.7, 0.2, 0.9)
    link(sun)
    brass = bpy.data.materials.new('pv_brass')
    brass.use_nodes = True
    bsdf = brass.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.55, 0.38, 0.12, 1)
    bsdf.inputs['Metallic'].default_value = 1.0
    bsdf.inputs['Roughness'].default_value = 0.35
    for ob in obs:
        ob.data.materials.clear()
        ob.data.materials.append(brass)
    sc.world.color = (0.3, 0.33, 0.4)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    setup_cycles()
    arm = {'bracer': build_bracer(), 'housing': build_housing(), 'fist': build_fist(), 'sleeve': build_sleeve()}
    spool = build_spool()
    spool.location = SPOOL
    arm['spool'] = spool
    for ob in arm.values():
        smooth(ob)
    # the claw docked, three talons folded, for the arm's AO (the claw's own AO is baked alone, below)
    claw = build_claw()
    talon = build_talon()
    smooth(claw)
    smooth(talon)
    claw_at = Vector((0.0, CLAW_Y, BARREL_Z))
    claw.location = claw_at
    fold = math.radians(2.0)
    talons = []
    for i, ang in enumerate((90, 210, 330)):
        t = talon if i == 0 else talon.copy()
        if i:
            t.data = talon.data.copy()
            link(t)
        a = math.radians(ang)
        t.matrix_world = (Matrix.Translation(claw_at) @ Matrix.Rotation(-(a - math.pi / 2), 4, 'Y')
                          @ Matrix.Translation((0, HINGE_DY, HINGE_R)) @ Matrix.Rotation(fold, 4, 'X'))
        talons.append(t)
    bpy.context.view_layer.update()
    log('bake arm AO …')
    bake_ao(list(arm.values()) + [claw] + talons)
    # the claw flies alone: re-bake its AO with the arm hidden
    for ob in arm.values():
        ob.hide_render = True
    log('bake claw AO …')
    bake_ao([claw] + talons)
    for ob in arm.values():
        ob.hide_render = False
    parts = [
        ('sleeve', Vector((0, 0, 0)), part_arrays(arm['sleeve'], Vector((0, 0, 0)))),
        ('bracer', Vector((0, 0, 0)), part_arrays(arm['bracer'], Vector((0, 0, 0)))),
        ('housing', Vector((0, 0, 0)), part_arrays(arm['housing'], Vector((0, 0, 0)))),
        ('fist', Vector((0, 0, 0)), part_arrays(arm['fist'], Vector((0, 0, 0)))),
        ('spool', SPOOL.copy(), part_arrays(arm['spool'], SPOOL.copy())),
        ('claw', claw_at.copy(), part_arrays(claw, claw_at.copy())),
    ]
    # the talon in its own hinge frame (unrotated): take talon 0's world matrix off
    t0 = talons[0]
    hinge = t0.matrix_world.copy()
    t0.matrix_world = Matrix.Translation(hinge.to_translation())
    bpy.context.view_layer.update()
    parts.append(('talon', hinge.to_translation(), part_arrays(t0, hinge.to_translation())))
    stats = write_glb(os.path.join(OUT, 'fei-zhua.glb'), parts)
    tot = sum(s['tris'] for s in stats.values())
    json.dump({'parts': stats, 'tris': tot, 'hinge': [HINGE_DY, HINGE_R], 'claw': [claw_at.x, claw_at.y, claw_at.z],
               'spool': [SPOOL.x, SPOOL.y, SPOOL.z], 'barrel': [BARREL_Z, BARREL_R, MUZZLE_Y]}, open(os.path.join(OUT, 'fei-zhua.json'), 'w'), indent=1)
    log('parts', json.dumps(stats), 'total tris', tot)
    if 'preview' in OPT:
        t0.matrix_world = hinge
        preview(os.path.join(OUT, 'preview.png'), list(arm.values()) + [claw] + talons)


main()
