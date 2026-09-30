"""arms.py — Driftwood's castaway first-person arms and its two swords (E334, board 2 A / A2), modelled in Blender, headless.

    blender -b --factory-startup -noaudio --python-exit-code 1 -P scripts/blender/driftwood-isle/fp-arms/arms.py -- \
        <bind.json> <out dir> [--preview]

Step 2 of the target "driftwood-isle/fp-arms" (scripts/blender/targets.json). skeleton.mjs wrote <bind.json>: Nine
Dragon's arm skeleton at its bind pose (fp-rig.glb, round 13), in rig space (the viewmodel camera at scale 1: x right,
y up, -z forward, metres). This script models round that skeleton and writes <out>/parts.json for bake.mjs, which skins
the parts, adds the finger bones and the swim clips and writes the GLB. Nothing here is a glTF: the parts are triangle
soups with a colour per corner and a weight rule, so no axis conversion happens anywhere.

The look (Jake's pick, board 2 A "castaway"): Driftwood's toon low-poly — faceted, flat vertex colour per facet, no
texture — sun-browned hands, patched cream linen sleeves rolled to mid-forearm, a hemp-cord grip with a knotted tail on
both swords (wooden: the pale carved blade and a cord-lashed wooden guard; iron: a faceted steel blade, a dark iron guard).

Parts (each a closed-ish lofted shape, Catmull-Clark once, then triangulated):
  <S>.palm, <S>.thenar         hand-local lofts, weight rule 'hand'
  <S>.<finger>                 index / middle / ring / pinky / thumb, weight rule 'chain' over its three bones
  <S>.arm                      the bare forearm, wrist to elbow ('arm')
  <S>.sleeve, <S>.roll         the linen sleeve from the rolled cuff over the elbow to the shoulder, the roll ('arm')
  sword.wood, sword.iron       weapon-local (R_weapon: origin at the guard, +y the blade, +x the edges), rigid

The hands are modelled OPEN (fingers straight, a little natural flex): that is the bind. The finger bones' rest pose is
the grip (right: each finger's joints curled until the phalanges meet the grip or the palm; the thumb laid along the
grip toward the guard) or the relaxed off hand (left). The swim poses are more rotations of the same bones: one hand,
every pose.
"""
import bpy
import bmesh
import json
import math
import os
import subprocess
import sys

from mathutils import Matrix, Quaternion, Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(ARGV) < 2:
    raise SystemExit('usage: arms.py -- <bind.json> <out dir> [--preview]')
BIND = json.load(open(ARGV[0]))
OUT = os.path.abspath(ARGV[1])
PREVIEW = '--preview' in ARGV
os.makedirs(OUT, exist_ok=True)


def log(*a):
    print('[fp-arms]', *a, flush=True)


# ─────────────────────────── the skeleton ───────────────────────────
def mat(name):
    w = BIND['bones'][name]['world']
    return Matrix([w[0:4], w[4:8], w[8:12], w[12:16]]).transposed()


def pos(name):
    return mat(name).to_translation()


# the Driftwood sword sits 6 cm nearer the hand than the jian (a 15 cm grip, not a jian's 21 cm): R_weapon's offset in
# R_hand, along the grip. bake.mjs writes the same offset into the GLB's R_weapon node.
WEAPON_T = Vector((-0.0229, 0.155, -0.0262))


# ─────────────────────────── colours (sRGB hex → linear, like Sword.ts `lin`) ───────────────────────────
def lin(h):
    c = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


SKIN, SKIN_DK, SKIN_LT, NAIL = lin(0xb8744a), lin(0x9e5f3a), lin(0xc98a5e), lin(0xd9aa84)
LINEN, LINEN_DK, LINEN_SH = lin(0xe6dcc6), lin(0xcdbf9f), lin(0xb9aa8a)
PATCH_A, PATCH_B, HOLE = lin(0xa98758), lin(0x8b8f74), lin(0x6e3b26)
CORD, CORD_DK = lin(0xc6a46a), lin(0x8d6c3c)
WOOD, WOOD_EDGE, WOOD_DK = lin(0xdcbb8c), lin(0xe9cda3), lin(0xa77b4c)
STEEL, STEEL_EDGE, IRON = lin(0xb9bec6), lin(0xdfe3e8), lin(0x3f4047)


# ─────────────────────────── a tiny deterministic RNG (per-facet jitter, fold wobble) ───────────────────────────
class Rng:
    def __init__(self, seed):
        self.s = seed * 7919 + 13

    def next(self):
        self.s = (self.s * 1103515245 + 12345) & 0x7fffffff
        return self.s / 0x7fffffff


# ─────────────────────────── the mesh builder: lofted rings with a colour per face ───────────────────────────
class Part:
    """faces (lists of Vectors) with a colour each; later one Blender object → subdivided → triangles"""

    def __init__(self, name, rule, subdiv=1, metal=0.0):
        self.name, self.rule, self.subdiv, self.metal = name, rule, subdiv, metal
        self.faces = []   # (verts, colour, metal)

    def face(self, verts, col, metal=None):
        self.faces.append((verts, col, self.metal if metal is None else metal))

    def loft(self, rings, cols, cap0=False, cap1=False, cap_col=None):
        """rings: [[Vector]*n]; cols: a colour per band (len(rings)-1) or one colour, or a function(band, i)"""
        n = len(rings[0])
        for r in range(len(rings) - 1):
            a, b = rings[r], rings[r + 1]
            for i in range(n):
                j = (i + 1) % n
                col = cols(r, i) if callable(cols) else (cols[r] if isinstance(cols, list) else cols)
                self.face([a[i], a[j], b[j], b[i]], col)
        cc = cap_col if cap_col is not None else (cols(0, 0) if callable(cols) else (cols[0] if isinstance(cols, list) else cols))
        if cap0:
            self.face(list(reversed(rings[0])), cc)
        if cap1:
            cc1 = cap_col if cap_col is not None else (cols(len(rings) - 2, 0) if callable(cols) else (cols[-1] if isinstance(cols, list) else cols))
            self.face(list(rings[-1]), cc1)


