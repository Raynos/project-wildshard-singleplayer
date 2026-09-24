"""
Procedural low-poly prototypes for the Blender island (DRIFTWOOD-REMASTER X2, E52).

Every generator returns a `Part`: triangle lists in Blender space (Z up, origin at the base, +Y = the game's -z) with a
linear RGB colour per vertex. Faceted by construction: the game draws them with flat shading, so a vertex may be shared
between faces and the facets still read. Colours are the mockup palette (art/driftwood-isle/round-4-remaster/
sheet-mockup-3x3.jpg), given as sRGB hex and stored linear.

Nothing here touches bpy: build_island.py turns Parts into meshes, bakes their AO and exports them.
"""
import math
import random
from mathutils import Vector, Matrix, noise


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def scale_col(c, k):
    return (c[0] * k, c[1] * k, c[2] * k)


def mix_col(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


P = {k: srgb(v) for k, v in {
    'trunk': '#b08a62', 'ring': '#8c6b4a', 'trunkTop': '#c29f74',
    'frond': '#4aa336', 'frondLight': '#7cc94a', 'frondDark': '#2e7a2a', 'frondYoung': '#9fd65a',
    'nut': '#6b4f2a', 'nutGreen': '#8aa83a',
    'grass': '#63b843', 'grassLight': '#8fd35a', 'grassDark': '#468f31',
    'beachGrass': '#b8c46a', 'beachGrassDry': '#d3c888', 'beachGrassGreen': '#8fb04e',
    'fern': '#3c8c32', 'fernLight': '#5eaa40',
    'bush': '#3f8f36', 'bushLight': '#62b146', 'bushDark': '#2c7329',
    'hibiscus': '#e3342b', 'hibiscusDark': '#b8201e', 'stamen': '#f7d34a',
    'yellow': '#f6d03a', 'white': '#f7f3e6', 'stem': '#4d8c33',
    'shell': '#f6e6d2', 'shellPink': '#f0b4a2', 'shellInner': '#e7c3a8',
    'star': '#ea6a3a', 'starRed': '#d9432e',
    'pebble': '#9b9b98', 'pebbleLight': '#bdb6aa', 'pebbleDark': '#7a7e83',
    'drift': '#d2c2a6', 'driftGrey': '#b9ad98', 'driftDark': '#8f7f68',
    'rock': '#8e949b', 'rockLight': '#b2b7bd', 'rockDark': '#6a7078', 'moss': '#6fb048', 'mossDark': '#4f9437',
}.items()}


class Part:
    """triangle soup with shared vertices: verts [Vector], cols [(r,g,b)], tris [(i,j,k)]"""

    def __init__(self):
        self.verts, self.cols, self.tris = [], [], []

    def v(self, p, c):
        self.verts.append(Vector(p))
        self.cols.append(tuple(c))
        return len(self.verts) - 1

    def tri(self, a, b, c, col):
        """a free-standing triangle in one colour"""
        i = self.v(a, col); j = self.v(b, col); k = self.v(c, col)
        self.tris.append((i, j, k))

    def quad(self, a, b, c, d, col):
        self.tri(a, b, c, col); self.tri(a, c, d, col)

    def add(self, other, m=None):
        m = m or Matrix.Identity(4)
        o = len(self.verts)
        for p, c in zip(other.verts, other.cols):
            self.verts.append(m @ p)
            self.cols.append(c)
        self.tris.extend((a + o, b + o, c + o) for a, b, c in other.tris)
        return self

    def jitter(self, rng, amount):
        """per-triangle lightness jitter (duplicates shared vertices so each facet keeps one tone)"""
        verts, cols, tris = self.verts, self.cols, self.tris
        self.verts, self.cols, self.tris = [], [], []
        for a, b, c in tris:
            k = 1 - amount + rng.random() * amount * 2
            self.tri(verts[a], verts[b], verts[c], scale_col(cols[a], k))
        return self

    def bounds(self):
        xs = [p.x for p in self.verts]; ys = [p.y for p in self.verts]; zs = [p.z for p in self.verts]
        return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


# ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────

def tube(part, pts, radii, sides, cols, twist=0.0, cap=True):
    """a faceted tube through `pts` (Vectors) with a radius and colour per ring"""
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.95 else Vector((1, 0, 0))
        a = t.cross(up).normalized(); b = t.cross(a).normalized()
        ring = []
        for k in range(sides):
            ang = k / sides * math.tau + twist * i
            ring.append(p + (a * math.cos(ang) + b * math.sin(ang)) * radii[i])
        rings.append(ring)
    for i in range(len(rings) - 1):
        r0, r1, c = rings[i], rings[i + 1], cols[i]
        for k in range(sides):
            part.quad(r0[k], r0[(k + 1) % sides], r1[(k + 1) % sides], r1[k], c)
    if cap:
        top = rings[-1]; c = cols[-1]
        for k in range(1, sides - 1):
            part.tri(top[0], top[k], top[k + 1], c)
    return rings


def ico(part, centre, r, col, rng, squash=1.0, wob=0.12, subdiv=0):
    """a faceted icosahedron blob"""
    t = (1 + 5 ** 0.5) / 2
    vs = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    fs = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
          (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    vs = [Vector(v).normalized() for v in vs]
    for _ in range(subdiv):
        cache, nf = {}, []
        def mid(a, b):
            key = (min(a, b), max(a, b))
            if key not in cache:
                vs.append(((vs[a] + vs[b]) / 2).normalized()); cache[key] = len(vs) - 1
            return cache[key]
        for a, b, c in fs:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        fs = nf
    pts = [Vector((v.x * r * (1 + rng.uniform(-wob, wob)), v.y * r * (1 + rng.uniform(-wob, wob)), v.z * r * squash * (1 + rng.uniform(-wob, wob)))) + Vector(centre) for v in vs]
    base = len(part.verts)
    for p in pts:
        part.v(p, col)
    for a, b, c in fs:
        part.tris.append((a + base, b + base, c + base))
    return part


# ── rocks: an icosphere displaced by noise, then cut by random planes → crisp faceted chunks ──

def rock(rng, size=1.0, squash=0.7, cuts=6, moss=0.0, tone=None):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    off = Vector((rng.uniform(-50, 50), rng.uniform(-50, 50), rng.uniform(-50, 50)))
    for v in bm.verts:
        n = noise.fractal(v.co * 1.3 + off, 1.0, 2.0, 3) * 0.28
        v.co = v.co * (1 + n)
        v.co.z *= squash
    for _ in range(cuts):
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.6, 1))).normalized()
        dist = rng.uniform(0.55, 0.85) * (squash if d.z > 0.5 else 1)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=d * dist, plane_no=d, clear_outer=True)
        edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.normal_update()
    zmin = min(v.co.z for v in bm.verts)
    part = Part()
    base = tone or P['rock']
    for f in bm.faces:
        nz = f.normal.z
        c = mix_col(base, P['rockLight'], max(0, nz) * 0.35)
        if nz < -0.2:
            c = mix_col(c, P['rockDark'], 0.5)
        if moss > 0 and nz > 0.72 and f.calc_center_median().z > zmin + 0.5 * (1 - zmin):
            c = mix_col(P['moss'], P['mossDark'], rng.random() * 0.5)
        c = scale_col(c, 0.9 + rng.random() * 0.2)
        vs = [part.v((v.co.x * size, v.co.y * size, (v.co.z - zmin) * size - 0.25 * size * squash), c) for v in f.verts]
        part.tris.append(tuple(vs))
    bm.free()
    return part


