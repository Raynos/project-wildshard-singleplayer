"""airship.py <out-dir>: Sky Harbor's landmark as a Blender script (OPEN-PLOTS OP11): a cream airship moored nose-in to
a timber mooring tower on the plaza (art/grid/round-62-open-plot-palettes/09-sky-harbor.jpg).

Blocky painted low poly (the open plots' kit idiom) on a bright clear day: a 26 m timber lattice tower (four corner posts
tapering to a railed platform, girts and cross braces on every face, a lookout hut under a navy pyramid roof, a mast and a
navy pennant) standing on a timber deck stacked with crates and barrels; a 36 m cream envelope with three brown straps,
four timber tail fins and a nose cap moored to the tower's mooring cone, a timber gondola with a brass-trimmed rail and
two propellers slung under it on rigging. The far model keeps the tower's posts and girts, the envelope with fewer facets,
its fins and gondola. Every face samples the swatch atlas (landmarklib.py).

Exports landmark.glb (near) and landmark-far.glb, in metres: 31.5 m tall (the mast), the ship's axis along x with the
tower at -x and the gondola's front to Blender -Y (glTF +Z; the layout turns it to face the south entry, so the tower
stands on the right from the road); pivot at the base centre. Run: bash scripts/blender/build.sh open-plots/airship.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 11
# sRGB swatches, lightest first (judged against the round-62 board's clear day)
SWATCHES = {
    'cream': ['#f6eedc', '#e6dcc4', '#ccc0a6', '#aea288'],
    'strap': ['#9a6a40', '#845a34', '#6c482a', '#543820'],
    'wood': ['#b07c48', '#96663a', '#7a522e', '#5e3e22'],
    'navy': ['#3a5cb0', '#2e4c96', '#243c7a', '#1a2c5c'],
    'brass': ['#e8c068', '#cca050', '#a8823e', '#86642e'],
    'iron': ['#5a5e66', '#484c54', '#383b42', '#282a30'],
}
TOWER_X = -20.0  # the tower's axis (the ship's middle over the plaza's centre)
BASE, TOP, HEIGHT = 3.6, 2.0, 24.0  # its half widths at the deck and the platform, the platform's height
SHIP_CZ, SHIP_R = 21.0, 6.5  # the envelope's axis height and its greatest radius
NOSE, TAIL = TOWER_X + TOP + 0.6, TOWER_X + TOP + 0.6 + 36.0


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


def hlathe(p, profile, sides, slot, cy=0.0, cz=SHIP_CZ):
    """Revolve [(x, radius), ...] nose to tail about the x axis at (cy, cz); a zero radius closes an end."""
    ring = lambda x, r: [(x, cy + r * math.cos(2 * math.pi * (i + 0.5) / sides), cz + r * math.sin(2 * math.pi * (i + 0.5) / sides))
                         for i in range(sides)]
    rings = [ring(x, r) for x, r in profile]
    for band in range(len(rings) - 1):
        a, b = rings[band], rings[band + 1]
        for i in range(sides):
            j = (i + 1) % sides
            if profile[band][1] <= 1e-6:
                p.face([a[i], b[i], b[j]], slot)
            elif profile[band + 1][1] <= 1e-6:
                p.face([a[i], b[i], a[j]], slot)
            else:
                p.face([a[i], b[i], b[j], a[j]], slot)


def radius(t):
    """The envelope's radius along its length (t 0 at the nose, 1 at the tail): a blunt nose, a long taper aft."""
    return SHIP_R * (math.sin(math.pi * min(1.0, t / 0.36) / 2) ** 0.7 if t < 0.36 else 1.0 - 0.78 * ((t - 0.36) / 0.64) ** 1.6)