def ring(c, ax, ay, rx, ry, n, rot=0.0, squash=None):
    """n points round centre c in the plane of axes ax, ay (unit, ⟂), radii rx, ry"""
    out = []
    for i in range(n):
        a = rot + 2 * math.pi * i / n
        x, y = math.cos(a) * rx, math.sin(a) * ry
        if squash is not None:
            y *= squash(a)
        out.append(c + ax * x + ay * y)
    return out


def perp_axes(d, hint):
    d = d.normalized()
    x = (hint - d * hint.dot(d))
    if x.length < 1e-6:
        x = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 0, 1))
        x = x - d * x.dot(d)
    x.normalize()
    y = d.cross(x).normalized()
    return x, y


# ─────────────────────────── the hands ───────────────────────────
# hand-local: the hand bone's frame (the wrist at the origin). u along the long axis (wrist → knuckles), v radial (the
# thumb side), w dorsal (the back of the hand).
HANDS = {
    # right: rig.ts RIGHT_HAND (JIAN-local): long (0.2248, 0.9272, -0.2997), back (0.8, 0, 0.6)
    'R': {'long': Vector((0.2248, 0.9272, -0.2997)).normalized(), 'back': Vector((0.8, 0.0, 0.6)).normalized(), 'side': 1},
    # left: rig.ts LEFT_HAND (GAUNTLET-local): +y elbow → hand, +z the back of the forearm
    'L': {'long': Vector((0, 1, 0)), 'back': Vector((0, 0, 1)), 'side': -1},
}
for h in HANDS.values():
    h['flex'] = h['back'].cross(h['long']).normalized()          # +θ about it curls a finger toward the palm (−back)
    h['radial'] = h['flex'] * h['side']                          # the thumb side

# the fingers: MCP knuckle (u, v, w), splay (deg, + radial), phalanx lengths, base / tip radius, the open flex (deg)
FINGERS = [
    ('index', (0.083, 0.026, 0.002), 7, (0.039, 0.024, 0.020), (0.0110, 0.0084)),
    ('middle', (0.088, 0.0078, 0.003), 1, (0.043, 0.027, 0.021), (0.0114, 0.0086)),
    ('ring', (0.084, -0.0100, 0.002), -5, (0.040, 0.025, 0.020), (0.0108, 0.0082)),
    ('pinky', (0.075, -0.0268, 0.0), -12, (0.032, 0.020, 0.018), (0.0097, 0.0073)),
]
OPEN_FLEX = (7, 9, 6)
# the thumb: CMC (u, v, w), then metacarpal / proximal / distal lengths; open direction (u, v, w) of the metacarpal
THUMB = {'cmc': (0.016, 0.019, -0.008), 'len': (0.039, 0.030, 0.026), 'rad': (0.0145, 0.0092), 'dir': (0.62, 0.70, -0.36), 'bend': (18, 12)}


def hframe(side):
    h = HANDS[side]
    return h['long'], h['radial'], h['back']


def H(side, u, v, w):
    L, R, B = hframe(side)
    return L * u + R * v + B * w


def rot_about(axis, deg):
    return Quaternion(axis.normalized(), math.radians(deg))


def finger_chain(side, spec, flex, splay_extra=0.0, thumb=False):
    """joint positions (hand-local) and each segment's direction for flex angles (deg, per joint)"""
    L, R, B = hframe(side)
    fx = HANDS[side]['flex']
    if thumb:
        c = H(side, *THUMB['cmc'])
        d = (L * THUMB['dir'][0] + R * THUMB['dir'][1] + B * THUMB['dir'][2]).normalized()
        pts, dirs = [c], []
        q = Quaternion()
        axis = d.cross(-B + R * 0.4).normalized()   # the thumb curls across the palm
        for k, ln in enumerate(THUMB['len']):
            dd = (q @ d)
            dirs.append(dd)
            pts.append(pts[-1] + dd * ln)
            if k < len(flex):
                q = rot_about(axis, flex[k]) @ q
        return pts, dirs
    name, base, splay, lens, _ = spec
    b = H(side, *base)
    d0 = rot_about(B, (splay + splay_extra) * HANDS[side]['side']) @ L
    pts, dirs = [b], []
    q = Quaternion()
    for k, ln in enumerate(lens):
        q = rot_about(fx, flex[k]) @ q
        dd = q @ d0
        dirs.append(dd)
        pts.append(pts[-1] + dd * ln)
    return pts, dirs


