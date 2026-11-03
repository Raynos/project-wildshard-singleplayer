"""coral.py <out-dir>: Coral Drift's landmark as a Blender script (OB5, docs/plans/open-plots/build-out-mini-plan.md):
the script take of the giant faceted coral arch, beside the image-to-3D takes on the pick board
(art/coral-drift/round-1-landmark/).

Faceted low poly (G978: blocky; the round-62 mockup is faceted already): a 25 m arch of jittered coral lumps strung
along a half-ellipse from two thick feet, knobbly fingers branching up and out along its crown and down its flanks,
peach at the feet blending to pink and lilac at the top (each lump's swatch by its height), on a low sandy base. Every
face samples the swatch atlas (landmarklib.py). Exports landmark.glb (near, <= 20k triangles) and landmark-far.glb
(<= 2.5k), 25 m tall, pivot at the base's centre, the arch spanning x, front +Z (Blender -y).
Run: bash scripts/blender/build.sh open-plots/coral.
"""
import math
import os
import random
import sys

import bmesh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, far_copy, finish, triangles  # noqa: E402

HEIGHT = 25.0
SEED = 23
SPAN = 11.0  # the half-width of the arch's opening at its feet
# sRGB swatches, lightest first (judged against art/grid/round-62-open-plot-palettes/10-coral-drift.jpg)
SWATCHES = {
    'peach': ['#ffc8a0', '#f7ad84', '#ec966e', '#d87e5a'],
    'pink': ['#ff9ec6', '#f582b2', '#e66a9e', '#cc5488'],
    'lilac': ['#d2a6f2', '#bb8ce4', '#a274d2', '#885cba'],
    'sand': ['#f4e4c0', '#e8d4aa', '#d8c094', '#c4aa7e'],
}