# ── palms: a curved ringed trunk, a crown of feathery drooping fronds, a coconut cluster ──

def palm(rng, h=7.0, lean=0.2, fronds=12, young=7, lod=0):
    """lod 1: the far palm — the same crown with 4 segments per frond, a 5-sided 6-segment trunk, no coconuts"""
    part = Part()
    segs, sides = (12, 7) if lod == 0 else (6, 5)
    pts, radii, cols = [], [], []
    for s in range(segs + 1):
        t = s / segs
        off = lean * h * (t * t - 0.12 * math.sin(t * math.pi))
        pts.append(Vector((off, 0, h * t)))
        r = 0.26 * (1 - t * 0.4) * (1.12 if s % 2 == 0 else 0.95) * (1.35 if s == 0 else 1)
        radii.append(r)
        cols.append(scale_col(P['ring'] if s % 2 else P['trunk'], 0.92 + rng.random() * 0.16))
    cols[-1] = P['trunkTop']
    tube(part, pts, radii, sides, cols, twist=0.2)
    top = pts[-1] + Vector((0, 0, 0.1))
    # the crown's bulb
    ico(part, top + Vector((0, 0, -0.05)), 0.34, P['trunkTop'], rng, squash=0.9)
    # coconuts
    for k in range(rng.randint(4, 7) if lod == 0 else 0):
        a = k / 6 * math.tau + rng.uniform(-0.3, 0.3)
        ico(part, top + Vector((math.cos(a) * 0.33, math.sin(a) * 0.33, -0.3 - (k % 2) * 0.16)), rng.uniform(0.15, 0.2), P['nutGreen'] if k % 3 == 0 else P['nut'], rng, wob=0.05)
    # fronds: a midrib arcing out and down; leaflet pairs folded into a shallow V along it
    for f in range(fronds + (young if lod == 0 else 0)):
        yng = f >= fronds
        n = young if yng else fronds
        fi = (f - fronds + 0.5) if yng else f
        ang = fi / n * math.tau + rng.uniform(-0.18, 0.18)
        L = rng.uniform(2.0, 2.8) if yng else rng.uniform(3.3, 4.6)
        rise = rng.uniform(0.6, 1.0) if yng else rng.uniform(0.3, 0.7)
        droop = rng.uniform(0.6, 1.0) if yng else rng.uniform(1.4, 2.4)
        d = Vector((math.cos(ang), math.sin(ang), 0)); side = Vector((-math.sin(ang), math.cos(ang), 0))
        shade = rng.random()
        base = P['frondYoung'] if yng and shade < 0.5 else P['frondDark'] if shade < 0.28 else P['frondLight'] if shade > 0.72 else P['frond']
        spine = lambda t: top + d * (L * t) + Vector((0, 0, rise * math.sin(t * math.pi * 0.6) - droop * t * t))
        nseg = 7 if lod == 0 else 3
        rib = [spine(s / nseg) for s in range(nseg + 1)]
        # a broad frond: a solid V-folded blade either side of the rib, its edge cut into leaflets (serrated), so the
        # crown reads as full fans of leaf, not a spray of needles
        wmax = 0.55 if yng else 0.85
        edges = {1: [rib[0]], -1: [rib[0]]}
        for s in range(1, nseg + 1):
            t = s / nseg
            w = wmax * math.sin(min(1.0, t * 1.08) * math.pi) ** 0.8 + 0.05
            for sgn in (1, -1):
                serr = 1.0 if s % 2 else 0.72
                edges[sgn].append(rib[s] + side * (w * serr * sgn) + Vector((0, 0, -0.22 * w)) - d * (0.18 * w if s % 2 else 0))
        for s in range(1, nseg + 1):
            t = s / nseg
            c = scale_col(base, 0.86 + t * 0.26)
            for sgn in (1, -1):
                e0, e1 = edges[sgn][s - 1], edges[sgn][s]
                cc = c if sgn > 0 else scale_col(c, 0.9)
                part.tri(rib[s - 1], rib[s], e1, cc)
                part.tri(rib[s - 1], e1, e0, scale_col(cc, 0.95))
    return part.jitter(rng, 0.05)