def build_hand(side, parts, rng):
    L, R, B = hframe(side)
    W = mat(f'{side}_hand')
    rot = W.to_quaternion()
    toRig = lambda p: W @ p
    # ── palm: rounded-rectangle sections from inside the wrist to the knuckle row, capped at both ends ──
    palm = Part(f'{side}.palm', {'type': 'hand', 'bone': f'{side}_hand'})
    secs = [(-0.012, 0.025, 0.017), (0.0, 0.030, 0.018), (0.028, 0.039, 0.0175), (0.058, 0.044, 0.016), (0.082, 0.043, 0.0135)]
    rings = []
    for u, hv, hw in secs:
        c = H(side, u, 0.0, -0.001)
        pts = []
        for i in range(10):
            a = 2 * math.pi * i / 10
            ca, sa = math.cos(a), math.sin(a)
            # a squircle: flat back and palm, rounded sides
            x = math.copysign(abs(ca) ** 0.6, ca) * hv
            y = math.copysign(abs(sa) ** 0.75, sa) * hw
            # the knuckle row: the section leans back on the pinky side (the MCP arc)
            du = -0.012 * max(0.0, -x / 0.04) if u > 0.07 else 0.0
            pts.append(toRig(c + R * x + B * y + L * du))
        rings.append(pts)

    def palm_col(band, i):
        a = 2 * math.pi * (i + 0.5) / 10
        return SKIN_LT if math.sin(a) < -0.35 else (SKIN_DK if band == 0 else SKIN)
    palm.loft(rings, palm_col, cap0=True, cap1=True, cap_col=SKIN)
    parts.append(palm)
    # ── thenar: the ball of the thumb, a squat ellipsoid on the palm's radial side ──
    th = Part(f'{side}.thenar', {'type': 'hand', 'bone': f'{side}_hand'})
    cen = H(side, 0.030, 0.024, -0.010)
    ax1 = (L * 0.8 + R * 0.6).normalized()
    ax2 = R.cross(ax1).normalized() if abs(R.dot(ax1)) < 0.99 else B
    ax2 = (B - ax1 * B.dot(ax1)).normalized()
    ax3 = ax1.cross(ax2).normalized()
    rs = []
    for k, t in enumerate([-1.0, -0.6, 0.0, 0.6, 1.0]):
        rr = math.sqrt(max(0.0, 1 - t * t)) if abs(t) < 1 else 0.0
        c = cen + ax1 * (t * 0.030)
        rs.append([toRig(p) for p in ring(c, ax2, ax3, max(rr, 0.02) * 0.013 if abs(t) < 1 else 0.001, max(rr, 0.02) * 0.017 if abs(t) < 1 else 0.001, 8)])
    th.loft(rs, SKIN, cap0=False, cap1=False)
    parts.append(th)
    # ── fingers: tapered hexagonal tubes through the knuckles, a rounded tip, a nail on the back of the last segment ──
    bones = []
    for spec in FINGERS:
        name, base, splay, lens, (r0, r1) = spec
        pts, dirs = finger_chain(side, spec, OPEN_FLEX)
        f = Part(f'{side}.{name}', {'type': 'chain', 'bones': [f'{side}_hand'] + [f'{side}_{name}{k}' for k in (1, 2, 3)]})
        stations = []   # (centre, dir, radius, colour)
        total = sum(lens)
        acc = 0.0
        stations.append((pts[0] - dirs[0] * 0.016, dirs[0], r0 * 1.02, SKIN))       # inside the palm
        for k in range(3):
            d = dirs[k]
            for fr, bulge in ((0.0, 1.10), (0.55, 0.95)):
                acc_t = (acc + lens[k] * fr) / total
                rr = (r0 + (r1 - r0) * acc_t) * bulge
                stations.append((pts[k] + d * (lens[k] * fr), d, rr, SKIN_DK if fr == 0.0 and k < 2 else SKIN))
            acc += lens[k]
        tip = pts[3]
        stations.append((tip - dirs[2] * 0.004, dirs[2], r1 * 0.75, SKIN))
        rings = []
        cols = []
        for c, d, rr, col in stations:
            ax, ay = perp_axes(d, B)                           # ax ~ the back of the finger
            rings.append([toRig(p) for p in ring(c, ax, ay, rr * 0.92, rr, 6, rot=math.pi / 6)])
            cols.append(col)
        f.loft(rings, lambda band, i: NAIL if band == len(rings) - 3 and i in (0, 5) else cols[band], cap0=False, cap1=True, cap_col=SKIN)
        parts.append(f)
        # bones: head at each joint (MCP, PIP, DIP), +y along the segment, +x the flex axis
        for k in range(3):
            bones.append({'name': f'{side}_{name}{k + 1}', 'parent': f'{side}_hand' if k == 0 else f'{side}_{name}{k}',
                          'head': list(toRig(pts[k])), 'y': list((rot @ dirs[k]).normalized()), 'x': list((rot @ HANDS[side]['flex']).normalized()),
                          'finger': name, 'joint': k})
    # ── the thumb ──
    pts, dirs = finger_chain(side, None, THUMB['bend'], thumb=True)
    f = Part(f'{side}.thumb', {'type': 'chain', 'bones': [f'{side}_hand'] + [f'{side}_thumb{k}' for k in (1, 2, 3)]})
    r0, r1 = THUMB['rad']
    stations = [(pts[0] - dirs[0] * 0.01, dirs[0], r0 * 0.9, SKIN)]
    total = sum(THUMB['len'])
    acc = 0.0
    for k in range(3):
        d = dirs[k]
        for fr, bulge in ((0.0, 1.06), (0.55, 0.96)):
            acc_t = (acc + THUMB['len'][k] * fr) / total
            rr = (r0 + (r1 - r0) * acc_t) * bulge
            stations.append((pts[k] + d * (THUMB['len'][k] * fr), d, rr, SKIN_DK if fr == 0.0 and k == 1 else SKIN))
        acc += THUMB['len'][k]
    stations.append((pts[3] - dirs[2] * 0.004, dirs[2], r1 * 0.75, SKIN))
    rings, cols = [], []
    for c, d, rr, col in stations:
        ax, ay = perp_axes(d, B)
        rings.append([toRig(p) for p in ring(c, ax, ay, rr * 0.9, rr, 6, rot=math.pi / 6)])
        cols.append(col)
    f.loft(rings, lambda band, i: NAIL if band == len(rings) - 3 and i in (0, 5) else cols[band], cap0=False, cap1=True, cap_col=SKIN)
    parts.append(f)
    thumb_axis = dirs[0].cross(-B + R * 0.4).normalized()
    for k in range(3):
        bones.append({'name': f'{side}_thumb{k + 1}', 'parent': f'{side}_hand' if k == 0 else f'{side}_thumb{k}',
                      'head': list(toRig(pts[k])), 'y': list((rot @ dirs[k]).normalized()), 'x': list((rot @ thumb_axis).normalized()),
                      'finger': 'thumb', 'joint': k})
    return bones


