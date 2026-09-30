"""
treegen.py — Pine Hollow's tree species as plain geometry (PINE-HOLLOW-REMASTER PH-B4, Jake's PH-U17).

Pure numpy, no bpy: build_trees.py turns these into Blender objects (for the Cycles impostor bake and the lineup) and into
the GLB the game loads. Game space: metres, +Y up, the tree's root at the origin.

Every variant has five parts, one per slot of the game's forest LOD (src/world/Forest.ts):
  trunk    bark: the trunk + the limbs (hi, within the tier's treeHiDist)
  trunkLo  bark: the trunk + the big limbs, fewer sides (lo, out to treeLoDist)
  hi       branch cards: needle / leaf sprays, bent (2 segments) — the crown up close
  lo       branch cards: fewer, flat (1 segment), a little larger — the crown from 80 to 130 m
  twigs    small cards off the spray tips, drawn inside treeTwigDist (near-field depth)
Vertex data: POSITION, NORMAL, TEXCOORD_0 (bark: tiling bark coords / cards: the card atlas), TEXCOORD_1.x (bark: the
layer in the bark array texture), COLOR_0 (bark: the bark's tint — orange pine tops, moss, the birch's black base;
cards: crown occlusion, dark inside the crown and low down).

The card atlas (build_trees.py renders it) is 2 × 2 cells, v = 0 at the image's bottom (three's convention for the game's
own textures, and Blender's):
  0 pine tuft (bottom-left)   1 fir spray (bottom-right)   2 birch sprig (top-left)   3 dead twig + beard lichen (top-right)
Cells 0–2 are drawn top-down, the stem's base at the cell's left edge, mid-height; cell 3 is drawn from the side, the
branch along the top (v 0.86 of the cell) with the lichen hanging below it.
"""
import math
import numpy as np

UP = np.array([0.0, 1.0, 0.0])
PAD = 3.0 / 2048.0

# bark array layers (src/world/TreeFactory.ts BARK_LAYERS — same order)
BARK_PINE, BARK_FIR, BARK_GIANT, BARK_BIRCH, BARK_SNAG = 0, 1, 2, 3, 4
# card atlas cells
CELL_PINE, CELL_FIR, CELL_BIRCH, CELL_DEAD = 0, 1, 2, 3
DEAD_BRANCH_V = 0.86  # cell 3: where the branch runs, as a fraction of the cell's height


def cell_rect(c):
    col, row = c % 2, c // 2
    return (col * 0.5 + PAD, row * 0.5 + PAD, col * 0.5 + 0.5 - PAD, row * 0.5 + 0.5 - PAD)


def norm(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


def rot_axis(v, axis, ang):
    """Rodrigues: v rotated by ang about the unit axis."""
    axis = norm(axis)
    c, s = math.cos(ang), math.sin(ang)
    return v * c + np.cross(axis, v) * s + axis * np.dot(axis, v) * (1 - c)


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


class Geo:
    """An indexed triangle soup being built: positions, normals, uv, uv1, colour."""

    def __init__(self):
        self.P, self.N, self.UV, self.UV1, self.C, self.I = [], [], [], [], [], []
        self.n = 0

    def add(self, P, N, UV, C, I, UV1=None):
        P = np.asarray(P, dtype=np.float64)
        k = len(P)
        self.P.append(P)
        self.N.append(np.asarray(N, dtype=np.float64))
        self.UV.append(np.asarray(UV, dtype=np.float64))
        self.UV1.append(np.asarray(UV1, dtype=np.float64) if UV1 is not None else np.zeros((k, 2)))
        self.C.append(np.asarray(C, dtype=np.float64))
        self.I.append(np.asarray(I, dtype=np.int64) + self.n)
        self.n += k

    def extend(self, other):
        if other.n == 0:
            return
        self.add(np.concatenate(other.P), np.concatenate(other.N), np.concatenate(other.UV), np.concatenate(other.C),
                 np.concatenate(other.I), np.concatenate(other.UV1))

    def arrays(self):
        if self.n == 0:
            return None
        P = np.concatenate(self.P).astype(np.float32)
        N = np.concatenate(self.N)
        N = (N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)).astype(np.float32)
        return {
            'POSITION': P, 'NORMAL': N,
            'TEXCOORD_0': np.concatenate(self.UV).astype(np.float32),
            'TEXCOORD_1': np.concatenate(self.UV1).astype(np.float32),
            'COLOR_0': np.clip(np.concatenate(self.C), 0, 1).astype(np.float32),
            'indices': np.concatenate(self.I).astype(np.uint32),
        }

    @property
    def tris(self):
        return sum(len(i) for i in self.I) // 3


# ------------------------------------------------------------------------------------------------ tubes (bark)
def frames(pts):
    """Tangents + a rotation-minimising normal / binormal along a polyline."""
    n = len(pts)
    T = np.zeros((n, 3))
    for i in range(n):
        a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
        T[i] = norm(b - a)
    ref = np.array([1.0, 0.0, 0.0]) if abs(T[0][1]) > 0.8 else UP
    N = np.zeros((n, 3))
    N[0] = norm(np.cross(np.cross(T[0], ref), T[0]))
    for i in range(1, n):
        v = N[i - 1] - T[i] * np.dot(N[i - 1], T[i])
        N[i] = norm(v) if np.linalg.norm(v) > 1e-6 else N[i - 1]
    B = np.cross(T, N)
    return T, N, B