# ── ground cover ──

def blade(part, base, h, w, yaw, bend, col, tip_col=None):
    d = Vector((math.cos(yaw), math.sin(yaw), 0)); s = Vector((-math.sin(yaw), math.cos(yaw), 0))
    mid = base + Vector((0, 0, h * 0.55)) + d * (bend * 0.35)
    tip = base + Vector((0, 0, h)) + d * bend
    part.quad(base - s * w, base + s * w, mid + s * w * 0.6, mid - s * w * 0.6, col)
    part.tri(mid - s * w * 0.6, mid + s * w * 0.6, tip, tip_col or col)


def grass_tuft(rng, h=0.45, n=9, cols=('grass', 'grassLight', 'grassDark')):
    part = Part()
    for i in range(n):
        a = rng.uniform(0, math.tau); r = rng.uniform(0, 0.12)
        base = Vector((math.cos(a) * r, math.sin(a) * r, -0.02))
        c = P[cols[i % len(cols)]]
        blade(part, base, h * rng.uniform(0.6, 1.1), 0.03, a + rng.uniform(-0.4, 0.4), h * rng.uniform(0.15, 0.45), c, scale_col(c, 1.15))
    return part.jitter(rng, 0.06)


def beach_grass(rng):
    return grass_tuft(rng, h=0.75, n=14, cols=('beachGrass', 'beachGrassDry', 'beachGrassGreen', 'beachGrass'))