# ─────────────────────────── the finger poses (delta rotations in each bone's bind frame) ───────────────────────────
def chain_fk(side, bones, finger, deltas):
    """hand-local joint positions of one finger for per-joint local deltas (Quaternion in the bone frame)"""
    W = mat(f'{side}_hand')
    Winv = W.inverted()
    chain = [b for b in bones if b['finger'] == finger]
    frames = []
    for b in chain:
        y = Vector(b['y'])
        x = Vector(b['x'])
        x = (x - y * x.dot(y)).normalized()
        z = x.cross(y)
        m = Matrix((x, y, z)).transposed().to_4x4()
        m.translation = Vector(b['head'])
        frames.append(Winv @ m)          # bind, hand-local
    posed = []
    parent = Matrix.Identity(4)
    parent_bind = Matrix.Identity(4)
    for k, fb in enumerate(frames):
        local = parent_bind.inverted() @ fb
        p = parent @ local @ deltas[k].to_matrix().to_4x4()
        posed.append(p)
        parent, parent_bind = p, fb
    lens = [(Vector(chain[k + 1]['head']) - Vector(chain[k]['head'])).length for k in range(2)]
    last = [s for s in (FINGERS if finger != 'thumb' else []) if s[0] == finger]
    lens.append(last[0][3][2] if last else THUMB['len'][2])
    pts = [m.translation.copy() for m in posed]
    pts.append(posed[2] @ Vector((0, lens[2], 0)))
    return pts, posed


# the grip in R_hand-local: the jian's grip line (rig.ts GRIP / RIGHT_HAND.wrist): through (-0.0229, *, -0.0262), along +y
GRIP_C, GRIP_R = Vector((-0.0229, 0.0, -0.0262)), 0.0175


def grip_dist(p):
    d = p - GRIP_C
    return math.hypot(d.x, d.z)


def solve_grip(bones):
    """curl each right finger until a phalanx meets the grip or the palm; the thumb along the grip toward the guard"""
    out = {}
    L, R, B = hframe('R')
    for spec in FINGERS:
        name, _, _, lens, (r0, r1) = spec
        maxes = (88.0, 100.0, 62.0)
        best = 0.0
        for step in range(1, 101):
            s = step / 100
            ang = [maxes[k] * s for k in range(3)]
            deltas = [Quaternion(Vector((1, 0, 0)), math.radians(a - o)) for a, o in zip(ang, OPEN_FLEX)]
            pts, _ = chain_fk('R', bones, name, deltas)
            hit = False
            for k in range(3):
                for f in (0.35, 0.7, 1.0):
                    p = pts[k].lerp(pts[k + 1], f)
                    rf = r0 + (r1 - r0) * (k + f) / 3
                    if grip_dist(p) < GRIP_R + rf * 0.85 and p.y > -0.01:
                        hit = True
                    u, w = p.dot(L), p.dot(B)
                    if k >= 1 and u < 0.075 and w > -(0.0125 + rf * 0.8):
                        hit = True
            if hit:
                break
            best = s
        ang = [maxes[k] * best for k in range(3)]
        out[name] = [[a - o, 0.0] for a, o in zip(ang, OPEN_FLEX)]
        log(f'grip {name}: s={best:.2f} flex={[round(a) for a in ang]}')
    # thumb: aim the metacarpal across the grip's radial-dorsal side, the phalanges along the grip toward the guard
    return out


def aim_deltas(side, bones, finger, targets):
    """per joint: the delta (bone frame) that turns the bone's +y onto the target direction (hand-local), cascaded"""
    W = mat(f'{side}_hand')
    Winv = W.inverted()
    chain = [b for b in bones if b['finger'] == finger]
    deltas = []
    parent = Matrix.Identity(4)
    parent_bind = Matrix.Identity(4)
    for k, b in enumerate(chain):
        y = Vector(b['y'])
        x = Vector(b['x'])
        x = (x - y * x.dot(y)).normalized()
        z = x.cross(y)
        fb = Winv @ (lambda m: (m.__setattr__('translation', Vector(b['head'])), m)[1])(Matrix((x, y, z)).transposed().to_4x4())
        local = parent_bind.inverted() @ fb
        frame = parent @ local
        t_local = frame.to_quaternion().inverted() @ targets[k].normalized()
        dq = Vector((0, 1, 0)).rotation_difference(t_local)
        deltas.append(dq)
        parent, parent_bind = frame @ dq.to_matrix().to_4x4(), fb
    return deltas


