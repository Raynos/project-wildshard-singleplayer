"""monolith.py <out-dir>: Pastel Alien Plain's landmark as a Blender script (OPEN-PLOTS OP20): the glowing alien monolith on
the plaza (art/grid/round-62-open-plot-palettes/13-alien-plain.jpg).

Blocky painted low poly (the open plots' kit idiom) in the plain's bioluminescent night: a dark violet-black faceted spire,
the tallest of a cluster of five leaning shards, each split by an acid-lime crack running up its face (the crack faces
take the lime swatch, so they read as glow under the night's low light), on a ring of low jagged plinth stones with a few
lime and violet crystals at its foot. Jagged shards read cleanly only as a script, so the monolith is scripted. Every face
samples the swatch atlas (landmarklib.py). The far model keeps the shards and cracks with fewer facets and no crystals.

Exports landmark.glb (near) and landmark-far.glb, in metres: 32 m tall, its plinth ring 22 m across; pivot at the base
centre, its main crack facing the front (Blender -Y, glTF +Z; the layout turns it to face the south entry).
Run: bash scripts/blender/build.sh open-plots/monolith.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 23
# sRGB swatches, lightest first (judged against the round-62 board: obsidian, acid lime, violet)
SWATCHES = {
    'rock': ['#4a4058', '#3a3248', '#2c2638', '#201c2a'],
    'lime': ['#d6ff5a', '#c4f040', '#a8dc30', '#8cc020'],
    'violet': ['#b070f0', '#9a58e0', '#8044c8', '#6834a8'],
    'stone': ['#5a5468', '#4a4458', '#3c3848', '#2e2a38'],
}
# the shards: (x, y, base half-width, height, lean x, lean y, sides) in metres; the first is the spire
SHARDS = [(0.0, 0.0, 6.5, 32.0, 0.0, 0.0, 6), (-7.0, 2.5, 3.6, 18.0, -2.5, 1.0, 5), (7.5, 1.5, 3.8, 21.0, 2.5, 0.5, 5),
          (-4.0, 6.0, 3.0, 14.0, -1.5, 2.5, 5), (4.5, -6.0, 2.6, 11.0, 1.8, -2.0, 5)]


def shard(p, rng, x, y, r, h, lx, ly, sides, detail):
    """A leaning faceted shard: an irregular ring at its foot narrowing in tiers to a blunt cut top; the face toward the front
    (-y) and the one opposite carry a lime crack that zigzags up the face, its strip shifting across each tier."""
    tiers = [(0.0, 1.0), (0.35, 0.88), (0.65, 0.7), (0.88, 0.46), (1.0, 0.22)] if detail else [(0.0, 1.0), (0.6, 0.72), (1.0, 0.24)]
    spin = rng.uniform(0, math.pi)
    radii = [r * rng.uniform(0.8, 1.15) for _ in range(sides)]
    def at(t, k, s):
        a = spin + 2 * math.pi * k / sides
        return (x + lx * t + radii[k % sides] * s * math.cos(a), y + ly * t + radii[k % sides] * s * math.sin(a), h * t)
    front = min(range(sides), key=lambda k: math.sin(spin + 2 * math.pi * (k + 0.5) / sides))  # the face nearest -y
    cracked = {front, (front + sides // 2) % sides}
    # the crack's centre across each tier's edge (0 left, 1 right): a zigzag, the same for both cracked faces
    centres = [0.5 + (0.22 if j % 2 else -0.22) * rng.uniform(0.6, 1.0) for j in range(len(tiers))]
    w = 0.09
    m = lambda u, v, f: tuple(u[i] + (v[i] - u[i]) * f for i in range(3))
    for j in range(len(tiers) - 1):
        (t0, s0), (t1, s1) = tiers[j], tiers[j + 1]
        for k in range(sides):
            a0, a1, b0, b1 = at(t0, k, s0), at(t0, k + 1, s0), at(t1, k, s1), at(t1, k + 1, s1)
            if k in cracked:
                c0, c1 = centres[j], centres[j + 1]
                al, ar, bl, br = m(a0, a1, c0 - w), m(a0, a1, c0 + w), m(b0, b1, c1 - w), m(b0, b1, c1 + w)
                p.face([a0, al, bl, b0], 'Kit.rock')
                p.face([al, ar, br, bl], 'Kit.lime')
                p.face([ar, a1, b1, br], 'Kit.rock')
            else:
                p.face([a0, a1, b1, b0], 'Kit.rock')
    top = len(tiers) - 1
    p.face([at(tiers[top][0], k, tiers[top][1]) for k in range(sides)], 'Kit.rock')  # the cut top
    p.face([at(0.0, k, 1.0) for k in reversed(range(sides))], 'Kit.rock')


def crystal(p, x, y, r, h, slot, lean):
    """A small hexagonal crystal, leaning, with a pointed tip."""
    ring = [(x + r * math.cos(2 * math.pi * k / 6), y + r * math.sin(2 * math.pi * k / 6), 0.0) for k in range(6)]
    top = [(x + lean[0] + r * 0.8 * math.cos(2 * math.pi * k / 6), y + lean[1] + r * 0.8 * math.sin(2 * math.pi * k / 6), h * 0.8) for k in range(6)]
    tip = (x + lean[0] * 1.2, y + lean[1] * 1.2, h)
    for k in range(6):
        n = (k + 1) % 6
        p.face([ring[k], ring[n], top[n], top[k]], slot)
        p.face([top[k], top[n], tip], slot)


def build(detail):
    p = Piece()
    rng = random.Random(SEED)
    for k in range(9 if detail else 6):  # the plinth ring of low jagged stones
        a = 2 * math.pi * k / (9 if detail else 6) + 0.2
        cx, cy = 9.5 * math.cos(a), 9.5 * math.sin(a)
        if abs(math.sin(a) + 1) < 0.25:
            continue  # the front stays open
        shard(p, rng, cx, cy, 1.8, rng.uniform(1.4, 2.6), 0.0, 0.0, 5, False)
    for x, y, r, h, lx, ly, sides in SHARDS:
        shard(p, rng, x, y, r, h, lx, ly, sides if detail else max(4, sides - 1), detail)
    if detail:
        for x, y, h, slot in ((-8.0, -6.0, 4.0, 'Kit.lime'), (-9.5, -4.0, 2.6, 'Kit.violet'), (8.5, -6.5, 3.4, 'Kit.violet'),
                              (10.0, -4.5, 2.2, 'Kit.lime'), (-10.5, 4.0, 3.0, 'Kit.violet'), (10.5, 5.0, 3.6, 'Kit.lime')):
            crystal(p, x, y, 0.6, h, slot, (rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6)))
    return p


class Calm:
    """The shade jitter, halved: the glowing cracks read as clean flat colour."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'monolith-atlas')
    near = finish(build(True), 'monolith', Calm(SEED), SWATCHES)
    far = finish(build(False), 'monolith-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
