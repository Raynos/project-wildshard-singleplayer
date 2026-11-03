"""gateway.py <out-dir>: Desert Ruin's landmark as a Blender script (OPEN-PLOTS OP12): the ruined sandstone temple gateway
over the plaza, take C beside the image-to-3D takes on the pick board (art/desert-ruin/round-1-landmark/).

Crisp chunky low-poly sandstone (the open plots' kit idiom): two massive fluted columns of stacked drums, each on a
stepped square plinth under a flared capital and a square abacus, carry a broken lintel of big chamfered ashlar blocks in
three courses (two rows deep, joints staggered): the lower course spans whole with a projecting ledge on it, the second
misses a block, the third stands over the left column with a lower stack on the right, ragged. A few blocks are
chipped, a few sit proud or sag; fallen blocks and rubble lie at the columns' feet, clear of the walk. Every face samples
the swatch atlas (landmarklib.py); up-facing faces are sun-bleached cream, the sides warmer golds. The far model is the
same masses as plain blocks and 12-sided shafts, so near and far stand to the same box.

Exports landmark.glb (near) and landmark-far.glb, in metres, pivot at the base centre: 40 m tall, 44 m wide (Blender x,
glTF x), the columns' plinths 12 m deep (Blender y, glTF z); the fallen blocks reach ~8.6 m out front and back. The
opening faces Blender -y / +y (glTF +Z / -Z): the walk passes through along glTF z. It is 20 m wide between the plinths
(22.4 m between the shafts) and 28 m clear to the lintel's underside; the lintel's top is 35.6 m, 40 m over the left
column (Blender -x, glTF -x). Run: bash scripts/blender/build.sh open-plots/gateway.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 12
# sRGB swatches, lightest first (judged against art/grid/round-62-open-plot-palettes/14-desert-ruin.jpg)
SWATCHES = {
    'cream': ['#fbf0d2', '#f1e2bb', '#e2cd9f', '#c9b083'],
    'gold': ['#ecd09a', '#dfbd82', '#c9a46a', '#a98653'],
    'warm': ['#e6c084', '#d6ab6c', '#bf9258', '#9c7445'],
    'ochre': ['#dcb173', '#c99b5e', '#b0834b', '#8d683a'],
}
STONES = ['Kit.gold', 'Kit.warm', 'Kit.gold', 'Kit.ochre']
COL_X = 16.0  # the columns' axes
PLINTH = 6.0  # the lower plinth step's half size (x 10..22: the opening is 20 m at the ground)
SHAFT_R = 4.8  # the shaft's radius at its foot (4.5 at its top)
SHAFT_Z = (3.6, 24.4)
DRUMS = 6
ABACUS = (26.0, 28.0)  # the lintel's underside is 28 m: the opening's clear height
LINTEL_Y = 5.4  # the lintel's half depth
COURSES = (28.0, 32.0, 35.6, 40.0)
LEDGE = 0.55  # the ledge on the lower course stands this proud


def outward(p, pts, slot, centre):
    """A face of a convex solid, wound so its normal points away from `centre`."""
    n = [0.0, 0.0, 0.0]
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n[0] += (a[1] - b[1]) * (a[2] + b[2])
        n[1] += (a[2] - b[2]) * (a[0] + b[0])
        n[2] += (a[0] - b[0]) * (a[1] + b[1])
    m = [sum(q[i] for q in pts) / len(pts) for i in range(3)]
    if sum(n[i] * (m[i] - centre[i]) for i in range(3)) < 0:
        pts = list(reversed(pts))
    p.face(pts, slot)


def placer(at, yaw=0.0, tilt=0.0):
    """Local block coordinates → the model: tilt about local x, then yaw about z, then move to `at`."""
    cy, sy, ct, st = math.cos(yaw), math.sin(yaw), math.cos(tilt), math.sin(tilt)

    def go(q):
        x, y, z = q[0], q[1] * ct - q[2] * st, q[1] * st + q[2] * ct
        return (at[0] + x * cy - y * sy, at[1] + x * sy + y * cy, at[2] + z)
    return go


def block(p, lo, hi, slot, bevel=0.18, place=None):
    """A chamfered ashlar block from `lo` to `hi` (every edge cut by `bevel`): 26 faces. `place` maps it (a fallen one)."""
    c = [(lo[i] + hi[i]) / 2 for i in range(3)]
    h = [(hi[i] - lo[i]) / 2 for i in range(3)]
    e = min(bevel, *(v * 0.4 for v in h))
    go = place or (lambda q: (c[0] + q[0], c[1] + q[1], c[2] + q[2]))
    centre = go((0.0, 0.0, 0.0))

    def v(s, axis):  # corner `s`'s vertex on the face across `axis`
        return go(tuple(s[i] * (h[i] if i == axis else h[i] - e) for i in range(3)))

    corners = [(sx, sy, sz) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    for axis in range(3):
        for sign in (-1, 1):
            a, b = [i for i in range(3) if i != axis]
            quad = []
            for sa, sb in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                s = [0, 0, 0]
                s[axis], s[a], s[b] = sign, sa, sb
                quad.append(v(s, axis))
            outward(p, quad, slot, centre)
    for axis in range(3):  # the edge strips along `axis`
        a, b = [i for i in range(3) if i != axis]
        for sa in (-1, 1):
            for sb in (-1, 1):
                ends = []
                for sx in (-1, 1):
                    s = [0, 0, 0]
                    s[axis], s[a], s[b] = sx, sa, sb
                    ends.append(s)
                outward(p, [v(ends[0], a), v(ends[1], a), v(ends[1], b), v(ends[0], b)], slot, centre)
    for s in corners:
        outward(p, [v(s, 0), v(s, 1), v(s, 2)], slot, centre)


def chipped(p, lo, hi, slot, cuts):
    """A block whose x-z profile has corners knocked off (`cuts`: {corner: (dx, dz)}, corners 'tl', 'tr', 'bl', 'br'),
    as a prism through its depth: the chip reads from front and back."""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    prof = []
    for name, (x, z), (ax, az) in (('bl', (x0, z0), (1, 1)), ('br', (x1, z0), (-1, 1)), ('tr', (x1, z1), (-1, -1)),
                                   ('tl', (x0, z1), (1, -1))):
        if name in cuts:
            dx, dz = cuts[name]
            # counter-clockwise: the vertical side's point first at bl / tr, the horizontal side's first at br / tl
            vert, horiz = (x, z + az * dz), (x + ax * dx, z)
            prof += [vert, horiz] if name in ('bl', 'tr') else [horiz, vert]
        else:
            prof.append((x, z))
    centre = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    outward(p, [(x, y0, z) for x, z in prof], slot, centre)
    outward(p, [(x, y1, z) for x, z in prof], slot, centre)
    for (xa, za), (xb, zb) in zip(prof, prof[1:] + prof[:1]):
        outward(p, [(xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za)], slot, centre)


def drum(p, cx, cy, z0, z1, r0, r1, flutes, spin, slot, detail):
    """A shaft drum: fluted (2 x `flutes` sides, the flutes cut 7 % in) with chamfered joints top and bottom."""
    sides = 2 * flutes if detail else flutes
    radii = [1.0 if (i % 2 == 0 or not detail) else 0.955 for i in range(sides)]
    lv = [(z0, 0.95), (z0 + 0.3, 1.0), (z1 - 0.3, 1.0), (z1, 0.95)] if detail else [(z0, 1.0), (z1, 1.0)]

    def ring(z, s):
        r = (r0 + (r1 - r0) * (z - z0) / (z1 - z0)) * s
        return [(cx + r * radii[i] * math.cos(spin + 2 * math.pi * i / sides),
                 cy + r * radii[i] * math.sin(spin + 2 * math.pi * i / sides), z) for i in range(sides)]
    rings = [ring(z, s) for z, s in lv]
    for k in range(len(rings) - 1):
        a, b = rings[k], rings[k + 1]
        zm = (lv[k][0] + lv[k + 1][0]) / 2
        for i in range(sides):
            j = (i + 1) % sides
            outward(p, [a[i], a[j], b[j], b[i]], slot, (cx, cy, zm))


def column(p, cx, rng, detail):
    """One column: a two-step plinth, the fluted shaft of drums (each a little off true), the capital and the abacus."""
    if detail:  # the lower step as four blocks, the upper as two
        for sx in (-1, 1):
            for sy in (-1, 1):
                lo = (cx + min(0, sx) * PLINTH, min(0, sy) * PLINTH, 0.0)
                hi = (cx + max(0, sx) * PLINTH, max(0, sy) * PLINTH, 2.0)
                block(p, lo, hi, rng.choice(STONES), 0.22)
        for sy in (-1, 1):
            block(p, (cx - 5.4, min(0, sy) * 5.4, 2.0), (cx + 5.4, max(0, sy) * 5.4, 3.6), rng.choice(STONES), 0.22)
    else:
        p.box((cx - PLINTH, -PLINTH, 0.0), (cx + PLINTH, PLINTH, 2.0), 'Kit.gold')
        p.box((cx - 5.4, -5.4, 2.0), (cx + 5.4, 5.4, 3.6), 'Kit.gold')
    z0, z1 = SHAFT_Z
    n = DRUMS if detail else 1
    for k in range(n):
        za, zb = z0 + (z1 - z0) * k / n, z0 + (z1 - z0) * (k + 1) / n
        ra = SHAFT_R - 0.3 * (za - z0) / (z1 - z0)
        rb = SHAFT_R - 0.3 * (zb - z0) / (z1 - z0)
        off = (rng.uniform(-0.15, 0.15), rng.uniform(-0.15, 0.15)) if detail else (0.0, 0.0)
        drum(p, cx + off[0], off[1], za, zb, ra, rb, 16 if detail else 12, rng.uniform(0, 0.2) if detail else 0.0,
             rng.choice(['Kit.gold', 'Kit.gold', 'Kit.warm']) if detail else 'Kit.gold', detail)
    # the capital: a flared echinus under the square abacus
    p.lathe(cx, 0.0, [(4.5, z1), (4.9, z1 + 0.5), (5.5, ABACUS[0])], 16 if detail else 8, ['Kit.warm'], cap_top=False)
    if detail:
        block(p, (cx - 5.8, -5.8, ABACUS[0]), (cx + 5.8, 5.8, ABACUS[1]), 'Kit.gold', 0.25)
    else:
        p.box((cx - 5.8, -5.8, ABACUS[0]), (cx + 5.8, 5.8, ABACUS[1]), 'Kit.gold')


# The lintel's courses as rows of blocks (x0, x1): front row (Blender -y) then back row. Gaps are missing blocks; the
# third course stands highest over the left column (Blender -x), as in the reference, with a lower stack on the right.
LOWER = ([(-22.0, -15.2), (-15.2, -7.4), (-7.4, -0.8), (-0.8, 6.6), (6.6, 13.8), (13.8, 22.0)],
         [(-22.0, -18.0), (-18.0, -10.6), (-10.6, -3.4), (-3.4, 3.2), (3.2, 10.4), (10.4, 17.2), (17.2, 22.0)])
MIDDLE = ([(-21.6, -18.0), (-18.0, -11.2), (-11.2, -4.4), (-4.4, 2.2), (8.6, 15.0), (15.0, 21.6)],
          [(-21.8, -14.6), (-14.6, -7.6), (-7.6, -0.6), (-0.6, 6.2), (6.2, 14.2), (14.2, 20.4)])
UPPER = ([(-21.2, -17.4), (-13.4, -7.8), (14.4, 19.6)],
         [(-20.6, -16.6), (-16.6, -10.2), (-10.2, -4.0), (12.0, 18.0)])
CHIPS = {('mid', 0, 3): {'tr': (1.4, 1.0)}, ('mid', 0, 4): {'tl': (1.0, 0.9)}, ('mid', 1, 5): {'tr': (1.2, 1.0)},
         ('up', 0, 1): {'tr': (1.3, 1.2)}, ('up', 1, 2): {'tr': (1.4, 1.1)}, ('up', 0, 2): {'tl': (1.1, 1.0)},
         ('up', 1, 3): {'tr': (0.9, 1.3)}, ('low', 0, 0): {'bl': (0.9, 0.7)}, ('low', 1, 6): {'br': (1.0, 0.8)}}


def course(p, rows, z0, z1, tag, rng, detail):
    """One lintel course: each row's blocks, some proud or set back, some sagging, a few chipped."""
    for r, row in enumerate(rows):
        y0, y1 = (-LINTEL_Y, 0.0) if r == 0 else (0.0, LINTEL_Y)
        for k, (a, b) in enumerate(row):
            if not detail:
                p.box((a, y0, z0), (b, y1, z1), 'Kit.gold')
                continue
            dy = rng.uniform(-0.35, 0.35)  # the outer face proud or set back
            dz = rng.choice([0.0, 0.0, -0.12, 0.08])
            lo = (a + 0.05, y0 + (dy if r == 0 else 0.0) + 0.04, z0 + dz)
            hi = (b - 0.05, y1 + (dy if r == 1 else 0.0) - 0.04, z1 + dz)
            cut = CHIPS.get((tag, r, k))
            if cut:
                chipped(p, lo, hi, rng.choice(STONES), cut)
            else:
                block(p, lo, hi, rng.choice(STONES), 0.2)