def q_list(q):
    return [q.x, q.y, q.z, q.w]


def poses(side, bones):
    """the named poses: {pose: {bone: [x, y, z, w] delta}}"""
    L, R, B = hframe(side)
    res = {}

    def flexes(table, close=0.0):
        # close: the share of each finger's open splay taken back (about the bone's own z, the palm normal)
        d = {}
        for spec in FINGERS:
            name, splay = spec[0], spec[2]
            fl = table[name]
            for k in range(3):
                q = Quaternion(Vector((1, 0, 0)), math.radians(fl[k] - OPEN_FLEX[k]))
                if k == 0 and close:
                    q = Quaternion(Vector((0, 0, 1)), math.radians(splay * HANDS[side]['side'] * close)) @ q
                d[f'{side}_{name}{k + 1}'] = q_list(q)
        return d

    def thumb(targets):
        ds = aim_deltas(side, bones, 'thumb', targets)
        return {f'{side}_thumb{k + 1}': q_list(ds[k]) for k in range(3)}

    # relaxed (the off hand at rest, board 2 A): a soft half-open hand, more curl toward the pinky
    relaxed = flexes({'index': (14, 16, 8), 'middle': (18, 22, 10), 'ring': (24, 28, 12), 'pinky': (30, 32, 14)})
    relaxed.update(thumb([L * 0.55 + R * 0.72 - B * 0.35, L * 0.75 + R * 0.45 - B * 0.35, L * 0.8 + R * 0.25 - B * 0.45]))
    res['relaxed'] = relaxed
    # swim: fingers together, nearly straight, the thumb in along the index (a paddle)
    swim = flexes({'index': (8, 10, 6), 'middle': (8, 10, 6), 'ring': (9, 11, 6), 'pinky': (10, 12, 7)}, close=0.8)
    swim.update(thumb([L * 0.75 + R * 0.55 - B * 0.35, L * 0.92 + R * 0.25 - B * 0.2, L * 0.95 + R * 0.1 - B * 0.15]))
    res['swim'] = swim
    # tread: cupped, sculling
    tread = flexes({'index': (16, 20, 9), 'middle': (18, 22, 10), 'ring': (20, 24, 11), 'pinky': (24, 26, 11)}, close=0.6)
    tread.update(thumb([L * 0.65 + R * 0.62 - B * 0.35, L * 0.85 + R * 0.35 - B * 0.3, L * 0.9 + R * 0.15 - B * 0.35]))
    res['tread'] = tread
    if side == 'R':
        g = solve_grip(bones)
        grip = {}
        for spec in FINGERS:
            for k in range(3):
                grip[f'R_{spec[0]}{k + 1}'] = q_list(Quaternion(Vector((1, 0, 0)), math.radians(g[spec[0]][k][0])))
        # the thumb over the grip: the metacarpal toward the grip's radial-dorsal flank, then along the grip (+y) toward the guard
        A = Vector((0, 1, 0))
        flank = (R * 0.7 + B * 0.7).normalized()
        grip.update(thumb([(GRIP_C + A * 0.07 + flank * 0.03 - H('R', *THUMB['cmc'])).normalized(),
                           (A * 0.9 + flank * 0.2 - B * 0.25).normalized(), (A * 0.8 - B * 0.45 - R * 0.2).normalized()]))
        res['grip'] = grip
    return res


