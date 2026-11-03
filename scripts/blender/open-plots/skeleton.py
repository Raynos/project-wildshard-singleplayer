"""skeleton.py <out-dir>: Fossil Badlands' landmark as a Blender script (OPEN-PLOTS OP21): the colossal dragon skeleton in
its stepped excavation pit on the plaza (art/grid/round-75-new-plot-palettes/06-fossil-badlands.jpg).

Blocky painted low poly (the open plots' kit idiom) at the blue hour: a raised square rim of banded clay (oxblood, mustard
and cream courses) whose three terraces step down to the dig floor, a stair up over its front and down inside, and on its floor a bone-white dragon: a spine of
faceted vertebrae rising from the tail at the back to a raised neck and a horned skull facing the stair, its jaw open, ribs
arching high either side of the chest, the shoulder and hip girdles and four splayed limbs. Timber scaffolding with ladders
stands against two flanks. Bones read cleanly only as a script (image-to-3D melts thin ribs), so the skeleton is scripted.
Every face samples the swatch atlas (landmarklib.py). The far model keeps the pit, spine, ribs and skull with fewer facets
and no scaffolding.

Exports landmark.glb (near) and landmark-far.glb, in metres: about 33 m tall (the skull's horns), the rim 62 m square and
6.5 m high, the stair's foot 6 m proud of it; pivot at the base centre, the skull and stair to the front (Blender -Y, glTF +Z; the layout turns it to
face the south entry). Run: bash scripts/blender/build.sh open-plots/skeleton.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 21
# sRGB swatches, lightest first (judged against the round-75 board's blue hour)
SWATCHES = {
    'bone': ['#f4ecdc', '#e2d8c4', '#c8bca6', '#a89c88'],
    'oxblood': ['#a8443c', '#923830', '#782c26', '#5e221e'],
    'mustard': ['#e0a840', '#c89032', '#a87626', '#865c1c'],
    'cream': ['#e8d8b8', '#d4c2a0', '#b8a684', '#988868'],
    'charcoal': ['#5a5260', '#4a4450', '#3a3640', '#2c2832'],
    'wood': ['#9a6a40', '#845a36', '#6c482c', '#543822'],
}
PIT = 31.0  # the rim's outer half size
FLOOR = 0.0  # the dig floor (the plaza's level: the landmark stands its lowest point on y = 0)
INNER = 21.0  # the dig floor's half size
STEPS = 3
RISE = 2.0  # each terrace's height: the rim stands STEPS * RISE over the plaza


def beam(p, a, b, w, slot):
    """A square beam `w` wide from `a` to `b` (four sides, both ends capped)."""
    d = [b[i] - a[i] for i in range(3)]
    length = math.sqrt(sum(c * c for c in d)) or 1.0
    d = [c / length for c in d]
    ref = (0.0, 0.0, 1.0) if abs(d[2]) < 0.9 else (1.0, 0.0, 0.0)
    u = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]]
    ul = math.sqrt(sum(c * c for c in u)) or 1.0
    u = [c / ul * w / 2 for c in u]
    v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]
    corners = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
    end = lambda o, s, t: tuple(o[i] + s * u[i] + t * v[i] for i in range(3))
    lo = [end(a, s, t) for s, t in corners]
    hi = [end(b, s, t) for s, t in corners]
    for i in range(4):
        j = (i + 1) % 4
        p.face([lo[i], lo[j], hi[j], hi[i]], slot)
    p.face(list(reversed(lo)), slot)
    p.face(hi, slot)


def wall(p, h, z0, z1, slot, outward=False):
    """The four faces of a square wall of half size `h` from `z0` to `z1`, facing the pit's middle (or out)."""
    for (ax, ay), (bx, by) in (((-h, -h), (h, -h)), ((h, -h), (h, h)), ((h, h), (-h, h)), ((-h, h), (-h, -h))):
        quad = [(bx, by, z0), (ax, ay, z0), (ax, ay, z1), (bx, by, z1)]
        p.face(list(reversed(quad)) if outward else quad, slot)