def tower(p, detail):
    """The mooring tower: four tapering corner posts, girts every 4 m, cross braces on each face, a railed platform, a
    lookout hut under a navy pyramid roof, a mast and pennant, the mooring cone on its +x face, its deck below."""
    p.box((TOWER_X - 7.0, -7.0, 0.0), (TOWER_X + 7.0, 7.0, 0.4), 'Kit.wood')
    half = lambda z: BASE + (TOP - BASE) * z / HEIGHT
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for sx, sy in corners:
        beam(p, (TOWER_X + sx * BASE, sy * BASE, 0.4), (TOWER_X + sx * TOP, sy * TOP, HEIGHT), 0.45, 'Kit.wood')
    levels = [0.4 + 4.0 * k for k in range(6)] + [HEIGHT]
    for z in levels[1:]:
        h = half(z)
        for i in range(4):
            (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
            beam(p, (TOWER_X + ax * h, ay * h, z), (TOWER_X + bx * h, by * h, z), 0.3, 'Kit.wood')
    if detail:
        for k in range(len(levels) - 1):
            z0, z1 = levels[k], levels[k + 1]
            h0, h1 = half(z0), half(z1)
            for i in range(4):
                (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
                beam(p, (TOWER_X + ax * h0, ay * h0, z0), (TOWER_X + bx * h1, by * h1, z1), 0.18, 'Kit.strap')
                beam(p, (TOWER_X + bx * h0, by * h0, z0), (TOWER_X + ax * h1, ay * h1, z1), 0.18, 'Kit.strap')
    p.box((TOWER_X - TOP - 0.8, -TOP - 0.8, HEIGHT), (TOWER_X + TOP + 0.8, TOP + 0.8, HEIGHT + 0.35), 'Kit.wood')
    if detail:
        for i in range(4):
            (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
            r = TOP + 0.7
            beam(p, (TOWER_X + ax * r, ay * r, HEIGHT + 1.2), (TOWER_X + bx * r, by * r, HEIGHT + 1.2), 0.12, 'Kit.brass')
            beam(p, (TOWER_X + ax * r, ay * r, HEIGHT + 0.35), (TOWER_X + ax * r, ay * r, HEIGHT + 1.2), 0.12, 'Kit.brass')
    p.box((TOWER_X - 1.4, -1.4, HEIGHT + 0.35), (TOWER_X + 1.4, 1.4, HEIGHT + 2.8), 'Kit.cream')
    p.prism(TOWER_X, 0.0, 2.3, 0.0, HEIGHT + 2.8, HEIGHT + 5.0, 4, 'Kit.navy', spin=math.pi / 4)
    p.prism(TOWER_X, 0.0, 0.12, 0.1, HEIGHT + 5.0, HEIGHT + 7.5, 6, 'Kit.iron')
    p.panel([(TOWER_X, 0.0, HEIGHT + 7.4), (TOWER_X + 2.6, 0.0, HEIGHT + 6.9), (TOWER_X, 0.0, HEIGHT + 6.3)], 'Kit.navy')
    # the mooring cone on the tower's +x face, at the ship's axis
    hx = TOWER_X + half(SHIP_CZ)
    beam(p, (hx, 0.0, SHIP_CZ), (NOSE + 0.2, 0.0, SHIP_CZ), 0.5, 'Kit.iron')
    if detail:
        for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):  # crates and barrels on the deck
            x, y = TOWER_X + sx * 5.2, sy * 5.2
            p.box((x - 0.8, y - 0.8, 0.4), (x + 0.8, y + 0.8, 1.9), 'Kit.wood')
            p.box((x - 0.6 + sx * 0.3, y - 0.6, 1.9), (x + 0.6 + sx * 0.3, y + 0.6, 2.9), 'Kit.strap')
            p.prism(x - sx * 1.6, y, 0.45, 0.45, 0.4, 1.5, 8, 'Kit.strap')


def ship(p, detail):
    """The envelope, its straps, nose cap and four tail fins, the gondola on rigging with its rail and propellers."""
    sides, n = (14, 16) if detail else (8, 8)
    profile = [(NOSE, 0.0)] + [(NOSE + (TAIL - NOSE) * k / n, radius(k / n)) for k in range(1, n)] + [(TAIL, 0.0)]
    hlathe(p, profile, sides, 'Kit.cream')
    for t in (0.16, 0.45, 0.72):  # the brown straps round the envelope
        x = NOSE + (TAIL - NOSE) * t
        r = radius(t) + 0.08
        hlathe(p, [(x - 0.35, r), (x + 0.35, r)], sides, 'Kit.strap')
    hlathe(p, [(NOSE - 0.1, 0.0), (NOSE + 0.6, 1.2), (NOSE + 1.0, 1.5)], sides, 'Kit.brass')
    fx0, fx1 = NOSE + (TAIL - NOSE) * 0.74, TAIL - 0.8
    for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2):  # the cruciform tail fins
        dy, dz = math.cos(a), math.sin(a)
        r0, r1 = radius(0.74), radius((fx1 - NOSE) / (TAIL - NOSE))
        pts = [(fx0, dy * r0, SHIP_CZ + dz * r0), (fx1, dy * r1, SHIP_CZ + dz * r1),
               (fx1 + 0.8, dy * (r1 + 4.6), SHIP_CZ + dz * (r1 + 4.6)), (fx0 + 3.0, dy * (r0 + 3.2), SHIP_CZ + dz * (r0 + 3.2))]
        p.panel(pts, 'Kit.wood', 'Kit.strap')
    mid = (NOSE + TAIL) / 2
    gx0, gx1, gz0, gz1, gy = mid - 5.5, mid + 5.5, SHIP_CZ - SHIP_R - 3.6, SHIP_CZ - SHIP_R - 1.4, 1.7
    p.box((gx0, -gy, gz0), (gx1, gy, gz1), 'Kit.wood', 'Kit.strap', bottom=True)
    p.box((gx0 + 0.6, -gy + 0.3, gz1), (gx1 - 2.0, gy - 0.3, gz1 + 0.9), 'Kit.cream', 'Kit.navy')
    p.box((gx0 - 0.4, -gy - 0.15, gz0 + 0.6), (gx1 + 0.4, gy + 0.15, gz0 + 0.9), 'Kit.brass')
    for x in (gx0 + 0.6, gx1 - 0.6):  # the rigging to the envelope
        for y in (-gy + 0.2, gy - 0.2):
            beam(p, (x, y, gz1), (x + (2.0 if x < mid else -2.0), y * 1.6, SHIP_CZ - SHIP_R * 0.92), 0.12 if detail else 0.2, 'Kit.strap')
    for sy in (-1, 1):  # the propellers on outriggers at the gondola's stern
        beam(p, (gx1 - 1.0, sy * gy, gz0 + 1.2), (gx1 + 0.8, sy * (gy + 1.6), gz0 + 1.2), 0.2, 'Kit.iron')
        cx, cy, cz = gx1 + 1.1, sy * (gy + 1.6), gz0 + 1.2
        p.box((cx - 0.15, cy - 0.12, cz - 1.3), (cx + 0.15, cy + 0.12, cz + 1.3), 'Kit.wood')
        p.box((cx - 0.15, cy - 1.3, cz - 0.12), (cx + 0.15, cy + 1.3, cz + 0.12), 'Kit.wood')


def build(detail):
    p = Piece()
    tower(p, detail)
    ship(p, detail)
    return p


class Calm:
    """The shade jitter, halved: the painted envelope and timber read as clean flat colour."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'airship-atlas')
    near = finish(build(True), 'airship', Calm(SEED), SWATCHES)
    far = finish(build(False), 'airship-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