# ─────────────────────────── the forearm, the rolled linen sleeve, the upper arm ───────────────────────────
def build_arm(side, parts, rng):
    S = pos(f'{side}_upperarm')
    E = pos(f'{side}_forearm')
    Wm = mat(f'{side}_hand')
    Wp = Wm.to_translation()
    L, R, B = hframe(side)
    rot = Wm.to_quaternion()
    width_ax = (rot @ R).normalized()            # the wrist's width (radius–ulna), rig space
    fore = (Wp - E)
    Lf = fore.length
    fd = fore.normalized()
    ud = (E - S).normalized()
    Lu = (E - S).length
    rules = {'type': 'arm', 'side': side}
    # the bare forearm: an elliptic tube, wrist → just past the elbow (inside the sleeve)
    arm = Part(f'{side}.arm', rules)
    rings = []
    cols = []
    for t, rw, rt in [(1.03, 0.0215, 0.0155), (0.97, 0.0235, 0.0170), (0.86, 0.0265, 0.0190), (0.70, 0.0305, 0.0225), (0.55, 0.034, 0.026), (0.38, 0.036, 0.029), (0.28, 0.036, 0.030)]:
        c = E + fd * (Lf * t)
        ax, ay = perp_axes(fd, width_ax)
        rings.append(ring(c, ax, ay, rw, rt, 8, rot=math.pi / 8))
        cols.append(SKIN)
    arm.loft(rings, lambda band, i: SKIN_DK if (i in (2, 3) and band > 1) else SKIN, cap0=False, cap1=False)
    parts.append(arm)
    # the roll: the linen cuff turned up on itself at ~40 % of the forearm — a fat, lumpy band with fold lines
    roll = Part(f'{side}.roll', rules)
    rings, cols = [], []
    for t, r, col in [(0.665, 0.033, LINEN_SH), (0.65, 0.042, LINEN), (0.625, 0.047, LINEN), (0.60, 0.045, LINEN_DK), (0.58, 0.048, LINEN), (0.555, 0.047, LINEN),
                      (0.53, 0.044, LINEN_DK), (0.515, 0.039, LINEN_SH)]:
        c = E + fd * (Lf * t)
        ax, ay = perp_axes(fd, width_ax)
        wob = [1.0 + (rng.next() - 0.5) * 0.12 for _ in range(10)]
        pts = []
        for i in range(10):
            a = 2 * math.pi * i / 10 + 0.3
            pts.append(c + ax * (math.cos(a) * r * wob[i]) + ay * (math.sin(a) * r * 0.9 * wob[i]))
        rings.append(pts)
        cols.append(col)
    roll.loft(rings, lambda band, i: cols[band], cap0=False, cap1=False)
    parts.append(roll)
    # the sleeve: from under the roll, over the elbow (a baggy bend), up the upper arm to the shoulder (off frame)
    sl = Part(f'{side}.sleeve', rules)
    path = []
    for t in (0.56, 0.42, 0.28, 0.14, 0.04):
        path.append((E + fd * (Lf * t), fd, 0.045 + 0.012 * (0.56 - t)))
    bis = (fd - ud).normalized()
    path.append((E - bis * 0.0 + (fd * 0.0), (fd + ud).normalized(), 0.055))
    for t in (0.12, 0.35, 0.65, 0.95):
        path.append((E - ud * (Lu * t), ud, 0.055 + 0.004 * t))
    rings = []
    for k, (c, d, r) in enumerate(path):
        ax, ay = perp_axes(d, width_ax)
        wob = [1.0 + (rng.next() - 0.5) * 0.16 for _ in range(10)]
        pts = [c + ax * (math.cos(2 * math.pi * i / 10) * r * wob[i]) + ay * (math.sin(2 * math.pi * i / 10) * r * wob[i]) for i in range(10)]
        rings.append(pts)
    # patches: a tan square on the forearm part, a grey-green one on the upper arm, a darned hole by the elbow
    patch = {(1, 3): PATCH_A, (1, 4): PATCH_A, (2, 3): PATCH_A, (2, 4): PATCH_A, (6, 7): PATCH_B, (6, 8): PATCH_B, (7, 7): PATCH_B, (7, 8): PATCH_B, (3, 0): HOLE}
    if side == 'L':
        patch = {(2, 6): PATCH_A, (2, 7): PATCH_A, (3, 6): PATCH_A, (3, 7): PATCH_A, (6, 2): PATCH_B, (7, 2): PATCH_B, (5, 9): HOLE}
    shade = lambda band, i: patch.get((band, i), LINEN_DK if (band + i) % 4 == 0 else LINEN)
    sl.loft(rings, shade, cap0=False, cap1=False)
    parts.append(sl)


# ─────────────────────────── the swords (weapon-local: origin at the guard, +y the blade, +x the edges, +z the flat) ───────────────────────────
def hex_section(y, w, t, flat=0.5):
    return [Vector((w, y, 0)), Vector((w * flat, y, t)), Vector((-w * flat, y, t)), Vector((-w, y, 0)), Vector((-w * flat, y, -t)), Vector((w * flat, y, -t))]


def diamond_section(y, w, t, bevel=0.7):
    return [Vector((w, y, 0)), Vector((w * bevel, y, t * 0.55)), Vector((0, y, t)), Vector((-w * bevel, y, t * 0.55)), Vector((-w, y, 0)),
            Vector((-w * bevel, y, -t * 0.55)), Vector((0, y, -t)), Vector((w * bevel, y, -t * 0.55))]


def yring(y, r, n, rot=0.0, x=0.0, z=0.0):
    return [Vector((x + math.cos(rot + 2 * math.pi * i / n) * r, y, z + math.sin(rot + 2 * math.pi * i / n) * r)) for i in range(n)]


def cord_grip(p, y0, y1, rng):
    """the hemp-cord wrap: a core, then diagonal turns as lumpy tilted rings; a knot at the pommel and a hanging tail"""
    core = [yring(y0, 0.0150, 8, 0.2), yring(y1, 0.0158, 8, 0.2)]
    p.loft(core, CORD_DK, cap0=True, cap1=False)
    n = 9
    for k in range(n):
        yc = y0 + (y1 - y0) * (k + 0.5) / n
        tilt = 0.006 if k % 2 == 0 else -0.006
        rings = []
        for dy, r in ((-0.0075, 0.0152), (-0.004, 0.0188), (0.004, 0.0188), (0.0075, 0.0152)):
            pts = []
            for i in range(8):
                a = 0.2 + 2 * math.pi * i / 8
                pts.append(Vector((math.cos(a) * r, yc + dy + math.cos(a) * tilt, math.sin(a) * r)))
            rings.append(pts)
        p.loft(rings, lambda band, i: CORD_DK if band != 1 else (CORD if (i + k) % 3 else lin(0xd4b47a)), cap0=False, cap1=False)
    # the knot under the pommel and the tail (two strands, frayed ends)
    kn = [yring(y0 - 0.004, 0.012, 7, 0.1), yring(y0 - 0.010, 0.021, 7, 0.5), yring(y0 - 0.019, 0.020, 7, 0.9), yring(y0 - 0.026, 0.010, 7, 1.3)]
    p.loft(kn, lambda band, i: CORD if (band + i) % 2 else CORD_DK, cap0=False, cap1=True)
    for s, (sx, sz, ln) in enumerate(((0.006, 0.004, 0.075), (-0.005, -0.003, 0.060))):
        pts = []
        for k in range(6):
            f = k / 5
            y = y0 - 0.024 - ln * f
            x = sx + 0.012 * f * f * (1 if s == 0 else -0.6)
            z = sz + 0.018 * f * f
            r = 0.0048 * (1 - 0.35 * f) if k < 5 else 0.0065
            pts.append(yring(y, r, 5, 0.3 * k, x, z))
        p.loft(pts, lambda band, i: CORD if band % 2 == 0 else CORD_DK, cap0=False, cap1=True)


