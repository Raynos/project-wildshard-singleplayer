"""cypress.py <out-dir>: Lantern Bayou's landmark as a Blender script (OB2, project/archive/2026-11-03-open-plots-build-out.md):
the script take of the giant moss-draped bald cypress, beside the Hunyuan3D 2.1 and TRELLIS.2 takes on the pick board
(art/lantern-bayou/round-1-landmark/).

Faceted low poly in the open plots' kit idiom (G978: blocky): a fluted, buttressed trunk on splayed roots and cypress
knees, five great limbs and their forks, clumped foliage pads at the limb ends and curtains of hanging moss strands.
The landmark path (src/shards/open-plots/generators/tiledPlot.mjs) reads a textured model, so every face samples a
4 x 4 swatch atlas: one column per slot (bark, moss on bark, foliage, hanging moss), four shades down it, the shade
picked per face from its facing and a seeded jitter (the kit's flat, faceted light). Exports landmark.glb (near,
<= 20k triangles) and landmark-far.glb (<= 2.5k, the far proxy and the collider), 40 m tall, pivot at the trunk's foot,
front +Z. Run: bash scripts/blender/build.sh open-plots/cypress.
"""
import json
import math
import os
import random
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import tube  # noqa: E402
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, far_copy, finish, triangles  # noqa: E402

HEIGHT = 40.0
SEED = 7
# sRGB swatches: each slot's four shades, lightest first (judged against art/grid/round-62-open-plot-palettes/18-*.jpg)
SWATCHES = {
    'bark': ['#6e5c4a', '#5a4a3c', '#4a3c31', '#382e26'],
    'mossbark': ['#6f7a46', '#5c683c', '#4c5734', '#3c452b'],
    'foliage': ['#55703a', '#465f31', '#384e2a', '#2b3d22'],
    'moss': ['#727e40', '#626e38', '#525e30', '#434d28'],
    'rope': ['#4a3c30', '#3e3228', '#332920', '#28201a'],
}
LANTERNS = 72
# the pads the ropes hang from: the outermost 40 (a second rope on most of them past the first 40); the inner pads sit
# inside the crown's top, where a lantern would not show
OUTER = 40


def trunk(p, rng, k):
    """The fluted trunk: twelve ridged rings from a 5 m flared foot to the crown fork, its ridges twisting slightly."""
    sides, rings = 14, [(0.0, 6.6), (1.0, 5.4), (2.6, 4.3), (5.0, 3.7), (8.0, 3.35), (11.0, 3.1), (14.0, 2.8), (16.5, 2.5)]
    bm = p.bm
    loops = []
    for n, (z, r) in enumerate(rings):
        ring = []
        for i in range(sides):
            a = 2 * math.pi * i / sides + n * 0.05
            rr = r * (1.0 + (0.2 if i % 2 == 0 else -0.1) * (1.0 - z / 22.0)) * rng.uniform(0.96, 1.04)
            ring.append(bm.verts.new((rr * math.cos(a) * k, rr * math.sin(a) * k, z * k)))
        loops.append(ring)
    slot = p.slot('Kit.bark')
    for a, b in zip(loops, loops[1:]):
        for i in range(sides):
            j = (i + 1) % sides
            f = bm.faces.new((a[i], a[j], b[j], b[i]))
            f.material_index = slot


def roots(p, rng, k):
    """Splayed buttress roots running from the trunk's ridges down into the mud, and a ring of knees round them."""
    for i in range(9):
        a = 2 * math.pi * i / 9 + rng.uniform(-0.12, 0.12)
        c, s, reach = math.cos(a), math.sin(a), rng.uniform(8.5, 11.0)
        path = [(4.6 * c * k, 4.6 * s * k, 3.0 * k), (7.0 * c * k, 7.0 * s * k, 0.9 * k), (reach * c * k, reach * s * k, -0.3 * k)]
        tube(p, path, [1.5 * k, 0.9 * k, 0.2 * k], 6, 'Kit.bark', (c, s, 0), squash=0.7)
    for i in range(14):
        a, d = i * 2.399963, rng.uniform(8.5, 13.0)
        h, r = rng.uniform(0.8, 1.9), rng.uniform(0.35, 0.6)
        x, y = d * math.cos(a), d * math.sin(a)
        p.lathe(x * k, y * k, [(r * 1.3 * k, -0.4 * k), (r * k, h * 0.5 * k), (r * 0.45 * k, h * k), (0.0, (h + 0.15) * k)], 6,
                ['Kit.bark', 'Kit.bark', 'Kit.mossbark'], spin=a)


