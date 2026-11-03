"""tower.py <out-dir>: Mosslight Ruins' landmark as a Blender script (open-plots build-out OB6): the script take of the
ruined tower on its rock outcrop, beside the image-to-3D takes on the pick board (art/mosslight-ruins/round-1-landmark/).

Faceted low poly in the open plots' kit idiom (G978: blocky), after round 62's road-entry view
(art/grid/round-62-open-plot-palettes/19-mosslight-ruins.jpg): a craggy outcrop whose up-facing rock is moss, stairs cut
up its front, a square keep with a battered base and string courses, broken crenellations and a fallen corner, a taller
round turret at its back-left corner, window slits on every face, ivy curtains and moss cushions on its ledges, rubble at
its foot. Every face samples the swatch atlas (landmarklib.py). Exports landmark.glb (near, <= 20k triangles) and
landmark-far.glb (<= 2.5k), 35 m tall, pivot at the outcrop's foot, front +Z, and build/hooks.json: each window slit as
[x, y, z, nx, nz, width, height] in plot metres as tiledPlotCore.mjs stands the model (the plot draws them as emerald
Glow, since the landmark graph lights only warm texels).
Run: bash scripts/blender/build.sh open-plots/tower.
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, far_copy, finish, triangles  # noqa: E402

HEIGHT = 35.0
SEED = 19
# sRGB swatches, lightest first (judged against round 62's Mosslight Ruins)
SWATCHES = {
    'stone': ['#939990', '#7c8279', '#666c64', '#51564f'],
    'course': ['#7b8178', '#676d65', '#545951', '#42463f'],
    'rock': ['#72756c', '#5e6159', '#4b4e47', '#3a3c36'],
    'moss': ['#5f8644', '#4e7238', '#3f5e2e', '#304a24'],
    'ivy': ['#4a7f37', '#3b6a2d', '#2e5524', '#22411c'],
    'slit': ['#1f2a22', '#18211b', '#121914', '#0c110d'],
    'door': ['#2a2620', '#221f1a', '#1b1814', '#14120f'],
}
CRAG = [(0.0, 19.0), (2.2, 18.0), (2.2, 16.4), (4.6, 15.2), (6.8, 12.6), (6.8, 11.2)]  # (height, radius) foot to ledge
LEDGE = CRAG[-1][0]
KEEP = 4.6  # the keep's half width at its waist (m)
TOP = 27.0  # the keep's wall top above the ground (m)
SIDES = 28


def crag(p, rng):
    """The outcrop: jittered rings stepping in at two ledges; up-facing rock turns to moss in `moss_on_top`."""
    rings = []
    for z, r in CRAG:
        rings.append([(r * (1 + rng.uniform(-0.09, 0.09)) * math.cos(2 * math.pi * i / SIDES),
                       r * (1 + rng.uniform(-0.09, 0.09)) * math.sin(2 * math.pi * i / SIDES),
                       z + (rng.uniform(-0.4, 0.4) if 0 < z < LEDGE else 0)) for i in range(SIDES)])
    for a, b in zip(rings, rings[1:]):
        for i in range(SIDES):
            j = (i + 1) % SIDES
            p.face([a[i], a[j], b[j], b[i]], 'Kit.rock')
    p.face(rings[-1], 'Kit.rock')
    # boulders on the lower ledge
    for k in range(9):
        a = rng.uniform(0, math.tau)
        r = 16.0 + rng.uniform(-0.6, 0.6)
        s = rng.uniform(1.0, 2.2)
        p.prism(r * math.cos(a), r * math.sin(a), s, s * 0.6, 2.2, 2.2 + s * 1.2, 5, 'Kit.rock', spin=rng.uniform(0, 1))


def stairs(p):
    """Stairs cut up the outcrop's front (-y) from the ground to the keep's door ledge, between low cheek walls."""
    steps = 14
    for k in range(steps):
        z = LEDGE * (k + 1) / steps
        y0 = -19.5 + 8.0 * k / steps
        p.box((-2.2, y0, 0), (2.2, -10.0, z), 'Kit.stone', top='Kit.stone')
    for x in (-2.8, 2.2):
        p.box((x, -19.5, 0), (x + 0.6, -10.0, 1.2), 'Kit.stone', top='Kit.moss')


def keep(p, rng, slits):
    """The square keep on the ledge: a battered base, two string courses, broken crenellations, a fallen front-right
    corner, window slits (recorded in `slits`), an arched door on the front."""
    b, w = KEEP + 1.0, KEEP
    p.lathe(0, 0, [(b * math.sqrt(2), LEDGE), (w * math.sqrt(2), LEDGE + 3.0)], 4, ['Kit.stone'], spin=math.pi / 4, cap_top=False)
    body = [(w * math.sqrt(2), LEDGE + 3.0), (w * math.sqrt(2), 14.0), ((w + 0.35) * math.sqrt(2), 14.0),
            ((w + 0.35) * math.sqrt(2), 14.6), (w * math.sqrt(2), 14.6), ((w - 0.2) * math.sqrt(2), 21.0),
            ((w + 0.15) * math.sqrt(2), 21.0), ((w + 0.15) * math.sqrt(2), 21.6), ((w - 0.2) * math.sqrt(2), 21.6),
            ((w - 0.3) * math.sqrt(2), TOP)]
    p.lathe(0, 0, body, 4, ['Kit.stone'], spin=math.pi / 4, cap_top=False)
    p.face([(-(w - 0.3), -(w - 0.3), TOP - 0.6), ((w - 0.3), -(w - 0.3), TOP - 0.6), ((w - 0.3), (w - 0.3), TOP - 0.6),
            (-(w - 0.3), (w - 0.3), TOP - 0.6)], 'Kit.moss')  # the roofless top, grown over
    # masonry: a proud course every 2.2 m between the string courses, and odd blocks standing out of the faces
    for z in (LEDGE + 5.2, LEDGE + 7.4, 16.8, 19.0, 23.8, 25.8):
        if z > 13.6:
            ww = (w - 0.2) + 0.08
        else:
            ww = w + 0.08
        for lo, hi in (((-ww, -ww - 0.12), (ww, -ww + 0.05)), ((ww - 0.05, -ww), (ww + 0.12, ww)),
                       ((-ww, ww - 0.05), (ww, ww + 0.12)), ((-ww - 0.12, -ww), (-ww + 0.05, ww))):
            p.box((lo[0], lo[1], z), (hi[0], hi[1], z + 0.24), 'Kit.course')
    for k in range(18):
        side = k % 4
        o, z = rng.uniform(-w + 0.8, w - 0.8), rng.uniform(LEDGE + 3.5, TOP - 1.5)
        s = rng.uniform(0.7, 1.2)
        x0, y0, x1, y1 = [(o - s, -w - 0.2, o + s, -w + 0.1), (w - 0.1, o - s, w + 0.2, o + s),
                          (o - s, w - 0.1, o + s, w + 0.2), (-w - 0.2, o - s, -w + 0.1, o + s)][side]
        p.box((x0, y0, z), (x1, y1, z + 0.5), 'Kit.course', top='Kit.moss')
    # merlons round the crest, some fallen; the front-right corner broken down in steps
    e = w - 0.3
    for side in range(4):
        for k in range(6):
            t = -e + (2 * e) * (k + 0.5) / 6
            if rng.random() < 0.25:
                continue
            x, y = [(t, -e), (e, t), (-t, e), (-e, -t)][side]
            h = rng.uniform(1.0, 2.0)
            p.box((x - 0.55, y - 0.55, TOP), (x + 0.55, y + 0.55, TOP + h), 'Kit.stone', top='Kit.moss')
    for k, (dz, s) in enumerate(((0.0, 2.6), (-1.6, 2.0), (-3.2, 1.4))):
        p.box((e - s, -e - 0.3, TOP + dz - 1.6), (e + 0.3, -e + s, TOP + dz + 0.01), 'Kit.moss', top='Kit.moss')
    # the door: an arched recess on the front at the stairs' head
    p.box((-1.1, -w - 0.05, LEDGE), (1.1, -w + 0.2, LEDGE + 3.4), 'Kit.door')
    p.lathe(0, -w + 0.07, [(1.1, LEDGE + 3.4), (0.01, LEDGE + 4.4)], 8, ['Kit.door'], cap_top=False)
    # window slits on every face, three levels, their glowing panes recorded for the plot
    for side, (nx, ny) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
        for z, offsets in ((11.0, (-2.2, 2.2)), (17.5, (0.0,)), (23.6, (-2.0, 2.0))):
            for o in offsets:
                if side == 0 and z == 11.0 and abs(o) < 1:
                    continue
                cx, cy = (o, ny * (w - 0.1)) if nx == 0 else (nx * (w - 0.18), o)
                hw, hh = 0.45, 1.5
                lo = (cx - (hw if nx == 0 else 0.25), cy - (hw if ny == 0 else 0.25), z - hh / 2)
                hi = (cx + (hw if nx == 0 else 0.25), cy + (hw if ny == 0 else 0.25), z + hh / 2)
                p.box(lo, hi, 'Kit.slit')
                slits.append((cx + nx * 0.3, cy + ny * 0.3, z, nx, ny, hw * 2, hh))


def turret(p, rng, slits):
    """A round turret at the keep's back-left corner, taller than the keep, its crown broken, two slits."""
    cx, cy, r = -KEEP, KEEP, 2.4
    p.lathe(cx, cy, [(r + 0.5, LEDGE), (r, LEDGE + 2.0), (r, 31.0), (r + 0.3, 31.0), (r + 0.3, 31.6), (r, 31.6)],
            10, ['Kit.stone'], cap_top=False)
    p.lathe(cx, cy, [(r - 0.01, 31.59), (r - 0.4, 31.6)], 10, ['Kit.moss'])
    for k in range(10):
        if k in (3, 7):
            continue
        a = 2 * math.pi * (k + 0.5) / 10
        h = rng.uniform(1.0, 2.4)
        x, y = cx + (r - 0.2) * math.cos(a), cy + (r - 0.2) * math.sin(a)
        p.box((x - 0.45, y - 0.45, 31.6), (x + 0.45, y + 0.45, 31.6 + h), 'Kit.stone', top='Kit.moss')
    for z, a in ((19.0, math.pi * 0.75), (26.0, math.pi * 1.25)):
        nx, ny = math.cos(a), math.sin(a)
        x, y = cx + r * nx, cy + r * ny
        p.box((x - 0.3, y - 0.3, z - 0.7), (x + 0.3, y + 0.3, z + 0.7), 'Kit.slit')
        slits.append((x + nx * 0.35, y + ny * 0.35, z, nx, ny, 0.6, 1.4))