def tube(geo, pts, radii, segs, layer, tile=(1.3, 1.8), color=None, lobes=None, cap=None, v0=0.0):
    """
    A tapered tube along pts (bark). radii per point; `color(t, theta) -> rgb`; `lobes(t, theta) -> radius factor` (root
    buttresses); `cap`: None, 'point' (the last ring collapses), or ('jag', rng, depth) — a broken, splintered top.
    uv: u wraps round the circumference an integer number of bark tiles, v runs with the length.
    """
    pts = np.asarray(pts, dtype=np.float64)
    T, N, B = frames(pts)
    seglen = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seglen)])
    total = max(s[-1], 1e-6)
    urep = max(1, int(round(2 * math.pi * float(radii[0]) / tile[0])))
    P, Nn, UV, C, I = [], [], [], [], []
    ring = segs + 1
    for i, p in enumerate(pts):
        t = s[i] / total
        r = float(radii[i])
        for j in range(ring):
            th = 2 * math.pi * j / segs
            d = math.cos(th) * N[i] + math.sin(th) * B[i]
            f = lobes(t, th) if lobes else 1.0
            q = p + d * r * f
            if cap and cap != 'point' and i == len(pts) - 1:
                _, rng, depth = cap
                q = q - T[i] * depth * (0.3 + 0.7 * abs(math.sin(th * 2.5 + 1.7)) * rng.uniform(0.4, 1.0))
            P.append(q)
            Nn.append(norm(d - T[i] * 0.15))
            UV.append((j / segs * urep, v0 + s[i] / tile[1]))
            C.append(color(t, th) if color else (1.0, 1.0, 1.0))
    for i in range(len(pts) - 1):
        for j in range(segs):
            a, b = i * ring + j, i * ring + j + 1
            c, d = a + ring, b + ring
            I += [a, b, c, b, d, c]  # counter-clockwise seen from outside (three culls the back faces)
    if cap == 'point':
        pass  # the caller passed a ~0 last radius
    elif cap:
        # the splintered top: a fan to a point sunk into the break
        top = pts[-1] - T[-1] * cap[2] * 0.6
        base = len(P)
        P.append(top); Nn.append(T[-1]); UV.append((0.5 * urep, v0 + s[-1] / tile[1])); C.append(C[-1])
        last = (len(pts) - 1) * ring
        for j in range(segs):
            I += [last + j, last + j + 1, base]
    L = np.full((len(P), 2), 0.0)
    L[:, 0] = layer
    geo.add(P, Nn, UV, C, I, L)
    return s[-1]


def limb_path(start, direction, length, rise, droop, curl, n, rng, wobble=0.08):
    """A branch's centreline: out along `direction`, rising / drooping, the tip curling up (pines) or down (birch)."""
    d = norm(direction)
    pts = [np.array(start, dtype=np.float64)]
    for k in range(1, n + 1):
        t = k / n
        p = np.array(start) + d * length * t
        p = p + UP * (rise * length * t - droop * length * t * t + curl * length * t ** 3)
        p = p + np.array([rng.normal(0, wobble), rng.normal(0, wobble), rng.normal(0, wobble)]) * length * t * 0.4
        pts.append(p)
    return pts


def point_on(pts, t):
    """Point + tangent at arc fraction t of a polyline."""
    pts = np.asarray(pts)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    x = t * s[-1]
    i = int(np.clip(np.searchsorted(s, x) - 1, 0, len(pts) - 2))
    f = (x - s[i]) / max(seg[i], 1e-9)
    return pts[i] + (pts[i + 1] - pts[i]) * f, norm(pts[i + 1] - pts[i])


# ------------------------------------------------------------------------------------------------ cards (needles)
def card(geo, base, d, L, W, cell, nseg=2, roll=0.0, droop=0.0, ao=1.0, curtain=False, crown=None, bend=0.55, flip=False,
         sub=None):
    """
    One spray card: its stem base at `base`, running `L` along `d`, `W` across. `roll` turns the card about its own length
    (0 = flat, facing up). `droop` sags the tip (× L, world down). curtain: the card hangs (its plane holds d and world
    down, the image's top edge on the branch: cell 3). `crown` = (centre, radius): the normals lean out of the crown
    by `bend` so it lights like a volume, and ao darkens toward its core. `sub`: (u0, u1) — a slice of the cell's length.
    """
    d = norm(np.asarray(d, dtype=np.float64))
    if curtain:
        down = norm(-UP - d * np.dot(-UP, d))
        side = down
    else:
        side = np.cross(d, UP)
        if np.linalg.norm(side) < 1e-4:
            side = np.cross(d, np.array([1.0, 0.0, 0.0]))
        side = rot_axis(norm(side), d, roll)
    fn = norm(np.cross(side, d))
    if fn[1] < 0 and not curtain:
        fn = -fn
    u0, v0, u1, v1 = cell_rect(cell)
    if sub:
        u0, u1 = lerp(u0, u1, sub[0]), lerp(u0, u1, sub[1])
    if flip:
        v0, v1 = v1, v0
    P, Nn, UV, C, I = [], [], [], [], []
    for k in range(nseg + 1):
        t = k / nseg
        c = np.asarray(base) + d * L * t - UP * droop * L * t * t
        if curtain:
            # the branch line sits at DEAD_BRANCH_V of the cell: the card spans from above it down to its bottom
            top = c + (-side) * W * (1 - DEAD_BRANCH_V)
            bot = c + side * W * DEAD_BRANCH_V
            ends = [(top, v1), (bot, v0)]
        else:
            ends = [(c - side * W / 2, v0), (c + side * W / 2, v1)]
        for q, vv in ends:
            n = fn
            a = ao
            if crown is not None:
                centre, radius = crown
                out = q - centre
                rr = np.linalg.norm(out)
                n = norm(fn * (1 - bend) + norm(out) * bend)
                a = ao * lerp(0.5, 1.0, min(1.0, rr / max(radius, 1e-3)) ** 1.3)
            P.append(q); Nn.append(n); UV.append((lerp(u0, u1, t), vv)); C.append((a, a, a))
    for k in range(nseg):
        a, b, c2, dd = 2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 3
        I += [a, b, c2, b, dd, c2]
    geo.add(P, Nn, UV, C, I)