def lintel(p, rng, detail):
    z = COURSES
    course(p, LOWER, z[0], z[1], 'low', rng, detail)
    if detail:  # the ledge along the lower course's top, front and back, broken in three places
        for side in (-1, 1):
            for x0, x1 in ((-21.6, -12.4), (-9.0, 2.2), (5.0, 21.6)) if side < 0 else ((-21.6, -4.0), (-1.2, 21.6)):
                y0, y1 = sorted((side * LINTEL_Y, side * (LINTEL_Y + LEDGE)))
                block(p, (x0, y0 - 0.02 * side, z[1] - 0.7), (x1, y1, z[1] + 0.05), 'Kit.warm', 0.15)
    course(p, MIDDLE, z[1], z[2], 'mid', rng, detail)
    course(p, UPPER, z[2], z[3], 'up', rng, detail)


# Fallen blocks: (centre x, centre y, length, depth, height, yaw, tilt), clear of the walk (|x| > 10.5).
FALLEN = [(-16.5, -8.0, 5.0, 2.6, 2.4, 0.30, 0.0), (-20.6, -7.0, 3.0, 2.2, 2.0, 1.2, 0.25),
          (18.0, -7.8, 5.4, 2.8, 2.6, -0.22, 0.12), (20.6, 6.9, 3.0, 2.4, 2.2, 0.9, 0.0),
          (13.6, 8.0, 4.6, 2.4, 2.4, 0.18, -0.2), (-17.0, 7.6, 4.2, 2.8, 2.6, -0.5, 0.0),
          (-12.2, -8.2, 1.8, 1.5, 1.3, 0.7, 0.3),
          (12.6, -8.6, 1.7, 1.4, 1.2, -0.9, 0.25), (-11.8, 8.2, 1.6, 1.4, 1.2, 1.1, 0.0), (18.8, 8.4, 1.8, 1.5, 1.4, 0.4, -0.35)]


