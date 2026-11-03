"""racetower.py <out-dir>: Floating Island Race's landmark as a Blender script (OPEN-PLOTS OP22): the race control tower
behind its striped start arch on the plaza (art/grid/round-62-open-plot-palettes/15-sky-race.jpg).

Blocky painted low poly (the open plots' kit idiom) at a saturated cobalt high noon: two 30 m pylons banded red and
white, a checkered flag on a pole atop each, joined by a semicircular start arch of red and white segments over a blue
soffit; behind the arch a white shaft rises to a stack of three blue control-room floors with dark glass and white
bands, a white crown and an antenna mast; all on a white deck with a blue edge and a stair up its front. The far model
keeps the pylons, arch, shaft and control floors with fewer faces. Every face samples the swatch atlas (landmarklib.py).

Exports landmark.glb (near) and landmark-far.glb, in metres: 42 m tall (the mast), 28 m wide across the pylons; pivot at
the base centre, the arch to the front (Blender -Y, glTF +Z; the layout turns it to face the south entry).
Run: bash scripts/blender/build.sh open-plots/racetower.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 22
# sRGB swatches, lightest first (judged against the round-62 board's cobalt noon)
SWATCHES = {
    'red': ['#f04848', '#d8322e', '#b02420', '#881a18'],
    'white': ['#ffffff', '#eef0f4', '#d4d8e2', '#b4bac8'],
    'blue': ['#4a78f0', '#2e5ad8', '#2244b0', '#183288'],
    'glass': ['#5a8ad0', '#3a64a8', '#284a84', '#1a3260'],
    'black': ['#3a3c44', '#2a2c32', '#1e2024', '#141518'],
    'steel': ['#c8ccd4', '#a8aeba', '#888e9c', '#686e7c'],
}
DECK = 0.8  # the deck's height
PYLON_X, PYLON_W, PYLON_H = 11.0, 2.0, 30.0  # each pylon's axis, its half width and its top over the deck


def checker(p, x, y, z, w, h, n, m):
    """A checkered flag `w` x `h` hung from (x, y, z) at its top-left, `n` by `m` squares, seen from both sides."""
    for i in range(n):
        for j in range(m):
            slot = 'Kit.black' if (i + j) % 2 == 0 else 'Kit.white'
            x0, x1, z1, z0 = x + w * i / n, x + w * (i + 1) / n, z - h * j / m, z - h * (j + 1) / m
            p.panel([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], slot)


def pylon(p, sx, detail):
    """A pylon banded red and white every 3 m, a flagpole and checkered flag on top."""
    x0, x1 = sx * PYLON_X - PYLON_W, sx * PYLON_X + PYLON_W
    bands = 10 if detail else 5
    for k in range(bands):
        z0, z1 = DECK + PYLON_H * k / bands, DECK + PYLON_H * (k + 1) / bands
        p.box((x0, -PYLON_W, z0), (x1, PYLON_W, z1), 'Kit.red' if k % 2 == 0 else 'Kit.white')
    top = DECK + PYLON_H
    p.prism(sx * PYLON_X, 0, 0.12, 0.1, top, top + 6.0, 6, 'Kit.steel')
    checker(p, sx * PYLON_X + (0.1 if sx > 0 else -4.6), 0, top + 5.8, 4.5, 3.0, 6 if detail else 3, 4 if detail else 2)


def arch(p, detail):
    """The start arch between the pylons: red and white segments round a semicircle over a blue soffit, 3 m deep."""
    n = 14 if detail else 7
    ro, ri, cz, d = PYLON_X - PYLON_W, PYLON_X - PYLON_W - 2.2, DECK + 6.0, 1.6
    pt = lambda a, r, y: (r * math.cos(a), y, cz + r * math.sin(a))
    for k in range(n):
        a0, a1 = math.pi * k / n, math.pi * (k + 1) / n
        slot = 'Kit.red' if k % 2 == 0 else 'Kit.white'
        p.face([pt(a0, ro, -d), pt(a1, ro, -d), pt(a1, ro, d), pt(a0, ro, d)][::-1], slot)  # the outer face
        p.face([pt(a0, ri, -d), pt(a1, ri, -d), pt(a1, ri, d), pt(a0, ri, d)], 'Kit.blue')  # the soffit
        for y in (-d, d):  # its front and back faces
            quad = [pt(a0, ri, y), pt(a1, ri, y), pt(a1, ro, y), pt(a0, ro, y)]
            p.face(quad if y < 0 else quad[::-1], slot)
    for sx in (-1, 1):  # the arch's legs down to the deck
        x0, x1 = sorted((sx * ri, sx * ro))
        p.box((x0, -d, DECK), (x1, d, cz), 'Kit.white')


def control(p, detail):
    """The control tower behind the arch: a white shaft, three blue control floors with dark glass and white bands, a
    white crown and an antenna mast."""
    y = 6.0
    p.box((-2.4, y - 2.4, DECK), (2.4, y + 2.4, 24.0), 'Kit.white')
    z = 24.0
    for k in range(3):
        w = 5.5 - 0.5 * k
        p.box((-w - 0.3, y - 4.3, z), (w + 0.3, y + 4.3, z + 0.5), 'Kit.white')
        p.box((-w, y - 4.0, z + 0.5), (w, y + 4.0, z + 3.0), 'Kit.blue')
        if detail:
            p.box((-w + 0.6, y - 4.05, z + 1.1), (w - 0.6, y - 3.98, z + 2.6), 'Kit.glass')
        z += 3.0
    p.box((-3.6, y - 3.0, z), (3.6, y + 3.0, z + 1.5), 'Kit.white')
    p.prism(0, y, 1.4, 0.6, z + 1.5, z + 3.0, 8, 'Kit.blue')
    p.prism(0, y, 0.2, 0.08, z + 3.0, 42.0, 6, 'Kit.steel')


def deck(p, detail):
    """The deck: white with a blue edge, a stair up its front."""
    p.box((-16.0, -9.0, 0.0), (16.0, 11.0, DECK - 0.15), 'Kit.blue')
    p.box((-15.8, -8.8, DECK - 0.15), (15.8, 10.8, DECK), 'Kit.white')
    if detail:
        for s in range(4):
            t = (s + 1) / 4
            p.box((-6.0, -9.0 - 2.0 + s * 0.5, 0.0), (6.0, -9.0, DECK * t), 'Kit.white')


def build(detail):
    p = Piece()
    deck(p, detail)
    for sx in (-1, 1):
        pylon(p, sx, detail)
    arch(p, detail)
    control(p, detail)
    return p


class Calm:
    """The shade jitter, halved: the painted stripes read as clean flat colour."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'racetower-atlas')
    near = finish(build(True), 'racetower', Calm(SEED), SWATCHES)
    far = finish(build(False), 'racetower-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
