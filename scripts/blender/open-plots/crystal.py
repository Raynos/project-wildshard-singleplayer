"""crystal.py <out-dir>: Thin Ice's landmark as a Blender script (OPEN-PLOTS OP18): a cluster of giant ice crystals on a
snowy two-tier plinth on the plaza (art/grid/round-62-open-plot-palettes/08-thin-ice.jpg).

Blocky painted low poly (the open plots' kit idiom) at a pale cyan noon: a 36 m central crystal (a hexagonal prism under a
faceted point) ringed by eight lesser crystals leaning out from it, the tallest toward the back, the shortest framing the
front; every crystal in aqua ice, its facets shaded by their facing, a paler rime band at its foot. They stand on an
octagonal plinth of pale stone in two tiers, each capped with snow, a stair up its front. The far model keeps every
crystal with fewer sides and the plinth's lower tier. Every face samples the swatch atlas (landmarklib.py).

Exports landmark.glb (near) and landmark-far.glb, in metres: 36 m tall (the central point), the plinth 30 m across;
pivot at the base centre, the stair to the front (Blender -Y, glTF +Z; the layout turns it to face the south entry).
Run: bash scripts/blender/build.sh open-plots/crystal.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 18
# sRGB swatches, lightest first (judged against the round-62 board's noon)
SWATCHES = {
    'ice': ['#c8f4ff', '#8adcf4', '#56bce6', '#3292c8'],
    'deep': ['#7ed0f0', '#4aaee0', '#2e8cc8', '#1e68a4'],
    'rime': ['#f0fbff', '#d4f0fa', '#b0dcef', '#8cc4e0'],
    'snow': ['#ffffff', '#eef4fa', '#d6e2ee', '#b8c8da'],
    'stone': ['#d8dee6', '#bcc6d2', '#9eaabb', '#808ea2'],
}
PLINTH = [(15.0, 0.0, 1.6), (10.5, 1.6, 3.2)]  # each tier's radius (to its octagon's corners), its foot and its top


def crystal(p, x, y, z, r, h, tip, lean, toward, sides, slot='Kit.ice', rime=True):
    """A crystal: a `sides`-sided prism of radius `r` rising `h` from (x, y, z), leaning `lean` radians toward the
    compass angle `toward`, under a point `tip` tall; a paler rime band round its foot."""
    d = (math.sin(lean) * math.cos(toward), math.sin(lean) * math.sin(toward), math.cos(lean))
    ref = (0.0, 0.0, 1.0) if abs(d[2]) < 0.99 else (1.0, 0.0, 0.0)
    u = (d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0])
    ul = math.sqrt(sum(c * c for c in u))
    u = tuple(c / ul for c in u)
    v = (d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0])
    at = lambda s, k, rad: tuple((x, y, z)[i] + d[i] * s + rad * (math.cos(2 * math.pi * k / sides) * u[i] + math.sin(2 * math.pi * k / sides) * v[i]) for i in range(3))
    band = min(1.6, h * 0.12) if rime else 0.0
    levels = [(-0.4, r * 1.08, 'Kit.rime'), (band, r, 'Kit.rime'), (h, r * 0.92, slot)] if rime else [(-0.4, r, slot), (h, r * 0.92, slot)]
    for (s0, r0, _), (s1, r1, sl) in zip(levels, levels[1:]):
        for k in range(sides):
            p.face([at(s0, k, r0), at(s0, k + 1, r0), at(s1, k + 1, r1), at(s1, k, r1)], sl)
    point = tuple((x, y, z)[i] + d[i] * (h + tip) for i in range(3))
    for k in range(sides):
        p.face([at(h, k, r * 0.92), at(h, k + 1, r * 0.92), point], 'Kit.deep' if k % 2 else slot)


def plinth(p, detail):
    """The octagonal plinth: two stone tiers capped in snow, a stair up its front (-Y) to the upper tier."""
    for radius, z0, z1 in (PLINTH if detail else PLINTH[:1]):
        p.prism(0, 0, radius, radius, z0, z1 - 0.3, 8, 'Kit.stone', spin=math.pi / 8, cap_top=False)
        p.prism(0, 0, radius + 0.25, radius, z1 - 0.3, z1, 8, 'Kit.snow', spin=math.pi / 8)
    if detail:
        n = 8
        for s in range(n):
            t = (s + 1) / n
            p.box((-3.5, -PLINTH[0][0] - 4.0 + s * 4.0 / n, 0.0), (3.5, -PLINTH[0][0] + 0.5, PLINTH[0][2] * t), 'Kit.snow')
            p.box((-3.0, -PLINTH[1][0] - 0.5 - 4.5 * (1 - t), PLINTH[0][2]), (3.0, -PLINTH[1][0] + 0.5, PLINTH[0][2] + (PLINTH[1][2] - PLINTH[0][2]) * t), 'Kit.snow')


def build(detail):
    p = Piece()
    plinth(p, detail)
    top = PLINTH[1][2] if detail else PLINTH[0][2]
    sides = 6 if detail else 5
    crystal(p, 0.0, 1.0, top, 4.2, 26.0, 36.0 - 26.0 - top, 0.03, 1.6, sides)
    # the ring: (angle round the centre, distance, radius, height, tip, lean); the tallest behind (+Y), the shortest in front
    ring = [(90, 5.0, 3.4, 23.0, 7.0, 0.16), (45, 5.5, 2.8, 18.0, 5.5, 0.26), (135, 5.5, 3.0, 20.0, 6.0, 0.24),
            (0, 6.0, 2.4, 13.0, 4.5, 0.36), (180, 6.0, 2.6, 15.0, 5.0, 0.34), (-30, 6.0, 2.0, 9.0, 3.4, 0.46),
            (-150, 6.0, 2.1, 10.0, 3.6, 0.44), (-90, 7.0, 1.4, 5.0, 2.2, 0.56)]
    for angle, dist, r, h, tip, lean in ring:
        a = math.radians(angle)
        crystal(p, dist * math.cos(a), dist * math.sin(a), top, r, h, tip, lean, a, sides, 'Kit.ice' if angle % 90 else 'Kit.deep')
    if detail:  # shards at the plinth's lower tier
        for angle in (20, 160, 250, 290):
            a = math.radians(angle)
            crystal(p, 12.0 * math.cos(a), 12.0 * math.sin(a), PLINTH[0][2], 0.9, 2.2, 1.2, 0.5, a, 5, 'Kit.ice', rime=False)
    return p


class Calm:
    """The shade jitter, halved: the painted ice reads as clean facets."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'crystal-atlas')
    near = finish(build(True), 'crystal', Calm(SEED), SWATCHES)
    far = finish(build(False), 'crystal-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