def fallen(p, rng, detail):
    for x, y, ln, dp, ht, yaw, tilt in FALLEN:
        # its lowest corner on the ground (stand() puts the lowest point at y = 0: nothing may sink below it)
        drop = (dp / 2) * abs(math.sin(tilt)) + (ht / 2) * math.cos(tilt)
        go = placer((x, y, drop), yaw, tilt)
        if detail:
            block(p, (-ln / 2, -dp / 2, -ht / 2), (ln / 2, dp / 2, ht / 2), rng.choice(STONES[1:]), 0.22, go)
        else:  # a plain box: each face's four corners in order round it
            h = (ln / 2, dp / 2, ht / 2)
            centre = go((0.0, 0.0, 0.0))
            for axis in range(3):
                a, b = [i for i in range(3) if i != axis]
                for sign in (-1, 1):
                    quad = []
                    for sa, sb in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                        s = [0, 0, 0]
                        s[axis], s[a], s[b] = sign, sa, sb
                        quad.append(go(tuple(s[i] * h[i] for i in range(3))))
                    outward(p, quad, 'Kit.warm', centre)


def build(detail):
    p = Piece()
    rng = random.Random(SEED)
    for s in (-1, 1):
        column(p, s * COL_X, rng, detail)
    lintel(p, rng, detail)
    fallen(p, rng, detail)
    return p


def bleach(slot, poly):
    """Sun-bleached cream on every up-facing face."""
    return 'cream' if poly.normal.z > 0.6 else slot


class Calm:
    """The shade jitter, halved: the drums' flutes and the blocks' faces read as clean facets, not noise."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'gateway-atlas')
    near = finish(build(True), 'gateway', Calm(SEED), SWATCHES, bleach)
    far = finish(build(False), 'gateway-far', Calm(SEED), SWATCHES, bleach)
    for obj in (near, far):
        xs, ys, zs = ([v.co[i] for v in obj.data.vertices] for i in range(3))
        print(f'{obj.name}: {triangles(obj)} triangles, x {min(xs):.2f}..{max(xs):.2f}, y {min(ys):.2f}..{max(ys):.2f}, '
              f'z {min(zs):.2f}..{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