# ------------------------------------------------------------------------------------------------ the tree record
class Tree:
    def __init__(self, name, species, height, trunk_r):
        self.name, self.species, self.height, self.trunk_r = name, species, height, trunk_r
        self.trunk, self.trunkLo, self.hi, self.lo, self.twigs = Geo(), Geo(), Geo(), Geo(), Geo()

    def parts(self):
        return {'trunk': self.trunk, 'trunkLo': self.trunkLo, 'hi': self.hi, 'lo': self.lo, 'twigs': self.twigs}

    def stats(self):
        return {k: g.tris for k, g in self.parts().items()}


def trunk_spine(height, rng, n, lean=0.02, crook=0.35):
    """A trunk centreline: a gentle lean plus one or two crooks (Scots pines are rarely plumb)."""
    ax, az = rng.normal(0, lean), rng.normal(0, lean)
    ph, ph2 = rng.uniform(0, 6.28), rng.uniform(0, 6.28)
    pts = []
    for k in range(n + 1):
        t = k / n
        y = height * t
        x = ax * y + crook * math.sin(t * 3.1 + ph) * t
        z = az * y + crook * math.sin(t * 2.3 + ph2) * t
        pts.append(np.array([x, y, z]))
    return pts


def spine_at(pts, y):
    """The spine's point at height y (interpolated)."""
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        if a[1] <= y <= b[1]:
            f = (y - a[1]) / max(b[1] - a[1], 1e-9)
            return a + (b - a) * f
    return pts[-1] if y > pts[-1][1] else pts[0]


def taper(r0, t, flare=0.45, flare_h=0.05, top=0.06):
    return r0 * (lerp(1.0, top, t ** 0.9)) * (1 + flare * math.exp(-t / flare_h))


# ------------------------------------------------------------------------------------------------ Scots pine
def scots_pine(name, height, r0, seed, young=False):
    """
    Pinus sylvestris, mature: a tall clear trunk that turns orange-red above the grey plated base, an irregular, flat-ish
    crown of up-turned limbs with the needles clumped in tufts at their ends. `young`: the crown starts low, conical.
    """
    rng = np.random.RandomState(seed)
    t = Tree(name, 'pine', height, r0)
    spine = trunk_spine(height, rng, 12, lean=0.015, crook=0.25 + 0.2 * rng.rand())
    radii = [taper(r0, k / 12) for k in range(13)]
    crown_base = height * (rng.uniform(0.22, 0.3) if young else rng.uniform(0.52, 0.62))

    def bark(tt, th):
        y = tt * height
        up = smooth(crown_base * 0.55, crown_base * 1.05, y)
        low = np.array([0.66, 0.6, 0.56]) * (0.9 + 0.1 * math.sin(th * 3))
        high = np.array([1.0, 0.64, 0.42])
        return tuple(lerp(low, high, up))
    segs = 7 if r0 < 0.3 else 8
    tube(t.trunk, spine, radii, segs, BARK_PINE, tile=(1.1, 1.7), color=bark)
    tube(t.trunkLo, spine[::2], radii[::2], 6, BARK_PINE, tile=(1.1, 1.7), color=bark)

    # dead stubs on the clear bole (self-pruned lower branches)
    for _ in range(int(rng.uniform(5, 9)) if not young else 2):
        y = rng.uniform(height * 0.18, crown_base * 0.95)
        c = spine_at(spine, y)
        a = rng.uniform(0, 6.28)
        d = np.array([math.cos(a), rng.uniform(-0.15, 0.25), math.sin(a)])
        rr = taper(r0, y / height)
        pts = [c + norm(d) * rr * 0.7, c + norm(d) * (rr + rng.uniform(0.25, 0.7))]
        tube(t.trunk, pts, [0.05 * r0 / 0.42 + 0.02, 0.012], 4, BARK_PINE, tile=(0.5, 0.8), color=bark)

    crown_h = height - crown_base
    crown_r = height * (0.2 if young else rng.uniform(0.17, 0.22))
    centre = spine_at(spine, crown_base + crown_h * 0.55)
    y = crown_base
    whorl = 0
    tufts = []
    while y < height * 0.97:
        tc = (y - crown_base) / max(crown_h, 1e-3)  # 0 at the crown's base, 1 at the top
        # the crown's outline: young = a cone; mature = an irregular dome (widest at 35 %)
        env = (1 - tc) ** 0.9 if young else max(0.12, math.sin(math.pi * min(1.0, 0.2 + tc * 0.85)) ** 0.8)
        count = int(rng.randint(3, 6))
        off = rng.uniform(0, 6.28)
        for b in range(count):
            if rng.rand() < 0.15:
                continue
            a = off + b / count * 6.28 + rng.normal(0, 0.35)
            L = crown_r * env * rng.uniform(0.7, 1.15) + 0.4
            base = spine_at(spine, y)
            rr = taper(r0, y / height)
            d = np.array([math.cos(a), 0.0, math.sin(a)])
            rise = (0.25 + 0.35 * tc) if not young else 0.15
            droop = 0.15 if not young else 0.05
            path = limb_path(base + d * rr * 0.6, d, L, rise, droop, 0.35, 3, rng)
            lr = max(0.03, 0.2 * rr + 0.03 * L)
            tube(t.trunk, [path[0], path[2], path[3]], [lr, lr * 0.45, 0.012], 4, BARK_PINE, tile=(0.5, 0.9), color=bark, v0=rng.rand())
            if L > crown_r * 0.6:
                tube(t.trunkLo, [path[0], path[2]], [lr, lr * 0.35], 4, BARK_PINE, tile=(0.5, 0.9), color=bark)
            # tufts along the outer 55 %: a clump of 3 cards set round the limb like a star
            nt = 2 + int(L > 2.5) + int(L > 4)
            for k in range(nt):
                f = lerp(0.45, 1.0, (k + 1) / nt)
                p, tang = point_on(path, f)
                tufts.append((p, tang, lerp(0.9, 1.6, rng.rand()) * (height / 22) ** 0.5, tc))
        y += rng.uniform(0.75, 1.05) * (0.8 if young else 1.0)
        whorl += 1
    # the leader
    top = spine[-1]
    for k in range(3):
        d = norm(UP * 1.0 + np.array([rng.normal(0, 0.35), 0, rng.normal(0, 0.35)]))
        tufts.append((top - UP * 0.8 * k, d, 1.1 * (height / 22) ** 0.5, 1.0))

    crown = (centre, crown_r * 1.1)
    for (p, tang, size, tc) in tufts:
        # a clump: shoots fanning out of the branch end every way, most up and out (pine candles), so the crown reads as
        # the Scots pine's cushions of needles rather than a stack of flat plates
        d = norm(tang + UP * rng.uniform(0.3, 0.7))
        L, W = 2.0 * size, 1.15 * size
        r0ll = rng.uniform(0, 3.14)
        for i in range(5):
            dd = norm(d + np.array([rng.normal(0, 0.45), rng.normal(0.1, 0.35), rng.normal(0, 0.45)]))
            card(t.hi, p - dd * L * 0.3, dd, L * rng.uniform(0.8, 1.1), W, CELL_PINE, nseg=2,
                 roll=r0ll + i * 0.63 + rng.normal(0, 0.2), droop=0.06, crown=crown)
        card(t.lo, p - d * L * 0.3, d, L * 1.15, W * 1.3, CELL_PINE, nseg=1, roll=r0ll, crown=crown)
        card(t.lo, p - d * L * 0.3, rot_axis(d, UP, 0.9), L * 1.15, W * 1.3, CELL_PINE, nseg=1, roll=r0ll + 1.57, crown=crown)
        if rng.rand() < 0.7:
            dd = norm(d + np.array([rng.normal(0, 0.5), 0.3, rng.normal(0, 0.5)]))
            card(t.twigs, p + d * L * 0.3, dd, L * 0.45, W * 0.45, CELL_PINE, nseg=1, roll=rng.uniform(0, 3), crown=crown,
                 sub=(0.45, 1.0))
    return t


