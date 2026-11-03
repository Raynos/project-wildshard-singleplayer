"""lighthouse.py <out-dir>: Saltwind Lighthouse's landmark as a Blender script (OPEN-PLOTS OP9): the red-banded
lighthouse on its stepped basalt plinth at the plaza (art/grid/round-75-new-plot-palettes/04-saltwind-lighthouse.jpg).

Blocky painted low poly (the open plots' kit idiom) in the harbour's storm palette: a three-step black basalt plinth with
a stair up the front, a tapered whitewashed tower in four white courses and three signal-red bands, dark slit windows
up its front and back, a black gallery and railing under a cold glass lantern room with black mullions, and a black
domed cap with a vent ball and finial. Turned architecture reads cleanly only as a script (image-to-3D smears the bands
and the railing), so the lighthouse is scripted. Every face samples the swatch atlas (landmarklib.py). The far model
keeps the plinth, tower bands, gallery, lantern room and cap with fewer sides and no railing or windows.

Exports landmark.glb (near) and landmark-far.glb, in metres: 40 m tall, plinth 22 m square, the stair's foot 4 m proud
of it; pivot at the base centre, the stair up the front (Blender -Y, glTF +Z; the layout turns it to face the south entry).
Run: bash scripts/blender/build.sh open-plots/lighthouse.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 11
# sRGB swatches, lightest first (judged against the round-75 board: whitewash, signal red, black basalt and tar)
SWATCHES = {
    'white': ['#f2f0ea', '#dedad0', '#c4c0b4', '#a8a498'],
    'red': ['#d63a30', '#bc2e26', '#9c241e', '#7a1c18'],
    'basalt': ['#5a5e64', '#474b52', '#363a40', '#272a30'],
    'black': ['#34363a', '#26282c', '#1c1e22', '#141518'],
    'glass': ['#f4f8fa', '#e4eef2', '#ccdce4', '#b0c4ce'],
    'window': ['#3c4450', '#2e3540', '#222830', '#181c22'],
}
STEPS = [(11.0, 1.2), (9.0, 1.2), (7.2, 1.2)]  # the plinth's (half size, height) tiers, bottom up
BASE = sum(h for _, h in STEPS)  # the tower's foot
TOWER = 28.0  # the tower's height above the plinth
R0, R1 = 4.6, 3.1  # the tower's radius at its foot and its head
BANDS = 7  # courses up the tower: white, red, white, red, white, red, white
GALLERY = 0.9  # the gallery deck's overhang past the tower's head


def radius(t):
    """The tower's radius at height fraction `t` (a slight concave taper)."""
    return R0 + (R1 - R0) * (1 - (1 - t) ** 1.25)


def plinth(p, detail):
    """Three black basalt tiers and a stair up the front (-Y) to the tower's door."""
    z = 0.0
    for half, h in STEPS:
        p.box((-half, -half, z), (half, half, z + h), 'Kit.basalt')
        z += h
    steps = 6 if detail else 2
    rise, run, half = BASE / steps, 4.0 / steps, 2.6
    front = -STEPS[0][0]
    for s in range(steps):
        y0 = front - 4.0 + s * run
        p.box((-half, y0, 0.0), (half, -R0 + 0.4, (s + 1) * rise), 'Kit.basalt')
    if detail:  # the door at the stair's head
        p.box((-1.0, -R0 - 0.12, BASE), (1.0, -R0 + 0.3, BASE + 2.6), 'Kit.black')


def tower(p, detail):
    """The tapered tower in courses, white and red in turn, and its slit windows."""
    sides = 24 if detail else 12
    for b in range(BANDS):
        t0, t1 = b / BANDS, (b + 1) / BANDS
        slot = 'Kit.red' if b % 2 == 1 else 'Kit.white'
        p.lathe(0.0, 0.0, [(radius(t0), BASE + TOWER * t0), (radius(t1), BASE + TOWER * t1)], sides, [slot],
                cap_top=False)
    if detail:  # slit windows up the front and the back, one in each white course
        for b in range(0, BANDS, 2):
            t = (b + 0.5) / BANDS
            z, r = BASE + TOWER * t, radius(t)
            for y in (-1, 1):
                p.box((-0.45, y * (r + 0.08) - 0.3, z - 0.9), (0.45, y * (r + 0.08) + 0.3, z + 0.9), 'Kit.window')


def head(p, detail):
    """The gallery deck and its railing, the lantern room (glass between black mullions), the domed cap and finial."""
    sides = 24 if detail else 12
    top = BASE + TOWER
    deck = R1 + GALLERY
    p.lathe(0.0, 0.0, [(R1, top - 0.6), (deck, top - 0.1), (deck, top + 0.35), (0.0, top + 0.35)], sides, ['Kit.black'])
    if detail:  # the railing: posts and two rails
        for i in range(24):
            a = 2 * math.pi * i / 24
            x, y = (deck - 0.1) * math.cos(a), (deck - 0.1) * math.sin(a)
            p.box((x - 0.07, y - 0.07, top + 0.35), (x + 0.07, y + 0.07, top + 1.4), 'Kit.black')
        for z in (top + 0.85, top + 1.35):
            p.lathe(0.0, 0.0, [(deck - 0.02, z - 0.05), (deck - 0.02, z + 0.05)], sides, ['Kit.black'], cap_top=False)
    room, rz = R1 - 0.6, top + 0.35
    p.lathe(0.0, 0.0, [(room, rz), (room, rz + 0.6)], sides, ['Kit.black'], cap_top=False)  # the sill
    p.lathe(0.0, 0.0, [(room - 0.05, rz + 0.6), (room - 0.05, rz + 3.4)], sides, ['Kit.glass'], cap_top=False)
    if detail:  # mullions
        for i in range(8):
            a = 2 * math.pi * (i + 0.5) / 8
            x, y = room * math.cos(a), room * math.sin(a)
            p.box((x - 0.1, y - 0.1, rz + 0.6), (x + 0.1, y + 0.1, rz + 3.4), 'Kit.black')
    cap = rz + 3.4
    p.lathe(0.0, 0.0, [(room + 0.3, cap), (room + 0.3, cap + 0.3), (room * 0.8, cap + 1.2), (room * 0.4, cap + 2.0),
                       (0.0, cap + 2.3)], sides, ['Kit.black'])
    p.prism(0.0, 0.0, 0.35, 0.35, cap + 2.2, cap + 2.9, 8, 'Kit.black')  # the vent ball's stem
    p.prism(0.0, 0.0, 0.08, 0.02, cap + 2.9, cap + 4.0, 6, 'Kit.black')  # the finial


def build(detail):
    p = Piece()
    plinth(p, detail)
    tower(p, detail)
    head(p, detail)
    return p


class Calm:
    """The shade jitter, halved: the painted bands read as clean flat colour."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'lighthouse-atlas')
    near = finish(build(True), 'lighthouse', Calm(SEED), SWATCHES)
    far = finish(build(False), 'lighthouse-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