def ivy_curtain(p, rng, x, y, nx, ny, top, length, width):
    """An ivy curtain down a wall whose outward normal is (nx, ny): a ragged-lobed sheet a little proud of it."""
    tx, ty = -ny, nx  # along the wall
    lobes = max(2, int(width / 0.9))
    edge = [(x + tx * (width * (i / lobes - 0.5)) + nx * 0.12, y + ty * (width * (i / lobes - 0.5)) + ny * 0.12) for i in range(lobes + 1)]
    lows = [top - length * rng.uniform(0.5, 1.0) for _ in edge]
    for i in range(lobes):
        (ax, ay), (bx, by) = edge[i], edge[i + 1]
        mid = ((ax + bx) / 2, (ay + by) / 2, min(lows[i], lows[i + 1]) - length * 0.2 * rng.random())
        quad = [(ax, ay, top), (bx, by, top), (bx, by, lows[i + 1]), mid, (ax, ay, lows[i])]
        p.face(quad[::-1], 'Kit.ivy')
        p.face(quad, 'Kit.ivy')


def greenery(p, rng):
    """Ivy curtains down the keep's faces and the turret, moss cushions on the ledge, the crest and the string courses."""
    w = KEEP
    for nx, ny in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        for k in range(4):
            o = rng.uniform(-w + 1.0, w - 1.0)
            x, y = (o, ny * w) if nx == 0 else (nx * w, o)
            ivy_curtain(p, rng, x, y, nx, ny, rng.uniform(16.0, TOP), rng.uniform(5.0, 12.0), rng.uniform(1.6, 3.2))
    for a in (math.pi * 0.6, math.pi * 1.1):
        ivy_curtain(p, rng, -KEEP + 2.5 * math.cos(a), KEEP + 2.5 * math.sin(a), math.cos(a), math.sin(a), 31.0, 10.0, 2.2)

    def cushion(x, y, z, r):
        p.lathe(x, y, [(r * 0.8, z), (r, z + r * 0.3), (r * 0.7, z + r * 0.75), (r * 0.25, z + r)], 6,
                ['Kit.ivy', 'Kit.moss', 'Kit.moss'], spin=rng.uniform(0, 1))
    for k in range(14):  # round the keep on the ledge
        a = rng.uniform(0, math.tau)
        r = rng.uniform(7.2, 10.5)
        if -2.6 < r * math.cos(a) < 2.6 and r * math.sin(a) < 0:
            continue  # keep the stairs' head clear
        cushion(r * math.cos(a), r * math.sin(a), LEDGE, rng.uniform(0.9, 1.8))
    for k in range(8):  # on the crest
        cushion(rng.uniform(-3.5, 3.5), rng.uniform(-3.5, 3.5), TOP - 0.6, rng.uniform(0.8, 1.5))
    for k in range(10):  # on the lower ledge and the ground round the foot
        a = rng.uniform(0, math.tau)
        r = rng.uniform(15.0, 19.5)
        cushion(r * math.cos(a), r * math.sin(a), 2.2 if r < 17.5 else 0.0, rng.uniform(1.0, 2.0))