def lump(p, rng, x, y, z, r, slot, stretch=(1.0, 1.0, 1.0)):
    """A faceted coral lump: a twice-subdivided icosphere (80 faces) about (x, y, z), radius `r`, each vertex pushed in
    or out by a seeded draw so no two lumps read alike."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    for v in bm.verts:
        k = r * rng.uniform(0.82, 1.12)
        v.co.x, v.co.y, v.co.z = x + v.co.x * k * stretch[0], y + v.co.y * k * stretch[1], z + v.co.z * k * stretch[2]
    for f in bm.faces:
        p.face([tuple(v.co) for v in f.verts], slot(f.calc_center_median().z) if callable(slot) else slot)
    bm.free()


def slot_at(z, rng):
    """Peach low, pink in the middle, lilac high, the bands blending by a seeded draw."""
    t = z / HEIGHT + rng.uniform(-0.12, 0.12)
    return 'Kit.peach' if t < 0.3 else 'Kit.pink' if t < 0.68 else 'Kit.lilac'


def branch(p, rng, start, direction, length, r, depth):
    """A staghorn branch: a tapered six-sided limb in three bends from `start` (inside its parent), forking once or twice
    near its end, each tip a small lump."""
    (x, y, z), (dx, dy, dz) = start, direction
    segments, sides = 3, 7
    def ring(c, rad, d):
        """`sides` points round `c` in the plane across `d` (a frame from d and whichever axis it is least along)."""
        axis = (1.0, 0.0, 0.0) if abs(d[0]) < 0.7 else (0.0, 1.0, 0.0)
        u = (d[1] * axis[2] - d[2] * axis[1], d[2] * axis[0] - d[0] * axis[2], d[0] * axis[1] - d[1] * axis[0])
        n = math.sqrt(sum(q * q for q in u))
        u = tuple(q / n for q in u)
        w = (d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0])
        return [tuple(c[k] + rad * (math.cos(2 * math.pi * i / sides) * u[k] + math.sin(2 * math.pi * i / sides) * w[k]) for k in range(3))
                for i in range(sides)]
    c, d, rad = (x, y, z), (dx, dy, dz), r
    rings = [ring(c, rad, d)]
    for s in range(segments):
        bend = rng.uniform(-0.35, 0.35)
        d = (d[0] + bend * 0.5, d[1] + rng.uniform(-0.25, 0.25), d[2] + 0.18)
        n = math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2)
        d = (d[0] / n, d[1] / n, d[2] / n)
        c = (c[0] + d[0] * length / segments, c[1] + d[1] * length / segments, c[2] + d[2] * length / segments)
        rad *= 0.9
        rings.append(ring(c, rad, d))
    for a, b in zip(rings, rings[1:]):
        slot = slot_at(sum(q[2] for q in b) / sides, rng)
        for i in range(sides):
            j = (i + 1) % sides
            p.face([a[i], a[j], b[j], b[i]], slot)
    lump(p, rng, *c, rad * 1.0, lambda zz: slot_at(zz, rng), (1.0, 1.0, 1.1))
    if depth > 0:
        for side in (-1, 1):
            fork = (d[0] + side * rng.uniform(0.4, 0.8), d[1] + rng.uniform(-0.3, 0.3), d[2] + 0.2)
            back = (c[0] - d[0] * length * 0.15, c[1] - d[1] * length * 0.15, c[2] - d[2] * length * 0.15)
            branch(p, rng, back, fork, length * 0.6, rad * 1.05, depth - 1)


def arch(p, rng):
    """The arch: big overlapping lumps along a half-ellipse from foot to foot (fattest at the feet), a front and a back
    strand for depth, staghorn branches growing up and out from its crown and flanks."""
    n = 30
    for dy, scale in ((0.0, 1.0), (1.6, 0.75), (-1.5, 0.72)):
        for k in range(n + 1):
            a = math.pi * k / n
            x, z = -SPAN * 1.15 * math.cos(a), (HEIGHT - 5.0) * math.sin(a)
            foot = 1.0 - math.sin(a)
            r = (3.0 + 2.4 * foot) * scale * rng.uniform(0.85, 1.15)
            lump(p, rng, x + rng.uniform(-0.5, 0.5), dy + rng.uniform(-0.4, 0.4), z + 1.8 + rng.uniform(-0.3, 0.3), r,
                 lambda zz: slot_at(zz, rng), (1.0, 0.9, 0.95))
    for k in range(1, 12):  # the staghorns: up and outward from the crown and the upper flanks
        a = math.pi * (k + rng.uniform(-0.25, 0.25)) / 12
        x, z = -SPAN * 1.15 * math.cos(a), (HEIGHT - 5.0) * math.sin(a) + 1.8
        out = (-math.cos(a) * 0.6 + rng.uniform(-0.3, 0.3), rng.uniform(-0.4, 0.4), 0.8)
        branch(p, rng, (x, rng.uniform(-0.8, 0.8), z + 1.5), out, rng.uniform(4.5, 6.5), rng.uniform(1.1, 1.5), 1 if k % 3 else 2)


def base(p, rng):
    """The low sandy base under the arch: a jittered sand mound, rubble lumps and pale rocks at the feet."""
    sides, r = 24, SPAN + 7.0
    rim = [(r * 1.1 * math.cos(2 * math.pi * i / sides) * rng.uniform(0.94, 1.04), r * 0.62 * math.sin(2 * math.pi * i / sides) * rng.uniform(0.92, 1.05), 0.0)
           for i in range(sides)]
    mid = [(q[0] * 0.6, q[1] * 0.6, 0.45 + rng.uniform(-0.1, 0.1)) for q in rim]
    centre = (0.0, 0.0, 0.6)
    for i in range(sides):
        j = (i + 1) % sides
        p.face([rim[i], rim[j], mid[j], mid[i]], 'Kit.sand')
        p.face([mid[i], mid[j], centre], 'Kit.sand')
    for s in (-1, 1):
        for _ in range(10):
            lump(p, rng, s * SPAN * 1.15 + rng.uniform(-5, 5), rng.uniform(-5, 5), 0.3, rng.uniform(0.6, 1.4),
                 rng.choice(('Kit.peach', 'Kit.pink', 'Kit.lilac')), (1.0, 1.0, 0.7))
        for _ in range(3):
            lump(p, rng, s * rng.uniform(4, 15), rng.uniform(-6, 6), 0.2, rng.uniform(0.7, 1.2), 'Kit.sand', (1.2, 1.0, 0.55))


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(SEED)
    p = Piece()
    base(p, rng)
    arch(p, rng)
    near = finish(p, 'coral', random.Random(SEED + 1), SWATCHES)
    top = max(v.co.z for v in near.data.vertices)
    for v in near.data.vertices:
        v.co *= HEIGHT / top
    image = atlas_image(SWATCHES, 'coral-atlas')
    print(f'coral near: {triangles(near)} triangles')
    export(near, image, os.path.join(out, 'landmark.glb'))
    far = far_copy(near, 2400)
    print(f'coral far: {triangles(far)} triangles')
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