def band(p, x0, y0, x1, y1, z, slot):
    p.face([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], slot)


def pit(p, detail):
    """A raised clay rim whose three terraces step down inward to the dig floor, the walls in oxblood, mustard and cream
    courses, a charcoal coping on the rim, and a stair up over the front rim and down to the floor."""
    bands = ['Kit.oxblood', 'Kit.mustard', 'Kit.cream']
    step = (PIT - INNER) / STEPS
    band(p, -INNER, -INNER, INNER, INNER, FLOOR, 'Kit.cream')
    for k in range(STEPS):
        h0, h1, z1 = INNER + k * step, INNER + (k + 1) * step, FLOOR + (k + 1) * RISE
        z0 = z1 - RISE
        courses = 2 if detail else 1
        for c in range(courses):
            wall(p, h0, z0 + RISE * c / courses, z0 + RISE * (c + 1) / courses, bands[(k + c) % 3])
        for (x0, y0, x1, y1) in ((-h1, -h1, h1, -h0), (-h1, h0, h1, h1), (-h1, -h0, -h0, h0), (h0, -h0, h1, h0)):
            band(p, x0, y0, x1, y1, z1, 'Kit.cream')  # the terrace tread
    top = FLOOR + STEPS * RISE
    for c in range(6 if detail else 2):  # the outer face in strata
        n = 6 if detail else 2
        wall(p, PIT, top * c / n, top * (c + 1) / n, bands[c % 3], outward=True)
    for (x0, y0, x1, y1) in ((-PIT - 0.6, -PIT - 0.6, PIT + 0.6, -PIT + 0.6), (-PIT - 0.6, PIT - 0.6, PIT + 0.6, PIT + 0.6),
                             (-PIT - 0.6, -PIT + 0.6, -PIT + 0.6, PIT - 0.6), (PIT - 0.6, -PIT + 0.6, PIT + 0.6, PIT - 0.6)):
        p.box((x0, y0, top), (x1, y1, top + 0.5), 'Kit.charcoal')
    n = 10 if detail else 3
    for s in range(n):  # the outer flight up the front (-Y) to the rim, then the inner flight down to the floor
        t = (s + 1) / n
        p.box((-4.0, -PIT - 6.0 + s * 6.0 / n, FLOOR), (4.0, -PIT, FLOOR + t * (top + 0.5)), 'Kit.cream')
        p.box((-4.0, -PIT, FLOOR), (4.0, -PIT + (PIT - INNER) * (1 - s / n), FLOOR + (top + 0.5) * (1 - t) + 0.01), 'Kit.cream')


def spine_point(t):
    """The spine's line, tail (t = 0, back) to the base of the skull (t = 1, front): low along the floor, rising over the
    chest, the neck arching up and forward."""
    y = 22.0 - 36.0 * t
    rise = min(1.0, max(0.0, (t - 0.55) / 0.45))
    z = FLOOR + 2.0 + 13.0 * math.exp(-((t - 0.42) / 0.22) ** 2) + 18.0 * rise * rise * (3 - 2 * rise)
    return (0.0, y, z)