# ------------------------------------------------------------------------------------------------ fir / spruce
def spruce(name, height, r0, seed, sapling=False, oldgrowth=False):
    """
    A Norway spruce / silver fir: a narrow spire, whorls from near the ground, branches sweeping down then up at the tips
    with their sprays hanging. `oldgrowth`: a mossy trunk.
    """
    rng = np.random.RandomState(seed)
    t = Tree(name, 'sapling' if sapling else 'fir', height, r0)
    spine = trunk_spine(height, rng, 10, lean=0.008, crook=0.06)
    radii = [taper(r0, k / 10, flare=0.35) for k in range(11)]

    def bark(tt, th):
        y = tt * height
        base = np.array([0.86, 0.8, 0.74])
        if oldgrowth:
            moss = smooth(3.5, 0.3, y) * (0.55 + 0.45 * max(0.0, math.cos(th - 0.6)))
            base = lerp(base, np.array([0.42, 0.52, 0.25]), moss)
        return tuple(base)
    segs = 5 if sapling else 8
    tube(t.trunk, spine, radii, segs, BARK_FIR, tile=(1.0, 1.4), color=bark)
    tube(t.trunkLo, spine[::2], radii[::2], 5, BARK_FIR, tile=(1.0, 1.4), color=bark)

    crown_base = height * (0.04 if sapling else rng.uniform(0.07, 0.14))
    crown_r = height * (0.24 if sapling else rng.uniform(0.15, 0.18))
    crown = (spine_at(spine, crown_base + (height - crown_base) * 0.35), crown_r * 1.2)
    y = crown_base
    step = 0.32 if sapling else 0.68 + height * 0.004
    while y < height * 0.96:
        tc = (y - crown_base) / (height - crown_base)
        env = (1 - tc) ** 1.05
        count = int(rng.randint(4, 6)) if sapling else int(rng.randint(5, 8))
        off = rng.uniform(0, 6.28)
        base = spine_at(spine, y)
        rr = taper(r0, y / height)
        for b in range(count):
            if rng.rand() < 0.1:
                continue
            a = off + b / count * 6.28 + rng.normal(0, 0.3)
            L = crown_r * env * rng.uniform(0.8, 1.15) + (0.3 if sapling else 0.9)
            d = np.array([math.cos(a), 0.0, math.sin(a)])
            droop_ang = lerp(-0.35, 0.15, tc) + rng.normal(0, 0.08)  # lower branches sweep down
            dd = norm(d + UP * droop_ang)
            if not sapling and L > 3.0 and b % 2 == 0:
                path = limb_path(base + d * rr * 0.6, dd, L * 0.85, 0.0, 0.1, 0.2, 2, rng, wobble=0.03)
                lr = max(0.025, 0.12 * rr + 0.02 * L)
                tube(t.trunk, path, [lr, lr * 0.5, 0.01], 4, BARK_FIR, tile=(0.5, 0.9), color=bark)
            # the sprays: a main card along the branch, two rolled a little either side (a fan: volume from any angle)
            size = L * 1.05
            W = size * 0.62
            st = base + d * rr * 0.5
            for rl in (-0.55, 0.0, 0.55):
                card(t.hi, st, rot_axis(dd, UP, rng.normal(0, 0.12)), size, W, CELL_FIR, nseg=2, roll=rl + rng.normal(0, 0.15),
                     droop=0.12, crown=crown, bend=0.45)
            card(t.lo, st, dd, size * 1.05, W * 1.2, CELL_FIR, nseg=1, roll=rng.normal(0, 0.2), crown=crown, bend=0.45)
            if not sapling and rng.rand() < 0.5:
                tip, _ = point_on([st, st + dd * size], 0.75)
                card(t.twigs, tip, norm(dd + np.array([rng.normal(0, 0.6), -0.2, rng.normal(0, 0.6)])), size * 0.4,
                     size * 0.3, CELL_FIR, nseg=1, roll=rng.uniform(-1, 1), crown=crown, bend=0.45, sub=(0.5, 1.0))
            elif sapling:
                card(t.twigs, st + dd * size * 0.5, rot_axis(dd, UP, 0.6), size * 0.5, size * 0.35, CELL_FIR, nseg=1,
                     roll=0.9, crown=crown, bend=0.45)
        y += step * rng.uniform(0.85, 1.15)
    top = spine[-1]
    for rl in (0.0, 1.57):
        card(t.hi, top - UP * height * 0.05, UP, height * 0.07 + 0.3, height * 0.035 + 0.15, CELL_FIR, nseg=1, roll=rl,
             crown=crown, bend=0.3)
        card(t.lo, top - UP * height * 0.05, UP, height * 0.07 + 0.3, height * 0.035 + 0.15, CELL_FIR, nseg=1, roll=rl,
             crown=crown, bend=0.3)
    return t