def fern(rng, size=0.8, fronds=7, col='fern', seg=5):
    part = Part()
    for f in range(fronds):
        a = f / fronds * math.tau + rng.uniform(-0.2, 0.2)
        d = Vector((math.cos(a), math.sin(a), 0)); s = Vector((-math.sin(a), math.cos(a), 0))
        L = size * rng.uniform(0.75, 1.1); up = rng.uniform(0.35, 0.6)
        spine = lambda t: d * (L * t) + Vector((0, 0, size * up * math.sin(t * math.pi * 0.75) - 0.1 * t))
        c = P[col] if f % 2 else P['fernLight']
        for k in range(seg):
            t0, t1 = k / seg, (k + 1) / seg
            p0, p1 = spine(t0), spine(t1)
            w = size * 0.2 * math.sin((t0 + 0.12) * math.pi)
            part.tri(p0, p1, p0 + s * w + d * 0.05, c)
            part.tri(p0, p0 - s * w + d * 0.05, p1, scale_col(c, 0.92))
    return part.jitter(rng, 0.07)


def bush(rng, r=0.8, flowers=0, flower_col='hibiscus'):
    part = Part()
    lumps = rng.randint(4, 6)
    tops = []
    for i in range(lumps):
        a = rng.uniform(0, math.tau); d = rng.uniform(0, r * 0.45)
        rr = r * rng.uniform(0.55, 0.8)
        c = Vector((math.cos(a) * d, math.sin(a) * d, rr * 0.55 + rng.uniform(0, r * 0.2)))
        col = [P['bush'], P['bushLight'], P['bushDark']][i % 3]
        ico(part, c, rr, col, rng, squash=0.8, wob=0.22, subdiv=0)
        tops.append((c, rr))
    for k in range(flowers):
        c, rr = tops[k % len(tops)]
        th = rng.uniform(0, math.tau); ph = rng.uniform(0.2, 1.1)
        p = c + Vector((math.cos(th) * math.cos(ph), math.sin(th) * math.cos(ph), math.sin(ph) * 0.8)) * rr * 1.02
        flower(part, p, rng.uniform(0.09, 0.13), P[flower_col], rng)
    return part.jitter(rng, 0.06)


def flower(part, p, r, col, rng, petals=5):
    n = (p - Vector((0, 0, p.z * 0.3))).normalized() if p.length > 1e-3 else Vector((0, 0, 1))
    up = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))
    a = n.cross(up).normalized(); b = n.cross(a).normalized()
    centre = p + n * 0.02
    for k in range(petals):
        t0 = k / petals * math.tau + rng.uniform(0, 0.3); t1 = t0 + math.tau / petals * 0.9
        q0 = centre + (a * math.cos(t0) + b * math.sin(t0)) * r
        q1 = centre + (a * math.cos(t1) + b * math.sin(t1)) * r
        part.tri(centre, q0, q1, col if k % 2 else scale_col(col, 0.85))
    part.tri(centre + n * 0.02 + a * 0.02, centre + n * 0.02 - a * 0.02, centre + n * 0.03 + b * 0.025, P['stamen'])


def hibiscus_clump(rng):
    part = fern(rng, 0.55, 5, 'fern', seg=4)
    part.add(bush(rng, 0.42, flowers=5))
    return part