def rubble(p, rng):
    """Fallen blocks at the foot, most under the broken corner."""
    for k in range(16):
        a = rng.uniform(-math.pi * 0.5, math.pi * 0.2) if k < 10 else rng.uniform(0, math.tau)
        r = rng.uniform(19.5, 23.0)
        s = rng.uniform(0.6, 1.3)
        x, y = r * math.cos(a), r * math.sin(a)
        p.prism(x, y, s, s * 0.8, 0, s * 0.9, 4, 'Kit.stone', spin=rng.uniform(0, 1))


def moss_on_top(slot, poly):
    """Rock and stone that face up are moss: the ledges, the crag's steps, a block's crown."""
    return 'moss' if slot in ('rock', 'stone') and poly.normal.z > 0.6 else slot


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(SEED)
    p, slits = Piece(), []
    crag(p, rng)
    stairs(p)
    keep(p, rng, slits)
    turret(p, rng, slits)
    greenery(p, rng)
    rubble(p, rng)
    near = finish(p, 'tower', random.Random(SEED + 1), SWATCHES, moss_on_top)
    top = max(v.co.z for v in near.data.vertices)
    f = HEIGHT / top
    for v in near.data.vertices:
        v.co *= f
    # the slits in plot metres as tiledPlotCore.mjs's stand() places the model: scaled, x / z bounds centred, game axes
    xs, ys = [v.co.x for v in near.data.vertices], [v.co.y for v in near.data.vertices]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    with open(os.path.join(out, 'hooks.json'), 'w') as fh:
        json.dump([[round(x * f - cx, 2), round(z * f, 2), round(-(y * f - cy), 2), nx, -ny, round(w * f, 2), round(h * f, 2)]
                   for x, y, z, nx, ny, w, h in slits], fh)
    image = atlas_image(SWATCHES, 'tower-atlas')
    print(f'tower near: {triangles(near)} triangles, {len(slits)} slits')
    export(near, image, os.path.join(out, 'landmark.glb'))
    far = far_copy(near, 2400)
    print(f'tower far: {triangles(far)} triangles')
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
