"""clockwork.py <out-dir>: Clockwork Canyon's theme kit family (OPEN-PLOTS OP19), in kit.py's format (kitlib.py), retinted by a
layout's palette like every kit family. Target: art/grid/round-62-open-plot-palettes/11-clockwork-canyon.jpg.

`clockwork`, three variants in the canyon's brass, verdigris and timber:
- 0 waterwheel: a 7 m brass-rimmed wheel of timber paddles on a brass axle, its axle along x, standing on its two
  sandstone piers (the generator sets it on a canal's bank, its lower paddles in the water);
- 1 boiler: a verdigris boiler drum on brass saddles, banded in brass, a tall brass smokestack with a flared cap, a pipe
  run and a lit gauge (the steam is the generator's);
- 2 gear works: a big brass gear and a small one meshing on a verdigris frame, a brass pipe arching over them.
Run: bash scripts/blender/build.sh open-plots/clockwork.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS  # noqa: E402

# Slots a layout may not define (sRGB); the palette's own colour wins.
CLOCK_SLOTS = {**SLOTS, 'brass': '#d8a640', 'verdigris': '#3a9082', 'sand': '#cc9a8e', 'paddle': '#7a5232',
               'gauge': '#fff1c0'}
CLOCK_TRIMS = {**TRIMS, 'sand': 'stone', 'paddle': 'timber'}


def gear(p, cx, cy, cz, r, teeth, depth, slot):
    """A toothed wheel about (cx, cy, cz), its axle along x, `depth` thick."""
    n = teeth * 2
    def ring(d):
        return [(cx + d, cy + (r if i % 2 == 0 else r * 0.84) * math.cos(2 * math.pi * i / n),
                 cz + (r if i % 2 == 0 else r * 0.84) * math.sin(2 * math.pi * i / n)) for i in range(n)]
    a, b = ring(-depth / 2), ring(depth / 2)
    for i in range(n):
        j = (i + 1) % n
        p.face([a[i], a[j], b[j], b[i]], slot)
    p.face(a, slot)
    p.face(list(reversed(b)), slot)


def waterwheel():
    """Variant 0: the wheel on its piers, its axle along x, its centre 3.4 m up."""
    p = Piece()
    cz, r, w = 3.4, 3.4, 1.6
    for x in (-w / 2 - 0.9, w / 2 + 0.4):  # the sandstone piers
        p.box((x, -0.8, 0.0), (x + 0.5, 0.8, cz + 0.4), 'Kit.sand')
    p.box((-w / 2 - 1.1, -0.3, cz - 0.3), (w / 2 + 1.1, 0.3, cz + 0.3), 'Kit.brass')  # the axle, along x
    # the two brass rims and the timber paddles between them (in the y-z plane, the wheel turning about x)
    paddles = 12
    for side in (-w / 2, w / 2):
        n = 24
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            q = [(side, (r - 0.3) * math.cos(a0), cz + (r - 0.3) * math.sin(a0)), (side, r * math.cos(a0), cz + r * math.sin(a0)),
                 (side, r * math.cos(a1), cz + r * math.sin(a1)), (side, (r - 0.3) * math.cos(a1), cz + (r - 0.3) * math.sin(a1))]
            p.panel(q, 'Kit.brass')
        for i in range(6):  # spokes
            a = 2 * math.pi * i / 6
            p.panel([(side, -0.12 * math.sin(a), cz + 0.12 * math.cos(a)), (side, 0.12 * math.sin(a), cz - 0.12 * math.cos(a)),
                     (side, (r - 0.3) * math.cos(a) + 0.12 * math.sin(a), cz + (r - 0.3) * math.sin(a) - 0.12 * math.cos(a)),
                     (side, (r - 0.3) * math.cos(a) - 0.12 * math.sin(a), cz + (r - 0.3) * math.sin(a) + 0.12 * math.cos(a))], 'Kit.brass')
    for i in range(paddles):
        a = 2 * math.pi * i / paddles
        y0, z0 = (r - 0.9) * math.cos(a), cz + (r - 0.9) * math.sin(a)
        y1, z1 = (r + 0.2) * math.cos(a), cz + (r + 0.2) * math.sin(a)
        p.panel([(-w / 2, y0, z0), (w / 2, y0, z0), (w / 2, y1, z1), (-w / 2, y1, z1)], 'Kit.paddle')
    return p


def boiler():
    """Variant 1: the boiler, its drum along y, the stack at its back (Blender +y), a gauge on its front."""
    p = Piece()
    for y in (-1.8, 1.4):
        p.box((-1.5, y, 0.0), (1.5, y + 0.4, 1.0), 'Kit.brass')
    sides = 12
    for k in range(sides):  # the drum, a prism along y
        a0, a1 = 2 * math.pi * k / sides, 2 * math.pi * (k + 1) / sides
        at = lambda a, y: (1.4 * math.cos(a), y, 2.4 + 1.4 * math.sin(a))
        p.face([at(a0, -2.4), at(a1, -2.4), at(a1, 2.4), at(a0, 2.4)][::-1], 'Kit.verdigris')
    p.face([(1.4 * math.cos(2 * math.pi * k / sides), -2.4, 2.4 + 1.4 * math.sin(2 * math.pi * k / sides)) for k in range(sides)], 'Kit.brass')
    p.face([(1.4 * math.cos(2 * math.pi * k / sides), 2.4, 2.4 + 1.4 * math.sin(2 * math.pi * k / sides)) for k in reversed(range(sides))], 'Kit.brass')
    for y in (-1.2, 0.0, 1.2):  # brass bands: thin rings round the drum
        for k in range(sides):
            a0, a1 = 2 * math.pi * k / sides, 2 * math.pi * (k + 1) / sides
            ring = lambda a, yy: (1.5 * math.cos(a), yy, 2.4 + 1.5 * math.sin(a))
            p.face([ring(a0, y - 0.15), ring(a1, y - 0.15), ring(a1, y + 0.15), ring(a0, y + 0.15)][::-1], 'Kit.brass')
    p.prism(0.0, 1.6, 0.5, 0.42, 3.4, 10.0, 8, 'Kit.brass', cap_top=False)
    p.prism(0.0, 1.6, 0.42, 0.75, 10.0, 10.6, 8, 'Kit.brass', cap_top=False)
    p.box((-0.3, -2.55, 2.6), (0.3, -2.42, 3.2), 'Glow.gauge')
    p.emitter((0.0, -2.8, 2.9), 'gauge')
    for x in (-1.0, 1.0):  # a pipe run down the side to the ground
        p.box((x * 1.5 - 0.15, -0.15, 0.0), (x * 1.5 + 0.15, 0.15, 3.0), 'Kit.brass')
    return p


def works():
    """Variant 2: two meshing gears on a verdigris frame, a pipe arching over them."""
    p = Piece()
    p.box((-0.6, -3.2, 0.0), (0.6, 3.2, 0.6), 'Kit.verdigris')
    for y in (-2.6, 2.6):
        p.box((-0.3, y - 0.3, 0.6), (0.3, y + 0.3, 4.6), 'Kit.verdigris')
    gear(p, 0.0, -0.8, 3.0, 2.2, 12, 0.5, 'Kit.brass')
    gear(p, 0.0, 2.1, 2.2, 1.1, 8, 0.5, 'Kit.brass')
    for k in range(10):  # the arching pipe
        a0, a1 = math.pi * k / 10, math.pi * (k + 1) / 10
        y0, z0, y1, z1 = -3.0 * math.cos(a0), 4.6 + 1.6 * math.sin(a0), -3.0 * math.cos(a1), 4.6 + 1.6 * math.sin(a1)
        p.box((-0.2, min(y0, y1) - 0.1, min(z0, z1) - 0.1), (0.2, max(y0, y1) + 0.1, max(z0, z1) + 0.1), 'Kit.brass')
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'clockwork', [waterwheel, boiler, works], CLOCK_TRIMS, {'slots': CLOCK_SLOTS})


if __name__ == '__main__':
    main()
