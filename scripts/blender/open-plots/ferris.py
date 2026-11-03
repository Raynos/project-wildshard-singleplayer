"""ferris.py <out-dir>: Patchwork Fairground's landmark as a Blender script (OPEN-PLOTS OP7): the giant Ferris wheel on
its square plinth at the plaza (art/grid/round-75-new-plot-palettes/03-patchwork-fairground.jpg).

Blocky painted low poly (the open plots' kit idiom) in the fair's toy primaries: a two-course cream stone plinth with a
broad stair up the front, two red A-frame legs (a pair in front of the wheel, a pair behind it) meeting at a sunflower
hub, a white double rim braced by a zigzag lattice and 16 spokes a side, and 12 gondolas hanging under it in turn red,
sunflower and royal blue, each with a white roof, a dark window band and a white hanger. Thin lattice and spokes read
cleanly only as a script (image-to-3D smears them), so the wheel is scripted. Every face samples the swatch atlas
(landmarklib.py). The far model keeps the plinth, legs, hub, rims and gondolas with fewer segments and no lattice.

Exports landmark.glb (near) and landmark-far.glb, in metres: 42 m tall, plinth 26 m square, the stair's foot 4 m proud of
it; pivot at the base centre, the stair up the front (Blender -Y, glTF +Z; the layout turns it to face the south entry).
Run: bash scripts/blender/build.sh open-plots/ferris.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 7
# sRGB swatches, lightest first (judged against the round-75 board's toy primaries)
SWATCHES = {
    'red': ['#e8443a', '#d0362e', '#b02a24', '#8c201c'],
    'yellow': ['#ffd23a', '#f4c020', '#d8a414', '#b0840e'],
    'blue': ['#3a68d8', '#2e58c0', '#2448a0', '#1a3880'],
    'white': ['#f4f2ec', '#e4e0d6', '#ccc8bc', '#aeaa9e'],
    'cream': ['#eadcbc', '#d8c8a4', '#c0ae88', '#a2906c'],
    'dark': ['#2a2c34', '#22242c', '#1a1c22', '#14161a'],
}
PLINTH = 13.0  # the plinth's half size
COURSE = 1.3  # each of its two courses
HUB_Z = 25.0  # the axle's height (the lowest gondola clears the plinth)
RIM = 17.0  # the outer rim's radius
INNER = 15.2  # the inner rim's radius
FACE = 1.5  # half the wheel's depth (front rim at -FACE, back at +FACE)
LEG_Y = 3.4  # the legs' planes
CARS = 12
CAR_SLOTS = ['Kit.red', 'Kit.yellow', 'Kit.blue']


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


def plinth(p, detail):
    """Two cream courses, the upper inset, and a broad stair up the front (-Y) to the top."""
    for k, inset in enumerate((0.0, 1.4)):
        h = PLINTH - inset
        p.box((-h, -h, k * COURSE), (h, h, (k + 1) * COURSE), 'Kit.cream')
    steps = 6 if detail else 2
    rise, run, half = 2 * COURSE / steps, 4.0 / steps, 5.0
    for s in range(steps):
        y0 = -PLINTH - 4.0 + s * run
        p.box((-half, y0, 0.0), (half, -PLINTH + 0.01, (s + 1) * rise), 'Kit.cream')
    if detail:  # the stair's white side walls and the plinth's coping
        for x in (-half - 0.6, half):
            p.box((x, -PLINTH - 4.0, 0.0), (x + 0.6, -PLINTH, 2 * COURSE + 0.4), 'Kit.white')
        c = PLINTH - 1.4
        for a, b in (((-c, -c), (c, -c + 0.5)), ((-c, c - 0.5), (c, c)), ((-c, -c), (-c + 0.5, c)), ((c - 0.5, -c), (c, c))):
            p.box((a[0], a[1], 2 * COURSE), (b[0], b[1], 2 * COURSE + 0.35), 'Kit.white')


def legs(p, detail):
    """Two red A-frames, one in front of the wheel and one behind, from the plinth's top to the hub, braced across."""
    top = 2 * COURSE
    for y in (-LEG_Y, LEG_Y):
        for x in (-9.5, 9.5):
            beam(p, (x, y, top), (0.0, y, HUB_Z), 1.2, 'Kit.red')
            p.box((x - 1.2, y - 1.2, top), (x + 1.2, y + 1.2, top + 0.6), 'Kit.white')  # the foot
        if detail:
            beam(p, (-5.6, y, top + 9.0), (5.6, y, top + 9.0), 0.7, 'Kit.red')  # the brace
    beam(p, (0.0, -LEG_Y - 0.8, HUB_Z), (0.0, LEG_Y + 0.8, HUB_Z), 0.9, 'Kit.yellow')  # the axle