# ------------------------------------------------------------------------------------------------ the old-growth giant
def giant(name, height, r0, seed, spike_top=False):
    """
    An old-growth cedar / fir giant: 4–6× a pine's girth, a buttressed, fluted base under moss, deeply furrowed red bark, a
    clear bole to ~35 %, heavy limbs that reach out and down with sprays hanging off them. `spike_top`: the top died
    back and stands bare (a candelabra of dead leaders), as the oldest ones do.
    """
    rng = np.random.RandomState(seed)
    t = Tree(name, 'giant', height, r0)
    spine = trunk_spine(height, rng, 20, lean=0.006, crook=0.4)
    nlob = int(rng.randint(5, 8))
    lph = rng.uniform(0, 6.28)

    def lobes(tt, th):
        y = tt * height
        buttress = math.exp(-y / 2.6) * 0.75
        flute = math.exp(-y / 9.0) * 0.08
        w = max(0.0, math.cos(nlob * th + lph + 0.4 * math.sin(3 * th))) ** 2.2
        return 1 + buttress * w + flute * math.cos(nlob * 2 * th + lph)
    radii = [r0 * lerp(1.0, 0.12, (k / 20) ** 0.8) * (1 + 0.35 * math.exp(-k / 20 / 0.05)) for k in range(21)]
    alive_top = height * (0.9 if spike_top else 1.0)

    def bark(tt, th):
        y = tt * height
        base = np.array([1.0, 0.84, 0.74])
        moss = smooth(7.0, 0.5, y) * (0.5 + 0.5 * max(0.0, math.cos(th - 1.2))) + 0.25 * smooth(12, 2, y)
        base = lerp(base, np.array([0.36, 0.5, 0.2]), min(1.0, moss))
        if y > alive_top:
            base = lerp(base, np.array([0.8, 0.78, 0.74]), smooth(alive_top, alive_top + 2, y))
        return tuple(base)
    tube(t.trunk, spine, radii, 16, BARK_GIANT, tile=(1.6, 2.4), color=bark, lobes=lobes)
    tube(t.trunkLo, spine[::2], radii[::2], 10, BARK_GIANT, tile=(1.6, 2.4), color=bark, lobes=lobes)

    crown_base = height * rng.uniform(0.3, 0.38)
    crown_r = height * rng.uniform(0.2, 0.24)
    centre = spine_at(spine, crown_base + (alive_top - crown_base) * 0.45)
    crown = (centre, crown_r * 1.15)
    y = crown_base
    while y < alive_top * 0.97:
        tc = (y - crown_base) / (alive_top - crown_base)
        env = max(0.25, (1 - tc) ** 0.7 * (0.75 + 0.25 * math.sin(tc * 3)))
        base = spine_at(spine, y)
        rr = radii[min(20, int(y / height * 20))]
        count = int(rng.randint(3, 5))
        off = rng.uniform(0, 6.28)
        for b in range(count):
            a = off + b / count * 6.28 + rng.normal(0, 0.5)
            d = np.array([math.cos(a), 0.0, math.sin(a)])
            L = crown_r * env * rng.uniform(0.75, 1.15) + 1.0
            dead = rng.rand() < 0.12
            rise = rng.uniform(0.15, 0.4) * (1 - tc * 0.5)
            path = limb_path(base + d * rr * 0.7, d, L, rise, 0.45, 0.25, 4, rng, wobble=0.1)
            lr = max(0.08, min(rr * 0.28, 0.07 + 0.035 * L))
            tube(t.trunk, [path[0], path[1], path[2], path[4]], [lr, lr * 0.72, lr * 0.48, 0.03], 5, BARK_GIANT, tile=(0.9, 1.4),
                 color=bark, v0=rng.rand())
            if L > crown_r * 0.55:
                tube(t.trunkLo, [path[0], path[2], path[4]], [lr, lr * 0.45, 0.04], 3, BARK_GIANT, tile=(0.9, 1.4), color=bark)
            if dead:
                continue
            # hanging sprays along the outer 70 % of the limb, alternating sides, plus a clump at the tip
            n = 5 + int(L > 5) + int(L > 8) * 2
            for k in range(n):
                f = lerp(0.2, 1.0, (k + 0.5) / n)
                p, tang = point_on(path, f)
                side = norm(np.cross(tang, UP)) * (1 if k % 2 else -1)
                size = rng.uniform(3.0, 4.2) * (0.75 + 0.25 * (1 - f * 0.5))
                dd = norm(tang * 0.6 + side * 0.55 - UP * rng.uniform(0.15, 0.45))
                for rl in (-0.45, 0.35):
                    card(t.hi, p, dd, size, size * 0.62, CELL_FIR, nseg=2, roll=rl + rng.normal(0, 0.2), droop=0.18,
                         crown=crown, bend=0.4)
                card(t.lo, p, dd, size * 1.1, size * 0.7, CELL_FIR, nseg=1, roll=rng.normal(0, 0.2), crown=crown, bend=0.4)
                if rng.rand() < 0.45:
                    card(t.twigs, p + dd * size * 0.5, norm(dd - UP * 0.4), size * 0.4, size * 0.28, CELL_FIR, nseg=1,
                         roll=rng.uniform(-1, 1), crown=crown, bend=0.4, sub=(0.4, 1.0))
            tip, tang = point_on(path, 1.0)
            for rl in (0.0, 1.2, 2.4):
                card(t.hi, tip - tang * 0.8, norm(tang + UP * 0.2), 2.6, 1.6, CELL_FIR, nseg=2, roll=rl, droop=0.1,
                     crown=crown, bend=0.4)
            card(t.lo, tip - tang * 0.8, norm(tang + UP * 0.2), 2.8, 1.8, CELL_FIR, nseg=1, roll=0.0, crown=crown, bend=0.4)
        y += rng.uniform(1.0, 1.5)
    if spike_top:
        # dead leaders: silver spars standing out of the top
        for k in range(3):
            a = rng.uniform(0, 6.28)
            b0 = spine_at(spine, alive_top + k * 1.5)
            d = norm(UP * 2.2 + np.array([math.cos(a), 0, math.sin(a)]))
            path = limb_path(b0, d, rng.uniform(3, 6), 0.0, 0.0, 0.0, 2, rng, wobble=0.05)
            tube(t.trunk, path, [0.22, 0.12, 0.02], 5, BARK_SNAG, tile=(0.6, 1.0), color=lambda tt, th: (0.85, 0.83, 0.8))
    else:
        top = spine[-1]
        for rl in (0.0, 1.05, 2.1):
            card(t.hi, top - UP * 3.0, UP, 4.2, 2.4, CELL_FIR, nseg=2, roll=rl, crown=crown, bend=0.3)
        card(t.lo, top - UP * 3.0, UP, 4.4, 2.6, CELL_FIR, nseg=1, roll=0.0, crown=crown, bend=0.3)
        card(t.lo, top - UP * 3.0, UP, 4.4, 2.6, CELL_FIR, nseg=1, roll=1.57, crown=crown, bend=0.3)
    return t


