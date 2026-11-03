"""observatory.py <out-dir>: Starfall Observatory's landmark as a Blender script (OPEN-PLOTS OP15): the domed observatory
and its telescope on the plaza (art/grid/round-62-open-plot-palettes/12-starfall-observatory.jpg).

Blocky painted low poly (the open plots' kit idiom) in the plot's starlit palette: a two-course white stone plinth with a
broad stair up the front, a white drum with pilasters between tall lit windows under a cornice, a balcony ring, a white
hemispherical dome split by a dark observing slit facing the front, and a royal-blue telescope with a silver band and a
dark lens rising out of the slit toward the sky. Turned architecture and the slit read cleanly only as a script, so the
observatory is scripted. Every face samples the swatch atlas (landmarklib.py). The far model keeps the plinth, drum, dome,
slit and telescope with fewer segments and no pilasters or balcony.

Exports landmark.glb (near) and landmark-far.glb, in metres: 30 m tall, plinth 30 m square, the stair's foot 5 m proud of
it; pivot at the base centre, the stair up the front (Blender -Y, glTF +Z; the layout turns it to face the south entry).
Run: bash scripts/blender/build.sh open-plots/observatory.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 13
# sRGB swatches, lightest first (judged against the round-62 board: white stone, royal blue, silver, night glass)
SWATCHES = {
    'white': ['#f4f4f8', '#e2e4ec', '#c8ccd8', '#aab0c0'],
    'blue': ['#3a5ad8', '#2e4ac0', '#2438a0', '#1a2a80'],
    'silver': ['#e8ecf2', '#cfd6e0', '#b2bccc', '#94a0b4'],
    'dark': ['#2a2e3c', '#22252f', '#1a1c24', '#13151b'],
    'window': ['#fff2c8', '#ffe8a8', '#f4d488', '#dcb868'],
}
PLINTH, COURSE = 15.0, 1.2  # the plinth's half size and each course's height
BASE = 2 * COURSE  # the drum's foot
DRUM_R, DRUM_H = 10.0, 11.0  # the drum's radius and height
DOME_R = 10.6  # the dome's radius (it overhangs the drum a little)
SLIT = 0.16  # the slit's half width (radians of longitude), facing the front (-Y)


def plinth(p, detail):
    """Two white courses, the upper inset, and a broad stair up the front (-Y) to the drum's door."""
    for k, inset in enumerate((0.0, 1.6)):
        h = PLINTH - inset
        p.box((-h, -h, k * COURSE), (h, h, (k + 1) * COURSE), 'Kit.white')
    steps = 6 if detail else 2
    rise, run, half = BASE / steps, 5.0 / steps, 4.5
    for s in range(steps):
        y0 = -PLINTH - 5.0 + s * run
        p.box((-half, y0, 0.0), (half, -DRUM_R + 0.5, (s + 1) * rise), 'Kit.white')
    p.box((-1.6, -DRUM_R - 0.15, BASE), (1.6, -DRUM_R + 0.4, BASE + 4.2), 'Kit.blue')  # the door


def drum(p, detail):
    """The white drum, pilasters between its tall lit windows, a cornice and a balcony ring."""
    sides = 32 if detail else 16
    top = BASE + DRUM_H
    p.lathe(0.0, 0.0, [(DRUM_R, BASE), (DRUM_R, top)], sides, ['Kit.white'], cap_top=False)
    p.lathe(0.0, 0.0, [(DRUM_R, top), (DRUM_R + 0.7, top + 0.2), (DRUM_R + 0.7, top + 0.9), (DRUM_R, top + 1.1)], sides,
            ['Kit.silver'], cap_top=False)
    if not detail:
        return
    windows = 12
    for i in range(windows):
        a = 2 * math.pi * (i + 0.5) / windows - math.pi / 2
        if abs(((a + math.pi / 2 + math.pi) % (2 * math.pi)) - math.pi) < 0.3:
            continue  # the door's bay
        c, s = math.cos(a), math.sin(a)
        x, y = (DRUM_R + 0.06) * c, (DRUM_R + 0.06) * s
        tx, ty = -s, c
        z0, z1, w = BASE + 2.4, BASE + 8.6, 0.65
        quad = [(x - tx * w, y - ty * w, z0), (x + tx * w, y + ty * w, z0), (x + tx * w, y + ty * w, z1), (x - tx * w, y - ty * w, z1)]
        p.face(quad, 'Glow.window')
        b = 2 * math.pi * i / windows - math.pi / 2  # a pilaster between each pair of windows
        bx, by = (DRUM_R + 0.25) * math.cos(b), (DRUM_R + 0.25) * math.sin(b)
        p.box((bx - 0.35, by - 0.35, BASE), (bx + 0.35, by + 0.35, BASE + DRUM_H), 'Kit.silver')
    # the balcony: a slab ring and posts, under the dome
    p.lathe(0.0, 0.0, [(DRUM_R + 1.6, top + 1.1), (DRUM_R + 1.6, top + 1.4)], sides, ['Kit.white'], cap_top=False)
    for i in range(24):
        a = 2 * math.pi * i / 24
        x, y = (DRUM_R + 1.5) * math.cos(a), (DRUM_R + 1.5) * math.sin(a)
        p.box((x - 0.08, y - 0.08, top + 1.4), (x + 0.08, y + 0.08, top + 2.4), 'Kit.silver')