def hub(p, detail):
    """The hub on each face of the wheel: a sunflower disc in a red ring."""
    for y in (-FACE, FACE):
        p.wheel(0.0, y, HUB_Z, 3.2, 0.8, 16 if detail else 8, 'Kit.red')
        p.wheel(0.0, y, HUB_Z, 2.6, 1.0, 16 if detail else 8, 'Kit.yellow')


def rim(p, detail):
    """The white double rim (outer and inner ring on each face), the zigzag lattice between them, the spokes, and the
    cross ties that carry the gondolas."""
    segs = 48 if detail else 24
    at = lambda r, a, y: (r * math.cos(a), y, HUB_Z + r * math.sin(a))
    for y in (-FACE, FACE):
        for i in range(segs):
            a0, a1 = 2 * math.pi * i / segs, 2 * math.pi * (i + 1) / segs
            beam(p, at(RIM, a0, y), at(RIM, a1, y), 0.55, 'Kit.white')
            if detail:
                beam(p, at(INNER, a0, y), at(INNER, a1, y), 0.4, 'Kit.white')
                beam(p, at(INNER, a0, y), at(RIM, a1, y), 0.22, 'Kit.white')  # the lattice zigzag
        spokes = 16 if detail else 8
        for i in range(spokes):
            a = 2 * math.pi * (i + 0.5) / spokes
            beam(p, at(3.0, a, y), at(RIM, a, y), 0.3, 'Kit.white')
    for i in range(CARS):
        a = 2 * math.pi * i / CARS
        beam(p, at(RIM, a, -FACE - 0.4), at(RIM, a, FACE + 0.4), 0.45, 'Kit.white')


def gondolas(p, detail):
    """12 cabins hanging under the rim's ties, red, sunflower and royal blue in turn: a hanger, a white roof, the body
    and a dark window band."""
    for i in range(CARS):
        a = 2 * math.pi * i / CARS
        x, z = RIM * math.cos(a), HUB_Z + RIM * math.sin(a)
        slot = CAR_SLOTS[i % 3]
        top = z - 0.6
        beam(p, (x, 0.0, z), (x, 0.0, top), 0.25, 'Kit.white')
        p.box((x - 2.0, -1.6, top - 0.6), (x + 2.0, 1.6, top), 'Kit.white')  # the roof
        p.box((x - 1.75, -1.4, top - 3.4), (x + 1.75, 1.4, top - 0.6), slot)  # the body
        if detail:
            p.box((x - 1.77, -1.42, top - 1.8), (x + 1.77, 1.42, top - 1.0), 'Kit.dark')  # the window band
            p.box((x - 1.85, -1.5, top - 3.6), (x + 1.85, 1.5, top - 3.4), 'Kit.white')  # the floor lip


def build(detail):
    p = Piece()
    plinth(p, detail)
    legs(p, detail)
    hub(p, detail)
    rim(p, detail)
    gondolas(p, detail)
    return p


class Calm:
    """The shade jitter, halved: the painted wheel reads as clean flat colour."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'ferris-atlas')
    near = finish(build(True), 'ferris', Calm(SEED), SWATCHES)
    far = finish(build(False), 'ferris-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