def pad(p, rng, cx, cy, cz, r, k):
    """A clumped foliage pad: two or three overlapping flat, lumpy domes of seven sides (one dome read as a cap)."""
    for n in range(rng.choice((2, 3))):
        a, d = rng.uniform(0, math.tau), r * (0.0 if n == 0 else rng.uniform(0.45, 0.7))
        x, y, z, rr = cx + d * math.cos(a), cy + d * math.sin(a), cz + rng.uniform(-0.5, 0.6), r * (1.0 if n == 0 else rng.uniform(0.6, 0.8))
        lumps = [rr * rng.uniform(0.8, 1.2) for _ in range(3)]
        p.lathe(x * k, y * k, [(lumps[0] * 0.5 * k, (z - rr * 0.3) * k), (lumps[1] * k, (z - rr * 0.08) * k),
                               (lumps[2] * 0.8 * k, (z + rr * 0.18) * k), (rr * 0.3 * k, (z + rr * 0.36) * k), (0.0, (z + rr * 0.4) * k)],
                7, ['Kit.foliage'] * 4, spin=rng.uniform(0, math.pi), cap_bottom=True)


def strand(p, rng, x, y, top, length, k):
    """One hanging moss strand: a thin four-sided tapering ribbon with a slight kink."""
    sway = rng.uniform(0, math.tau)
    path = [(x * k, y * k, top * k), ((x + 0.25 * math.cos(sway)) * k, (y + 0.25 * math.sin(sway)) * k, (top - length * 0.55) * k),
            ((x + 0.1 * math.cos(sway)) * k, (y + 0.1 * math.sin(sway)) * k, (top - length) * k)]
    tube(p, path, [0.36 * k, 0.24 * k, 0.0], 4, 'Kit.moss', (math.cos(sway), math.sin(sway), 0), squash=0.45)


def crown(p, rng, k):
    """Five great limbs from the fork, each forking twice, pads at the tips, moss hanging from the limbs and pads."""
    pads = []
    for i in range(5):
        a = 2 * math.pi * i / 5 + rng.uniform(-0.15, 0.15)
        c, s = math.cos(a), math.sin(a)
        reach, rise = rng.uniform(15.0, 18.5), rng.uniform(21.0, 25.0)
        mid = (reach * 0.5 * c, reach * 0.5 * s, 18.0 + (rise - 18.0) * 0.6)
        end = (reach * c, reach * s, rise)
        tube(p, [(0, 0, 14.5 * k), (mid[0] * k, mid[1] * k, mid[2] * k), (end[0] * k, end[1] * k, end[2] * k)],
             [1.9 * k, 1.15 * k, 0.45 * k], 7, 'Kit.bark', (c, s, 0))
        for t in (0.35, 0.7):  # moss on the limb's upper side and curtains hanging off it
            x, y, z = reach * t * c, reach * t * s, 18.0 + (rise - 18.0) * t
            for _ in range(5):
                o = rng.uniform(-1.2, 1.2)
                strand(p, rng, x - s * o, y + c * o, z - 0.6, rng.uniform(3.0, 7.0), k)
        for f in (-1, 1):  # the forks off the limb's middle
            b = a + f * rng.uniform(0.45, 0.7)
            tip = (mid[0] + rng.uniform(5.0, 7.5) * math.cos(b), mid[1] + rng.uniform(5.0, 7.5) * math.sin(b), mid[2] + rng.uniform(3.0, 7.0))
            tube(p, [(mid[0] * k, mid[1] * k, mid[2] * k), (tip[0] * k, tip[1] * k, tip[2] * k)], [0.5 * k, 0.22 * k], 5, 'Kit.bark',
                 (math.cos(b), math.sin(b), 0))
            pads.append((tip, rng.uniform(2.6, 3.4)))
            pads.append(((tip[0] * 0.8 + mid[0] * 0.2, tip[1] * 0.8 + mid[1] * 0.2, tip[2] + 1.2), rng.uniform(2.2, 2.8)))
        pads.append((end, rng.uniform(3.2, 4.0)))
        pads.append(((end[0] + 1.8 * c, end[1] + 1.8 * s, end[2] - 0.8), rng.uniform(2.4, 3.0)))
        pads.append(((reach * 0.72 * c, reach * 0.72 * s, rise + 1.0), rng.uniform(2.6, 3.2)))
    pads.append(((0.0, 0.0, 31.5), 4.2))  # the top
    for i in range(7):  # an inner ring and an upper ring filling the crown's middle
        a = 2 * math.pi * (i + 0.5) / 7
        pads.append(((7.0 * math.cos(a), 7.0 * math.sin(a), 26.0 + rng.uniform(-1.5, 1.5)), rng.uniform(2.8, 3.6)))
        pads.append(((3.6 * math.cos(a + 0.4), 3.6 * math.sin(a + 0.4), 29.5 + rng.uniform(-1.0, 1.0)), rng.uniform(2.6, 3.2)))
    for (x, y, z), r in pads:
        pad(p, rng, x, y, z, r, k)
        for _ in range(9):  # moss curtains under each pad's rim
            a, d = rng.uniform(0, math.tau), r * rng.uniform(0.4, 1.0)
            strand(p, rng, x + d * math.cos(a), y + d * math.sin(a), z - r * 0.2, rng.uniform(3.0, 9.0), k)
    return pads