def flower_clump(rng, col='yellow'):
    part = Part()
    for i in range(7):
        a = rng.uniform(0, math.tau); d = rng.uniform(0.03, 0.22); h = rng.uniform(0.15, 0.32)
        base = Vector((math.cos(a) * d, math.sin(a) * d, 0))
        top = base + Vector((rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04), h))
        part.tri(base, base + Vector((0.015, 0, 0)), top, P['stem'])
        c = P[col] if i % 3 else P['white'] if col == 'yellow' else P['yellow']
        for k in range(5):
            t0 = k / 5 * math.tau; t1 = t0 + 0.9
            part.tri(top, top + Vector((math.cos(t0) * 0.06, math.sin(t0) * 0.06, 0.01)), top + Vector((math.cos(t1) * 0.06, math.sin(t1) * 0.06, 0.01)), c)
    part.add(grass_tuft(rng, 0.25, 6))
    return part.jitter(rng, 0.05)


def shell(rng):
    part = Part()
    col = P['shell'] if rng.random() < 0.6 else P['shellPink']
    ribs = 6; r = rng.uniform(0.12, 0.17)
    hinge = Vector((0, -r * 0.5, 0.01))
    for k in range(ribs):
        t0 = -1.1 + k / ribs * 2.2; t1 = t0 + 2.2 / ribs
        q0 = Vector((math.sin(t0) * r, math.cos(t0) * r - r * 0.4, 0.035 + 0.01 * (k % 2)))
        q1 = Vector((math.sin(t1) * r, math.cos(t1) * r - r * 0.4, 0.035 + 0.01 * ((k + 1) % 2)))
        part.tri(hinge, q0, q1, col if k % 2 else scale_col(col, 0.88))
        part.tri(q0, Vector((q0.x * 1.05, q0.y * 1.05, 0)), q1, P['shellInner'])
    return part


def starfish(rng):
    part = Part()
    col = P['star'] if rng.random() < 0.6 else P['starRed']
    r_out, r_in, h = rng.uniform(0.17, 0.24), 0.07, 0.045
    c = Vector((0, 0, h))
    for k in range(10):
        a0 = k / 10 * math.tau; a1 = (k + 1) / 10 * math.tau
        r0 = r_out if k % 2 == 0 else r_in; r1 = r_out if (k + 1) % 2 == 0 else r_in
        p0 = Vector((math.cos(a0) * r0, math.sin(a0) * r0, 0.005)); p1 = Vector((math.cos(a1) * r1, math.sin(a1) * r1, 0.005))
        part.tri(c, p0, p1, col if k % 2 else scale_col(col, 0.85))
    return part


def pebbles(rng):
    part = Part()
    for i in range(rng.randint(1, 3)):
        r = rng.uniform(0.07, 0.16); a = rng.uniform(0, math.tau); d = 0 if i == 0 else rng.uniform(0.12, 0.25)
        col = [P['pebble'], P['pebbleLight'], P['pebbleDark']][rng.randint(0, 2)]
        ico(part, (math.cos(a) * d, math.sin(a) * d, r * 0.25), r, col, rng, squash=0.55, wob=0.2)
    return part.jitter(rng, 0.08)


def driftwood(rng, length=3.0):
    part = Part()
    r = rng.uniform(0.13, 0.22)
    n = 5
    pts = [Vector((-length / 2 + length * i / (n - 1), rng.uniform(-0.12, 0.12), r * 0.75 + math.sin(i / (n - 1) * math.pi) * 0.06)) for i in range(n)]
    radii = [r * (1.1 - 0.35 * i / (n - 1)) for i in range(n)]
    cols = [scale_col([P['drift'], P['driftGrey']][i % 2], 0.92 + rng.random() * 0.14) for i in range(n)]
    tube(part, pts, radii, 6, cols, twist=0.4)
    # a root flare at the thick end and a snapped branch
    ico(part, pts[0] + Vector((-0.1, 0, 0)), r * 1.5, P['driftDark'], rng, squash=0.7, wob=0.3)
    b0 = pts[2]; b1 = b0 + Vector((rng.uniform(-0.3, 0.3), rng.choice((-1, 1)) * 0.55, 0.35))
    tube(part, [b0, b1], [r * 0.45, r * 0.25], 5, [P['driftGrey'], P['drift']])
    return part.jitter(rng, 0.06)


def small_rock(rng):
    return rock(rng, size=rng.uniform(0.35, 0.6), squash=0.6, cuts=5, moss=0.4)