# ------------------------------------------------------------------------------------------------ silver birch
def birch(name, height, r0, seed, twin=False):
    """
    Betula pendula: slim white stems (black-fissured at the foot), ascending limbs whose fine outer twigs weep; the leaves
    hang in curtains. `twin`: two stems from one root, leaning apart.
    """
    rng = np.random.RandomState(seed)
    t = Tree(name, 'birch', height, r0)

    def bark(tt, th, h=height):
        y = tt * h
        dark = smooth(1.6, 0.2, y) * (0.7 + 0.3 * math.sin(th * 5)) + 0.25 * smooth(4, 1.6, y)
        return tuple(lerp(np.array([1.0, 1.0, 0.98]), np.array([0.3, 0.29, 0.28]), min(1.0, dark)))
    stems = []
    if twin:
        for s in (-1, 1):
            a = rng.uniform(0, 6.28)
            lean = np.array([math.cos(a), 0, math.sin(a)]) * 0.07 * s
            h = height * (1.0 if s > 0 else 0.86)
            pts = [np.array([0.0, 0.0, 0.0]) + lean * 0.0]
            for k in range(1, 11):
                tt = k / 10
                pts.append(np.array([lean[0] * h * tt + 0.25 * s * math.sin(tt * 2), h * tt, lean[2] * h * tt]))
            stems.append((pts, h, r0 * (1.0 if s > 0 else 0.85)))
    else:
        stems.append((trunk_spine(height, rng, 10, lean=0.02, crook=0.3), height, r0))

    for (spine, h, r) in stems:
        radii = [taper(r, k / 10, flare=0.3, top=0.12) for k in range(11)]
        col = lambda tt, th, h=h: bark(tt, th, h)
        tube(t.trunk, spine, radii, 7, BARK_BIRCH, tile=(0.8, 1.2), color=col)
        tube(t.trunkLo, spine[::2], radii[::2], 5, BARK_BIRCH, tile=(0.8, 1.2), color=col)
        crown_base = h * rng.uniform(0.3, 0.4)
        crown_r = h * rng.uniform(0.2, 0.26)
        centre = spine_at(spine, crown_base + (h - crown_base) * 0.5)
        crown = (centre, crown_r * 1.1)
        y = crown_base
        while y < h * 0.95:
            tc = (y - crown_base) / (h - crown_base)
            env = math.sin(math.pi * min(1.0, 0.15 + tc * 0.9)) ** 0.7
            a = rng.uniform(0, 6.28)
            d = np.array([math.cos(a), 0.0, math.sin(a)])
            base = spine_at(spine, y)
            L = crown_r * env * rng.uniform(0.8, 1.2) + 0.6
            path = limb_path(base, norm(d + UP * rng.uniform(0.5, 0.9)), L, 0.0, 0.9, 0.0, 3, rng, wobble=0.06)
            lr = max(0.02, 0.28 * taper(r, y / h, flare=0.3, top=0.12))
            tube(t.trunk, path, [lr, lr * 0.6, lr * 0.3, 0.008], 4, BARK_BIRCH, tile=(0.4, 0.6), color=lambda tt, th: (0.92, 0.91, 0.89))
            if L > crown_r * 0.7:
                tube(t.trunkLo, [path[0], path[2]], [lr, lr * 0.4], 3, BARK_BIRCH, tile=(0.4, 0.6), color=lambda tt, th: (0.92, 0.91, 0.89))
            # weeping curtains of leaves from the outer half: cards hang from the limb, their plane turned across it
            n = 3 + int(L > 2.5) + int(L > 4)
            for k in range(n):
                f = lerp(0.3, 1.0, (k + 0.5) / n)
                p, tang = point_on(path, f)
                size = rng.uniform(1.7, 2.5) * (h / 16) ** 0.4
                for s2 in (-1, 1):
                    dd = norm(tang * 0.6 + norm(np.cross(tang, UP)) * 0.6 * s2 - UP * rng.uniform(0.2, 0.55))
                    card(t.hi, p, dd, size, size * 0.6, CELL_BIRCH, nseg=2, roll=rng.uniform(0.2, 0.8) * s2, droop=0.25,
                         crown=crown, bend=0.5)
                dd = norm(tang * 0.6 - UP * 0.35)
                card(t.lo, p, dd, size * 1.15, size * 0.75, CELL_BIRCH, nseg=1, roll=0.5, crown=crown, bend=0.5)
                card(t.lo, p, rot_axis(dd, UP, 1.57), size * 1.15, size * 0.75, CELL_BIRCH, nseg=1, roll=-0.5, crown=crown, bend=0.5)
                if rng.rand() < 0.6:
                    card(t.twigs, p + dd * size * 0.4, norm(dd + np.array([rng.normal(0, 0.5), 0, rng.normal(0, 0.5)])),
                         size * 0.45, size * 0.3, CELL_BIRCH, nseg=1, roll=rng.uniform(-1.5, 1.5), crown=crown, bend=0.5,
                         sub=(0.35, 1.0))
            y += rng.uniform(0.28, 0.45)
        top = spine[-1]
        card(t.hi, top - UP * 1.2, norm(UP + np.array([0.2, 0, 0.1])), 1.8, 1.0, CELL_BIRCH, nseg=1, roll=0.0, crown=crown, bend=0.4)
        card(t.lo, top - UP * 1.2, norm(UP + np.array([0.2, 0, 0.1])), 1.8, 1.0, CELL_BIRCH, nseg=1, roll=0.0, crown=crown, bend=0.4)
    return t


