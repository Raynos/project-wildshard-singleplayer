"""clocktower.py <out-dir>: Clockwork Canyon's landmark as a Blender script (OPEN-PLOTS OP19): the brass-and-verdigris clock
tower with its gears on the plaza (art/grid/round-62-open-plot-palettes/11-clockwork-canyon.jpg).

Blocky painted low poly (the open plots' kit idiom) in the canyon's brass and verdigris: a two-course pink sandstone
plinth with a stair up the front, a square verdigris tower in three stages banded and cornered in brass, a cream clock
face with dark hands and brass numerals on each side of the clock stage, a brass gear train climbing either flank (big
toothed wheels on axles), an open belfry over it and a verdigris dome with a brass lantern and finial. Gears and dials
read cleanly only as a script (image-to-3D smears teeth and hands), so the tower is scripted. Every face samples the
swatch atlas (landmarklib.py). The far model keeps the plinth, the stages, the dials and the gears as plain discs.

Exports landmark.glb (near) and landmark-far.glb, in metres: 36 m tall, plinth 24 m square, the stair's foot 4 m proud
of it; pivot at the base centre, the stair up the front (Blender -Y, glTF +Z; the layout turns it to face the south entry).
Run: bash scripts/blender/build.sh open-plots/clocktower.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 17
# sRGB swatches, lightest first (judged against the round-62 board: brass, verdigris, sandstone, cream dials)
SWATCHES = {
    'brass': ['#f0c460', '#d8a640', '#b8862c', '#946820'],
    'verdigris': ['#4aa898', '#3a9082', '#2c766a', '#205c52'],
    'sand': ['#e0b0a4', '#cc9a8e', '#b08276', '#90685e'],
    'cream': ['#fbf2dc', '#efe2c4', '#dccfae', '#c2b494'],
    'dark': ['#2c2a28', '#22201e', '#1a1816', '#121110'],
}
PLINTH, COURSE = 12.0, 1.0
BASE = 2 * COURSE
STAGES = [(5.0, 0.0, 9.0, 'Kit.verdigris'), (4.4, 9.0, 18.0, 'Kit.verdigris'), (3.8, 18.0, 24.0, 'Kit.verdigris')]
CLOCK = (13.5, 3.2)  # the dials' centre height above the plinth and their radius


def plinth(p, detail):
    for k, inset in enumerate((0.0, 1.4)):
        h = PLINTH - inset
        p.box((-h, -h, k * COURSE), (h, h, (k + 1) * COURSE), 'Kit.sand')
    steps = 5 if detail else 2
    rise, run, half = BASE / steps, 4.0 / steps, 3.5
    for s in range(steps):
        y0 = -PLINTH - 4.0 + s * run
        p.box((-half, y0, 0.0), (half, -PLINTH + 0.01, (s + 1) * rise), 'Kit.sand')
    p.box((-1.4, -STAGES[0][0] - 0.12, BASE), (1.4, -STAGES[0][0] + 0.2, BASE + 4.0), 'Kit.dark')  # the door


def tower(p, detail):
    """Three square verdigris stages, each with a brass band at its foot and brass corner posts, and the dials."""
    for half, z0, z1, slot in STAGES:
        p.box((-half, -half, BASE + z0), (half, half, BASE + z1), slot)
        p.box((-half - 0.3, -half - 0.3, BASE + z1 - 0.6), (half + 0.3, half + 0.3, BASE + z1), 'Kit.brass')
        if detail:
            for sx in (-1, 1):
                for sy in (-1, 1):
                    p.box((sx * half - 0.35, sy * half - 0.35, BASE + z0), (sx * half + 0.35, sy * half + 0.35, BASE + z1), 'Kit.brass')
    half = STAGES[1][0]
    zc, r = BASE + CLOCK[0], CLOCK[1]
    for k in range(4):  # a dial on each face: a brass rim, a cream face, two dark hands
        a = k * math.pi / 2
        nx, ny = -math.sin(a), -math.cos(a)  # the face's outward normal: front (-y) first
        tx, ty = -ny, nx
        def at(u, v, d):
            return (nx * (half + d) + tx * u, ny * (half + d) + ty * u, zc + v)
        sides = 20 if detail else 10
        for i in range(sides):
            a0, a1 = 2 * math.pi * i / sides, 2 * math.pi * (i + 1) / sides
            p.face([at(0, 0, 0.08), at(r * math.cos(a0), r * math.sin(a0), 0.08), at(r * math.cos(a1), r * math.sin(a1), 0.08)][::-1 if k % 2 else 1], 'Kit.cream')
            p.face([at(r * math.cos(a0), r * math.sin(a0), 0.1), at((r + 0.45) * math.cos(a0), (r + 0.45) * math.sin(a0), 0.1),
                    at((r + 0.45) * math.cos(a1), (r + 0.45) * math.sin(a1), 0.1), at(r * math.cos(a1), r * math.sin(a1), 0.1)][::-1 if k % 2 else 1], 'Kit.brass')
        if detail:  # the hands: ten past ten
            for ang, length, w in ((math.radians(60), r * 0.62, 0.22), (math.radians(150), r * 0.86, 0.14)):
                ex, ey = math.cos(ang) * length, math.sin(ang) * length
                px, py = -math.sin(ang) * w, math.cos(ang) * w
                p.face([at(-px, -py, 0.14), at(ex - px, ey - py, 0.14), at(ex + px, ey + py, 0.14), at(px, py, 0.14)][::-1 if k % 2 else 1], 'Kit.dark')


def gear(p, cx, cy, cz, r, teeth, depth, axis_x, slot, detail):
    """A toothed wheel of radius `r` about (cx, cy, cz), its axle along x (`axis_x`) or y, `depth` thick."""
    n = teeth * 2 if detail else teeth
    def ring(rr, d):
        pts = []
        for i in range(n):
            a = 2 * math.pi * i / n
            rad = rr if (not detail or i % 2 == 0) else rr * 0.86
            u, v = rad * math.cos(a), rad * math.sin(a)
            pts.append((cx + d, cy + u, cz + v) if axis_x else (cx + u, cy + d, cz + v))
        return pts
    front, back = ring(r, -depth / 2), ring(r, depth / 2)
    for i in range(n):
        j = (i + 1) % n
        p.face([front[i], front[j], back[j], back[i]] if axis_x else [back[i], back[j], front[j], front[i]], slot)
    p.face(front if axis_x else list(reversed(front)), slot)
    p.face(list(reversed(back)) if axis_x else back, slot)


def gears(p, detail):
    """A gear train up each flank (x = +-) of the tower: three brass wheels meshing up it, a hub on each."""
    half = STAGES[0][0]
    for sx in (-1, 1):
        for cz, r, y in ((BASE + 5.0, 3.4, -1.2), (BASE + 10.5, 2.4, 1.6), (BASE + 15.0, 1.8, -0.6)):
            x = sx * (half + 0.6)
            gear(p, x, y, cz, r, 10, 0.6, True, 'Kit.brass', detail)
            if detail:
                gear(p, x + sx * 0.35, y, cz, r * 0.3, 6, 0.4, True, 'Kit.verdigris', False)


def crown(p, detail):
    """An open belfry of four brass posts, a verdigris dome, a brass lantern and finial."""
    half, top = STAGES[2][0], BASE + STAGES[2][2]
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((sx * (half - 0.6) - 0.4, sy * (half - 0.6) - 0.4, top), (sx * (half - 0.6) + 0.4, sy * (half - 0.6) + 0.4, top + 4.0), 'Kit.brass')
    p.box((-half - 0.2, -half - 0.2, top + 4.0), (half + 0.2, half + 0.2, top + 4.6), 'Kit.brass')
    sides = 16 if detail else 8
    z = top + 4.6
    p.lathe(0.0, 0.0, [(half - 0.2, z), (half - 0.6, z + 2.0), (half - 1.6, z + 3.6), (1.0, z + 4.6), (0.0, z + 5.0)], sides, ['Kit.verdigris'])
    p.prism(0.0, 0.0, 0.6, 0.6, z + 4.7, z + 6.0, 6, 'Kit.brass')
    p.prism(0.0, 0.0, 0.15, 0.02, z + 6.0, z + 7.4, 4, 'Kit.brass')


def build(detail):
    p = Piece()
    plinth(p, detail)
    tower(p, detail)
    gears(p, detail)
    crown(p, detail)
    return p


class Calm:
    """The shade jitter, halved: the painted metal reads as clean flat colour."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'clocktower-atlas')
    near = finish(build(True), 'clocktower', Calm(SEED), SWATCHES)
    far = finish(build(False), 'clocktower-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
