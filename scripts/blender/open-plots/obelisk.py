"""obelisk.py <out-dir>: the Showcase Template's landmark as a Blender script (OPEN-PLOTS OP5): THE OBELISK, the
clock-and-beacon spire of KITCHEN-SINK's round-11 prompt block (art/showcase-template/round-11-remaster/COMMON-v2.txt),
raised to a 30 m hub for the plaza.

Simple, polished low poly in the showcase's warm orange and cool grey workshop palette with cyan accents (ruling 19ab:
finished materials, no stencils, no grid floors, no plain blocks): a square spire of warm orange stone tapering from 4.8 m
to 2.4 m, chamfered at its corners, bound by grey steel bands; a clock face on each side under its cap (a cream dial, grey
hands and hour marks); a grey steel cap and a glowing cyan crystal at the tip; on a two-step grey plinth inside a fountain
ring (a low orange-capped basin wall round a cyan water ring). The far model keeps the spire, bands, cap, crystal and the
basin wall with fewer faces. Every face samples the swatch atlas (landmarklib.py).

Exports landmark.glb (near) and landmark-far.glb, in metres: 30 m tall (the crystal's point), the fountain ring 18 m
across; pivot at the base centre, a clock face to the front (Blender -Y, glTF +Z; the layout turns it to face the south
entry). Run: bash scripts/blender/build.sh open-plots/obelisk.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 5
# sRGB swatches, lightest first (the round-11 prompt block's palette)
SWATCHES = {
    'orange': ['#f8a058', '#e8823c', '#c8662a', '#a04e20'],
    'steel': ['#b8bcc6', '#9a9ea8', '#7c808a', '#5e626c'],
    'cream': ['#fbf3e4', '#efe4cf', '#d8cbb2', '#bcae94'],
    'cyan': ['#c8f6ff', '#8fe3ff', '#56c4ec', '#2e9cc8'],
    'dark': ['#4a4e58', '#3a3e46', '#2c2f36', '#1e2026'],
}
BASE, TOP, SHAFT = 2.4, 1.2, 24.0  # the spire's half widths at its foot and under its cap, its height over the plinth
PLINTH = 1.2


def chamfer(p, z0, z1, h0, h1, c, slot, cap_top=False):
    """An octagonal band: a square of half width h0 at z0 to h1 at z1 with its corners cut by `c` (a fraction)."""
    ring = lambda h, z: [(x * h, y * h, z) for x, y in ((1, -1 + c), (1, 1 - c), (1 - c, 1), (-1 + c, 1), (-1, 1 - c), (-1, -1 + c), (-1 + c, -1), (1 - c, -1))]
    lo, hi = ring(h0, z0), ring(h1, z1)
    for i in range(8):
        j = (i + 1) % 8
        p.face([lo[i], lo[j], hi[j], hi[i]], slot)
    if cap_top:
        p.face(hi, slot)


def clock(p, z, h, detail):
    """A clock face on each of the four sides at height z, the spire's half width there h: a cream dial, hands, marks."""
    r = h * 0.78
    for k in range(4):
        a = math.pi / 2 * k
        # the side's outward normal and its two in-face axes
        n, u = (math.sin(a), -math.cos(a)), (math.cos(a), math.sin(a))
        at = lambda du, dz, out: (n[0] * (h + out) + u[0] * du, n[1] * (h + out) + u[1] * du, z + dz)
        sides = 12 if detail else 8
        rim = [at(r * math.cos(2 * math.pi * i / sides), r * math.sin(2 * math.pi * i / sides), 0.05) for i in range(sides)]
        centre = at(0, 0, 0.06)
        for i in range(sides):
            tri = [centre, rim[i], rim[(i + 1) % sides]]
            p.face(tri[::-1], 'Kit.cream')
        if detail:
            for du0, dz0, du1, dz1 in ((0, 0, 0, r * 0.7), (0, 0, r * 0.5, -r * 0.2)):  # the hands
                w = 0.06
                p.face([at(du0 - w, dz0, 0.09), at(du1 - w, dz1, 0.09), at(du1 + w, dz1, 0.09), at(du0 + w, dz0, 0.09)][::-1], 'Kit.dark')
            for i in range(4):  # the quarter marks
                ca, sa = math.cos(math.pi / 2 * i), math.sin(math.pi / 2 * i)
                m0, m1, w = r * 0.78, r * 0.95, 0.07
                p.face([at(ca * m0 - sa * w, sa * m0 + ca * w, 0.08), at(ca * m1 - sa * w, sa * m1 + ca * w, 0.08),
                        at(ca * m1 + sa * w, sa * m1 - ca * w, 0.08), at(ca * m0 + sa * w, sa * m0 - ca * w, 0.08)][::-1], 'Kit.dark')


def build(detail):
    p = Piece()
    # the fountain ring: a cyan water ring between the plinth and a low orange-capped basin wall
    sides = 24 if detail else 12
    p.prism(0, 0, 9.0, 9.0, 0.0, 0.6, sides, 'Kit.steel', cap_top=False)
    p.prism(0, 0, 9.2, 8.4, 0.6, 0.8, sides, 'Kit.orange', cap_top=False)
    p.prism(0, 0, 8.4, 8.4, 0.0, 0.35, sides, 'Kit.cyan')
    # the plinth: two grey steps
    p.prism(0, 0, 5.6, 5.6, 0.0, 0.6, 8, 'Kit.steel', spin=math.pi / 8)
    p.prism(0, 0, 4.2, 4.2, 0.6, PLINTH, 8, 'Kit.steel', spin=math.pi / 8)
    # the spire in four stone courses between steel bands
    courses = 4
    half = lambda z: BASE + (TOP - BASE) * (z - PLINTH) / SHAFT
    for k in range(courses):
        z0, z1 = PLINTH + SHAFT * k / courses, PLINTH + SHAFT * (k + 1) / courses
        chamfer(p, z0, z1 - 0.5, half(z0), half(z1 - 0.5), 0.25, 'Kit.orange')
        chamfer(p, z1 - 0.5, z1, half(z1 - 0.5) + 0.12, half(z1) + 0.12, 0.25, 'Kit.steel')
    top = PLINTH + SHAFT
    clock(p, top - 2.6, half(top - 2.6), detail)
    # the cap and the crystal
    chamfer(p, top, top + 0.8, TOP + 0.4, TOP + 0.25, 0.25, 'Kit.steel', cap_top=True)
    tip, mid, r = 30.0, top + 2.2, 1.3
    for i in range(6 if detail else 4):
        n = 6 if detail else 4
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        e0, e1 = (r * math.cos(a0), r * math.sin(a0), mid), (r * math.cos(a1), r * math.sin(a1), mid)
        p.face([e0, e1, (0, 0, tip)], 'Kit.cyan')
        p.face([e1, e0, (0, 0, top + 0.8)], 'Kit.cyan')
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
    image = atlas_image(SWATCHES, 'obelisk-atlas')
    near = finish(build(True), 'obelisk', Calm(SEED), SWATCHES)
    far = finish(build(False), 'obelisk-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