# ------------------------------------------------------------------------------------------------ the dead snag
def snag(name, height, r0, seed, broken=True):
    """
    A standing dead pine: silver, barkless wood, the top snapped off in splinters (or a bare spire), a few dead limbs and
    stubs, old man's beard lichen hanging off them — the eerie-folklore tree of the ridge and the old-growth.
    """
    rng = np.random.RandomState(seed)
    t = Tree(name, 'snag', height, r0)
    spine = trunk_spine(height, rng, 10, lean=0.03, crook=0.3)

    def bark(tt, th):
        y = tt * height
        base = np.array([0.88, 0.86, 0.82]) * (0.92 + 0.08 * math.sin(th * 7 + y))
        return tuple(lerp(base, np.array([0.45, 0.4, 0.36]), smooth(1.6, 0.0, y)))
    if broken:
        radii = [taper(r0, k / 10, flare=0.35, top=0.55) for k in range(11)]
        cap = ('jag', rng, r0 * 2.5)
    else:
        radii = [taper(r0, k / 10, flare=0.35, top=0.02) for k in range(11)]
        cap = 'point'
    tube(t.trunk, spine, radii, 8, BARK_SNAG, tile=(1.0, 1.5), color=bark, cap=cap)
    tube(t.trunkLo, spine[::2], radii[::2], 6, BARK_SNAG, tile=(1.0, 1.5), color=bark, cap=cap if cap == 'point' else ('jag', rng, r0 * 2.5))
    n = int(rng.randint(12, 18))
    for k in range(n):
        y = rng.uniform(height * 0.22, height * 0.93)
        a = rng.uniform(0, 6.28)
        d = np.array([math.cos(a), 0.0, math.sin(a)])
        base = spine_at(spine, y)
        rr = taper(r0, y / height, flare=0.35, top=0.55 if broken else 0.02)
        L = rng.uniform(0.8, 3.8) * (1 - 0.45 * y / height)
        stub = L < 1.2
        path = limb_path(base + d * rr * 0.6, norm(d + UP * rng.uniform(-0.3, 0.4)), L, 0.0, 0.1, 0.05, 2, rng, wobble=0.05)
        lr = 0.07 + 0.02 * L
        tube(t.trunk, path, [lr, lr * 0.55, 0.012], 4, BARK_SNAG, tile=(0.5, 0.9), color=lambda tt, th: (0.86, 0.84, 0.8))
        if L > 1.8:
            tube(t.trunkLo, [path[0], path[2]], [lr, 0.02], 3, BARK_SNAG, tile=(0.5, 0.9), color=lambda tt, th: (0.86, 0.84, 0.8))
        if stub:
            continue
        # a dead twig spray + a curtain of beard lichen hanging off the limb
        p, tang = point_on(path, 0.35)
        size = L * rng.uniform(0.8, 1.0)
        card(t.hi, p, tang, size, size * 0.55, CELL_DEAD, nseg=1, curtain=True, ao=0.95)
        card(t.lo, p, tang, size, size * 0.55, CELL_DEAD, nseg=1, curtain=True, ao=0.95)
        card(t.twigs, p + tang * size * 0.3, rot_axis(tang, UP, 0.8), size * 0.5, size * 0.3, CELL_DEAD, nseg=1,
             curtain=True, ao=0.95, sub=(0.2, 0.7))
    # a guaranteed card (the needle batch needs geometry for every variant)
    p = spine_at(spine, height * 0.6)
    d = np.array([1.0, 0.0, 0.3])
    card(t.lo, p + norm(d) * r0, norm(d), 1.2, 0.7, CELL_DEAD, nseg=1, curtain=True)
    return t