def skeleton(p, detail):
    """The vertebrae, ribs, girdles, limbs and skull, bone white."""
    n = 30 if detail else 14
    for i in range(n):
        t = i / (n - 1)
        x, y, z = spine_point(t)
        r = 0.9 + 1.5 * math.sin(math.pi * min(1.0, t * 1.3))
        p.box((x - r, y - 0.5, z - r * 0.6), (x + r, y + 0.5, z + r * 0.6), 'Kit.bone')
        if detail:
            p.box((x - 0.25, y - 0.3, z + r * 0.6), (x + 0.25, y + 0.3, z + r * 0.6 + r * 1.2), 'Kit.bone')  # the spine's ridge
    ribs = 9 if detail else 5
    for i in range(ribs):  # ribs arching down from the chest's vertebrae either side
        t = 0.3 + 0.32 * i / (ribs - 1)
        sx, sy, sz = spine_point(t)
        reach = 12.0 * math.sin(math.pi * (0.15 + 0.7 * i / (ribs - 1)))
        segs = 5 if detail else 3
        for side in (-1, 1):
            prev = (sx, sy, sz)
            for k in range(1, segs + 1):
                a = math.pi * 0.5 * k / segs
                q = (side * reach * math.sin(a), sy, sz + 2.0 - (sz - FLOOR - 0.8) * (1 - math.cos(a)) * 1.05)
                beam(p, prev, q, 1.0 if detail else 1.3, 'Kit.bone')
                prev = q
    for t, span in ((0.3, 9.0), (0.12, 8.0)):  # the shoulder and hip girdles and splayed limbs
        gx, gy, gz = spine_point(t)
        for side in (-1, 1):
            knee = (side * span, gy - 1.5, FLOOR + 5.5)
            foot = (side * (span + 3.5), gy - 4.5, FLOOR + 0.6)
            beam(p, (gx, gy, gz), knee, 1.5, 'Kit.bone')
            beam(p, knee, foot, 1.2, 'Kit.bone')
            p.box((foot[0] - 1.5, foot[1] - 2.0, FLOOR), (foot[0] + 1.5, foot[1] + 0.9, FLOOR + 0.6), 'Kit.bone')
    hx, hy, hz = spine_point(1.0)  # the skull, facing the stair, its jaw open, two swept horns
    k = 1.6
    p.box((hx - 2.6 * k, hy - 6.0 * k, hz - 1.0 * k), (hx + 2.6 * k, hy, hz + 2.4 * k), 'Kit.bone')
    p.box((hx - 1.8 * k, hy - 9.0 * k, hz - 0.2 * k), (hx + 1.8 * k, hy - 6.0 * k, hz + 1.4 * k), 'Kit.bone')  # the snout
    p.box((hx - 1.6 * k, hy - 8.4 * k, hz - 3.4 * k), (hx + 1.6 * k, hy - 1.0 * k, hz - 2.2 * k), 'Kit.bone')  # the open jaw
    if detail:
        for side in (-1, 1):
            p.box((hx + side * 2.6 * k - 0.02, hy - 4.6 * k, hz + 0.2 * k), (hx + side * 2.6 * k + 0.02, hy - 3.2 * k, hz + 1.4 * k), 'Kit.charcoal')  # the eyes
    for side in (-1, 1):
        beam(p, (hx + side * 1.8 * k, hy - 1.0 * k, hz + 2.2 * k), (hx + side * 3.6 * k, hy + 3.5 * k, hz + 6.5 * k), 0.8 * k, 'Kit.bone')


def scaffold(p):
    """Timber scaffolding with ladders against two flanks of the skeleton, standing on the pit floor."""
    for side in (-1, 1):
        x0, x1 = side * 14.0, side * 18.0
        for y in (-6.0, 2.0):
            for x in (x0, x1):
                beam(p, (x, y, FLOOR), (x, y, FLOOR + 12.0), 0.35, 'Kit.wood')
        for z in (FLOOR + 6.0, FLOOR + 12.0):
            p.box((min(x0, x1), -6.2, z - 0.2), (max(x0, x1), 2.2, z), 'Kit.wood')
        lx = side * 8.6
        for y in (-3.2, -1.8):
            beam(p, (lx, y, FLOOR), (lx, y, FLOOR + 12.0), 0.18, 'Kit.wood')
        for r in range(12):
            p.box((lx - 0.08, -3.2, FLOOR + 0.5 + r), (lx + 0.08, -1.8, FLOOR + 0.62 + r), 'Kit.wood')


def build(detail):
    p = Piece()
    pit(p, detail)
    skeleton(p, detail)
    if detail:
        scaffold(p)
    return p


class Calm:
    """The shade jitter, halved: the painted bone and clay read as clean flat colour."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'skeleton-atlas')
    near = finish(build(True), 'skeleton', Calm(SEED), SWATCHES)
    far = finish(build(False), 'skeleton-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