def build_sword(kind, rng):
    p = Part(f'sword.{kind}', {'type': 'rigid', 'bone': 'R_weapon'}, subdiv=0, metal=0.0)
    iron = kind == 'iron'
    Lb = 0.56 if iron else 0.52
    y0 = 0.012
    tip = y0 + Lb
    if iron:
        bw = lambda y: 0.026 - 0.006 * y / Lb
        bt = lambda y: 0.0062 - 0.002 * y / Lb
        rings = [diamond_section(y0 + Lb * f, bw(Lb * f), bt(Lb * f)) for f in (0, 0.3, 0.6, 0.82)]
        rings += [diamond_section(y0 + Lb * 0.91, bw(Lb) * 0.8, bt(Lb) * 0.85), diamond_section(y0 + Lb * 0.97, bw(Lb) * 0.42, bt(Lb) * 0.6),
                  diamond_section(tip, 0.0005, 0.0003)]
        p.loft(rings, lambda band, i: STEEL_EDGE if i in (0, 4) else (STEEL if i % 2 else lin(0x9ea4ad)), cap0=True, cap1=False)
        p.faces = [(v, c, 0.65) for v, c, _ in p.faces]
    else:
        bw = lambda y: 0.040 - 0.009 * y / Lb
        bt = lambda y: 0.011 - 0.0035 * y / Lb
        rings = [hex_section(y0 + Lb * f, bw(Lb * f), bt(Lb * f)) for f in (0, 0.25, 0.5, 0.72, 0.86)]
        rings += [hex_section(y0 + Lb * 0.93, bw(Lb) * 0.86, bt(Lb) * 0.9), hex_section(y0 + Lb * 0.975, bw(Lb) * 0.55, bt(Lb) * 0.65),
                  hex_section(y0 + Lb * 0.995, bw(Lb) * 0.22, bt(Lb) * 0.35), hex_section(tip, 0.0005, 0.0003)]
        p.loft(rings, lambda band, i: WOOD_EDGE if i in (0, 3) else (WOOD if (band + i) % 3 else lin(0xd3b080)), cap0=True, cap1=False)
    # the guard: a bar, thicker at the middle, ends knocked off (iron: dark, the ends drooping a little)
    gw, gh, gd = (0.17, 0.022, 0.030) if iron else (0.17, 0.026, 0.036)
    col = IRON if iron else WOOD_DK
    xs = [-gw / 2, -gw / 2 + 0.012, -0.02, 0.02, gw / 2 - 0.012, gw / 2]
    rings = []
    for x in xs:
        edge = abs(x) > gw / 2 - 0.001
        droop = (-0.006 * (abs(x) / (gw / 2)) ** 2) if iron else 0.0
        hh = gh * (0.35 if edge else (0.55 if abs(x) > 0.03 else 0.5))
        dd = gd * (0.35 if edge else 0.5)
        yc = droop
        rings.append([Vector((x, yc - hh, -dd)), Vector((x, yc - hh, dd)), Vector((x, yc + hh, dd)), Vector((x, yc + hh, -dd))])
    gp = Part('tmp', {})
    gp.loft(rings, col, cap0=True, cap1=True)
    for v, c, _ in gp.faces:
        p.face(v, c, 0.55 if iron else 0.0)
    # cord lashing over the guard's middle (an X of cord) on the wooden sword; a steel collar on the iron one
    if not iron:
        for k, tilt in enumerate((0.55, -0.55)):
            rr = []
            for dx, r in ((-0.005, 0.021), (0.0, 0.0245), (0.005, 0.021)):
                pts = []
                for i in range(8):
                    a = 2 * math.pi * i / 8
                    y = math.cos(a) * r * 0.75
                    z = math.sin(a) * r
                    x = dx + y * tilt
                    pts.append(Vector((x, y, z)))
                rr.append(pts)
            lash = Part('tmp', {})
            lash.loft(rr, lambda band, i: CORD if band == 1 else CORD_DK)
            for v, c, _ in lash.faces:
                p.face(v, c, 0.0)
    else:
        col2 = Part('tmp', {})
        col2.loft([yring(-0.024, 0.0165, 8, 0.2), yring(-0.012, 0.0185, 8, 0.2), yring(-0.010, 0.0172, 8, 0.2)], IRON, cap0=False, cap1=True)
        for v, c, _ in col2.faces:
            p.face(v, c, 0.55)
    # the grip: cord from under the guard to the pommel (the hand closes round its middle); a small pommel knob
    gy0, gy1 = -0.150, -0.012
    cg = Part('tmp', {})
    cord_grip(cg, gy0, gy1, rng)
    for v, c, _ in cg.faces:
        p.face(v, c, 0.0)
    pom = Part('tmp', {})
    pc = IRON if iron else WOOD_DK
    pom.loft([yring(gy0 + 0.002, 0.012, 6, 0.3), yring(gy0 - 0.004, 0.0175, 6, 0.3), yring(gy0 - 0.011, 0.0165, 6, 0.3)], pc, cap0=False, cap1=False)
    for v, c, _ in pom.faces:
        p.face(v, c, 0.55 if iron else 0.0)
    return p, {'bladeBase': y0, 'bladeTip': tip}