def dome(p, detail):
    """The hemispherical dome, its slit a dark band of longitude facing the front (-Y) from the eave to past the crown."""
    lon, lat = (32, 10) if detail else (16, 6)
    z0 = BASE + DRUM_H + 1.1
    front = -math.pi / 2
    at = lambda i, j: (DOME_R * math.cos(math.pi / 2 * j / lat) * math.cos(2 * math.pi * i / lon),
                       DOME_R * math.cos(math.pi / 2 * j / lat) * math.sin(2 * math.pi * i / lon),
                       z0 + DOME_R * math.sin(math.pi / 2 * j / lat))
    for i in range(lon):
        mid = 2 * math.pi * (i + 0.5) / lon
        slit = abs(((mid - front + math.pi) % (2 * math.pi)) - math.pi) < max(SLIT, math.pi / lon)  # one segment at least
        for j in range(lat):
            slot = 'Kit.dark' if slit and j < lat - 1 else 'Kit.white'
            a, b, c, d = at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)
            if j == lat - 1:
                p.face([a, b, c], slot)
            else:
                p.face([a, b, c, d], slot)


def tube(p, a, b, r, sides, slot, cap=True):
    """A round tube of radius `r` from `a` to `b`, capped at both ends."""
    d = [b[i] - a[i] for i in range(3)]
    length = math.sqrt(sum(c * c for c in d)) or 1.0
    d = [c / length for c in d]
    ref = (0.0, 0.0, 1.0) if abs(d[2]) < 0.9 else (1.0, 0.0, 0.0)
    u = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]]
    ul = math.sqrt(sum(c * c for c in u)) or 1.0
    u = [c / ul for c in u]
    v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]
    ring = lambda o, k: tuple(o[i] + r * (math.cos(2 * math.pi * k / sides) * u[i] + math.sin(2 * math.pi * k / sides) * v[i]) for i in range(3))
    lo, hi = [ring(a, k) for k in range(sides)], [ring(b, k) for k in range(sides)]
    for k in range(sides):
        n = (k + 1) % sides
        p.face([lo[k], lo[n], hi[n], hi[k]], slot)
    if cap:
        p.face(list(reversed(lo)), slot)
        p.face(hi, 'Kit.dark')  # the lens end


def telescope(p, detail):
    """The royal-blue telescope out of the slit: its pivot inside the dome, tilted up toward the front, a silver band."""
    sides = 12 if detail else 6
    pivot = (0.0, -1.0, BASE + DRUM_H + 5.0)
    tilt = math.radians(38)
    d = (0.0, -math.cos(tilt), math.sin(tilt))
    end = tuple(pivot[i] + d[i] * 17.0 for i in range(3))
    tube(p, pivot, end, 2.0, sides, 'Kit.blue')
    if detail:
        band = tuple(pivot[i] + d[i] * 10.0 for i in range(3)), tuple(pivot[i] + d[i] * 11.4 for i in range(3))
        tube(p, band[0], band[1], 2.14, sides, 'Kit.silver', cap=False)
        tube(p, pivot, tuple(pivot[i] - d[i] * 3.0 for i in range(3)), 1.5, sides, 'Kit.blue')  # the tail


def build(detail):
    p = Piece()
    plinth(p, detail)
    drum(p, detail)
    dome(p, detail)
    telescope(p, detail)
    return p


class Calm:
    """The shade jitter, halved: the painted stone reads as clean flat colour."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'observatory-atlas')
    near = finish(build(True), 'observatory', Calm(SEED), SWATCHES)
    far = finish(build(False), 'observatory-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