# ------------------------------------------------------------------------------------------------ pine sapling
def pine_sapling(name, height, r0, seed):
    """A young Scots pine: a leader and three or four open whorls of up-turned shoots."""
    rng = np.random.RandomState(seed)
    t = Tree(name, 'sapling', height, r0)
    spine = trunk_spine(height, rng, 5, lean=0.02, crook=0.05)
    radii = [taper(r0, k / 5, flare=0.2, top=0.2) for k in range(6)]
    col = lambda tt, th: tuple(lerp(np.array([0.6, 0.52, 0.46]), np.array([0.9, 0.62, 0.45]), tt))
    tube(t.trunk, spine, radii, 5, BARK_PINE, tile=(0.5, 0.8), color=col)
    tube(t.trunkLo, [spine[0], spine[-1]], [radii[0], radii[-1]], 4, BARK_PINE, tile=(0.5, 0.8), color=col)
    crown = (spine_at(spine, height * 0.55), height * 0.45)
    y = height * 0.2
    while y < height * 0.9:
        tc = y / height
        base = spine_at(spine, y)
        cnt = int(rng.randint(4, 6))
        off = rng.uniform(0, 6.28)
        for b in range(cnt):
            a = off + b / cnt * 6.28 + rng.normal(0, 0.3)
            d = norm(np.array([math.cos(a), 0.35 + 0.3 * tc, math.sin(a)]))
            L = height * 0.42 * (1 - tc) + 0.35
            for rl in (0.0, 1.57):
                card(t.hi, base, d, L, L * 0.6, CELL_PINE, nseg=2, roll=rl + rng.normal(0, 0.2), droop=0.05, crown=crown)
            card(t.lo, base, d, L * 1.1, L * 0.7, CELL_PINE, nseg=1, roll=0.4, crown=crown)
            card(t.twigs, base + d * L * 0.5, norm(d + UP * 0.4), L * 0.5, L * 0.35, CELL_PINE, nseg=1, roll=1.0,
                 crown=crown, sub=(0.4, 1.0))
        y += rng.uniform(0.45, 0.65)
    top = spine[-1]
    for rl in (0.0, 1.57):
        card(t.hi, top - UP * 0.5, UP, 0.9, 0.5, CELL_PINE, nseg=1, roll=rl, crown=crown)
    card(t.lo, top - UP * 0.5, UP, 0.9, 0.5, CELL_PINE, nseg=1, roll=0.0, crown=crown)
    return t


# ------------------------------------------------------------------------------------------------ the set
# (name, species, height m, trunk radius m, builder) — the game's placement (src/world/placement.ts TREE_SPECS_V2) plants
# by these heights / radii in this order; build_trees.py writes them to trees.json and test/tree-species.test.ts checks.
SPECS = [
    ('pine-a', 'pine', 22.0, 0.42, lambda: scots_pine('pine-a', 22.0, 0.42, 11)),
    ('pine-b', 'pine', 17.0, 0.34, lambda: scots_pine('pine-b', 17.0, 0.34, 12)),
    ('pine-c', 'pine', 26.0, 0.50, lambda: scots_pine('pine-c', 26.0, 0.50, 13)),
    ('pine-young', 'pine', 13.0, 0.27, lambda: scots_pine('pine-young', 13.0, 0.27, 14, young=True)),
    ('fir-a', 'fir', 24.0, 0.45, lambda: spruce('fir-a', 24.0, 0.45, 21)),
    ('fir-b', 'fir', 30.0, 0.56, lambda: spruce('fir-b', 30.0, 0.56, 22, oldgrowth=True)),
    ('giant-a', 'giant', 44.0, 2.0, lambda: giant('giant-a', 44.0, 2.0, 31)),
    ('giant-b', 'giant', 52.0, 2.4, lambda: giant('giant-b', 52.0, 2.4, 32, spike_top=True)),
    ('birch-a', 'birch', 16.0, 0.2, lambda: birch('birch-a', 16.0, 0.2, 41)),
    ('birch-twin', 'birch', 13.0, 0.16, lambda: birch('birch-twin', 13.0, 0.16, 42, twin=True)),
    ('snag-a', 'snag', 14.0, 0.38, lambda: snag('snag-a', 14.0, 0.38, 51, broken=True)),
    ('snag-b', 'snag', 10.0, 0.3, lambda: snag('snag-b', 10.0, 0.3, 52, broken=False)),
    ('sapling-pine', 'sapling', 3.2, 0.06, lambda: pine_sapling('sapling-pine', 3.2, 0.06, 61)),
    ('sapling-fir', 'sapling', 4.5, 0.08, lambda: spruce('sapling-fir', 4.5, 0.08, 62, sapling=True)),
]


if __name__ == '__main__':
    for name, sp, h, r, make in SPECS:
        tr = make()
        print(name, sp, h, r, tr.stats())