def ropes(p, rng, pads, k):
    """The hero lanterns' ropes (G827: every lantern hangs on something): LANTERNS dark ropes, 1.2-3.4 m long, from the
    undersides of the outer pads' rims, spread round the crown; returns each rope's lower end, where a lantern's hook goes."""
    outer = sorted(pads, key=lambda row: -math.hypot(row[0][0], row[0][1]))[:OUTER]
    hooks = []
    for n in range(LANTERNS):
        (x, y, z), r = outer[n % len(outer)]
        a, d = rng.uniform(0, math.tau), r * rng.uniform(0.5, 0.85)
        hx, hy, top = x + d * math.cos(a), y + d * math.sin(a), z - r * 0.28
        low = top - rng.uniform(1.2, 3.4)
        p.prism(hx * k, hy * k, 0.05 * k, 0.05 * k, low * k, top * k, 3, 'Kit.rope', spin=a, cap_top=False)
        hooks.append((hx, hy, low))
    return hooks


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(SEED)
    k = 1.0
    p = Piece()
    trunk(p, rng, k)
    roots(p, rng, k)
    hooks = ropes(p, rng, crown(p, rng, k), k)
    near = finish(p, 'cypress', random.Random(SEED + 1), SWATCHES)
    top = max(v.co.z for v in near.data.vertices)
    for v in near.data.vertices:
        v.co *= HEIGHT / top
    # the hooks in plot metres as tiledPlot.mjs's stand() places the model: scaled with it, its x / z bounds centred, in
    # game axes (x, y up, z = -Blender y): the layout's landmark.lanterns rows
    xs, ys = [v.co.x for v in near.data.vertices], [v.co.y for v in near.data.vertices]
    cx, cy, f = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, HEIGHT / top
    with open(os.path.join(out, 'hooks.json'), 'w') as fh:
        # + 0.0 turns a rounded -0.0 into 0.0 (admission's JSON refuses negative zero)
        json.dump([[round(hx * f - cx, 2) + 0.0, round(hz * f, 2) + 0.0, round(-(hy * f - cy), 2) + 0.0] for hx, hy, hz in hooks], fh)
    image = atlas_image(SWATCHES, 'cypress-atlas')
    print(f'cypress near: {triangles(near)} triangles')
    export(near, image, os.path.join(out, 'landmark.glb'))
    far = far_copy(near, 2400)
    print(f'cypress far: {triangles(far)} triangles')
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