# ─────────────────────────── Blender: faces → object → subdivide → triangles ───────────────────────────
def to_object(part):
    bm = bmesh.new()
    col_layer = bm.loops.layers.float_color.new('col')
    metal_layer = bm.loops.layers.float_color.new('metal')
    vmap = {}

    def vert(v):
        k = (round(v.x, 6), round(v.y, 6), round(v.z, 6))
        if k not in vmap:
            vmap[k] = bm.verts.new(v)
        return vmap[k]
    for verts, col, metal in part.faces:
        vs = [vert(v) for v in verts]
        if len(set(vs)) < 3:
            continue
        # drop repeated consecutive verts (collapsed tips)
        clean = []
        for v in vs:
            if not clean or clean[-1] is not v:
                clean.append(v)
        if len(clean) > 1 and clean[0] is clean[-1]:
            clean.pop()
        if len(clean) < 3:
            continue
        try:
            f = bm.faces.new(clean)
        except ValueError:
            continue
        for lp in f.loops:
            lp[col_layer] = (col[0], col[1], col[2], 1.0)
            lp[metal_layer] = (metal, 0, 0, 1)
    me = bpy.data.meshes.new(part.name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(part.name, me)
    bpy.context.scene.collection.objects.link(ob)
    if part.subdiv > 0:
        m = ob.modifiers.new('sub', 'SUBSURF')
        m.levels = part.subdiv
        m.render_levels = part.subdiv
        m.boundary_smooth = 'PRESERVE_CORNERS'
    ob.modifiers.new('tri', 'TRIANGULATE')
    return ob


def triangles(ob, jitter, seed):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    col = me.color_attributes.get('col')
    metal = me.color_attributes.get('metal')
    rng = Rng(seed)
    P, C, M = [], [], []
    for tri in me.loop_triangles:
        cs = [col.data[li].color for li in tri.loops]
        c = [sum(x[i] for x in cs) / 3 for i in range(3)]
        m = sum(metal.data[li].color[0] for li in tri.loops) / 3
        j = 1 + (rng.next() - 0.5) * 2 * jitter
        for vi in tri.vertices:
            v = me.vertices[vi].co
            P += [v.x, v.y, v.z]
            C += [c[0] * j, c[1] * j, c[2] * j]
            M.append(round(m, 3))
    ev.to_mesh_clear()
    return P, C, M


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = Rng(334)
    parts = []
    hands = {}
    for side in ('R', 'L'):
        bones = build_hand(side, parts, rng)
        build_arm(side, parts, rng)
        hands[side] = {'bones': bones, 'poses': poses(side, bones)}
    swords = {}
    for kind in ('wood', 'iron'):
        p, attach = build_sword(kind, rng)
        parts.append(p)
        swords[kind] = attach
    out_parts = []
    seed = 1
    tri_total = {}
    for p in parts:
        ob = to_object(p)
        P, C, M = triangles(ob, 0.05 if p.rule['type'] != 'rigid' else 0.04, seed)
        seed += 1
        out = {'name': p.name, 'rule': p.rule, 'pos': [round(x, 6) for x in P], 'col': [round(x, 5) for x in C]}
        if any(M):
            out['metal'] = M
        out_parts.append(out)
        tri_total[p.name] = len(P) // 9
    log('triangles:', json.dumps(tri_total))
    log('arms total:', sum(v for k, v in tri_total.items() if not k.startswith('sword')), 'wood', tri_total['sword.wood'], 'iron', tri_total['sword.iron'])
    json.dump({'weaponT': list(WEAPON_T), 'grip': {'c': list(GRIP_C), 'r': GRIP_R}, 'swords': swords, 'hands': hands, 'parts': out_parts},
              open(os.path.join(OUT, 'parts.json'), 'w'))
    log('wrote', os.path.join(OUT, 'parts.json'))
    # step 3 + the gate (Node): skin, finger bones, swim clips → fp-arms.raw.glb (build.sh meshopts it into public/), then
    # the rig gate on it → gate.json (a failed check fails the build)
    here = os.path.dirname(os.path.abspath(__file__))
    raw = os.path.join(OUT, 'fp-arms.raw.glb')
    subprocess.run(['node', os.path.join(here, 'bake.mjs'), os.path.join(OUT, 'parts.json'), raw, '--raw'], check=True)
    subprocess.run(['node', os.path.join(here, 'gate.mjs'), raw, '--json=' + os.path.join(OUT, 'gate.json')], check=True)
    if PREVIEW:
        shots = 'rest@0,idle@0,light@0.13,heavy@0.2,idle@0@iron,swimStroke@0,swimStroke@0.3,swimStroke@0.55,swimTread@0'
        subprocess.run(['node', os.path.join(here, 'gate.mjs'), raw, '--ply=' + os.path.join(OUT, 'ply'), '--poses=' + shots], check=True)


main()
