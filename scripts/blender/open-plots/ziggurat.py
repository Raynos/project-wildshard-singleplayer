"""ziggurat.py <out-dir>: Jungle Ziggurat's landmark as a Blender script (OPEN-PLOTS OP13): the stepped temple pyramid
on the plaza, take C beside the image-to-3D takes on the pick board (art/jungle-ziggurat/round-1-landmark/).

Blocky painted low poly (the open plots' kit idiom), freshly painted and intact: a cream base course, five cinnabar
tiers each capped by a cream course, every tier face carrying alternating stepped-hill frets (a saffron outline round
turquoise steps on a saffron run), a broad cream stair with side balustrades up each face, and on the top platform a red
temple house: a cream plinth on a turquoise band, a dark doorway in a cream frame, turquoise square spirals beside it and
on its sides, a carved cream panel over the door, saffron and turquoise bands under a carved cream cornice, and a pierced
four-opening roof comb; two feather standards (a turquoise fan round a saffron one) at the platform's front corners.
Every face samples the swatch atlas (landmarklib.py). The far model is built from the same masses with one block per fret
and a ramp for each stair, so near and far stand to the same box. The far model is the plot's collider: each ramp climbs
at 36.5 deg, under the player's 40 deg climb limit (CharacterMotor PLAYER_CAPSULE), so every stair walks to the top. Four
stairs, not one, keep the model's box centred on the pyramid (tiledPlotCore's stand() centres the box).

Exports landmark.glb (near) and landmark-far.glb, in metres: 47 m tall, base course 70 m square, each stair's foot 17.4 m
proud of it; pivot at the base centre, the front stair at Blender -Y (glTF +Z). The top platform is at 27 m.
Run: bash scripts/blender/build.sh open-plots/ziggurat.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, finish, triangles  # noqa: E402

SEED = 13
# sRGB swatches, lightest first (judged against art/grid/round-75-new-plot-palettes/02-jungle-ziggurat.jpg)
SWATCHES = {
    'red': ['#d8402e', '#c2382a', '#a42e24', '#82241d'],
    'turq': ['#2cc4b4', '#22aa9c', '#1b8c82', '#146e66'],
    'saffron': ['#ffbe2a', '#f0a81c', '#d08c14', '#a86e10'],
    'cream': ['#ecd2a0', '#dcbf8c', '#c4a676', '#a68a5e'],
    'sand': ['#cfac76', '#bc9864', '#a38054', '#846642'],
    'dark': ['#2e2018', '#261a14', '#1e1510', '#16100c'],
    'wood': ['#7a4e2c', '#684226', '#55361f', '#432a18'],
}
BASE = 35.0  # the base course's half size
COURSE = 2.0  # the base course's height
TIERS = 5
TIER_H = 5.0
STEP_IN = 4.4  # each tier's foot steps in this much from the one below
BATTER = 0.3  # each tier's face leans in this much over its height
CAP = 0.7  # the cream course capping each tier
PLATFORM = COURSE + TIERS * TIER_H  # 27 m
STAIR_HALF = 7.0
RAIL = 2.0  # the balustrades' width
FOOT = -52.35  # each stair's foot (Blender y, the front one): 27 m over 36.5 m of run, 36.5 deg


def half(k):
    """Tier k's half size at its foot and at its top."""
    a0 = BASE - 1.5 - STEP_IN * k
    return a0, a0 - BATTER


def stair_y(z):
    """The stair's nosing line: from the foot on the ground to the platform's front edge, clear of every tier's cap."""
    top = -(half(TIERS - 1)[1] + 0.25)
    return FOOT + (top - FOOT) * z / PLATFORM


def frustum(p, ax0, ay0, ax1, ay1, z0, z1, slot, top=None, cy=0.0):
    """A rectangular frustum round (0, cy): half sizes (ax0, ay0) at z0, (ax1, ay1) at z1, its sides and top."""
    lo = [(-ax0, cy - ay0, z0), (ax0, cy - ay0, z0), (ax0, cy + ay0, z0), (-ax0, cy + ay0, z0)]
    hi = [(-ax1, cy - ay1, z1), (ax1, cy - ay1, z1), (ax1, cy + ay1, z1), (-ax1, cy + ay1, z1)]
    for i in range(4):
        j = (i + 1) % 4
        p.face([lo[i], lo[j], hi[j], hi[i]], slot)
    p.face(hi, top or slot)


def ring(p, ax, ay, z0, z1, out, slot, cy=0.0):
    """A band standing `out` proud of a vertical rectangular wall of half sizes (ax, ay): its four faces and both lips."""
    bx, by = ax + out, ay + out
    o0 = [(-bx, cy - by), (bx, cy - by), (bx, cy + by), (-bx, cy + by)]
    i0 = [(-ax, cy - ay), (ax, cy - ay), (ax, cy + ay), (-ax, cy + ay)]
    for i in range(4):
        j = (i + 1) % 4
        p.face([(*o0[i], z0), (*o0[j], z0), (*o0[j], z1), (*o0[i], z1)], slot)
        p.face([(*i0[i], z1), (*o0[i], z1), (*o0[j], z1), (*i0[j], z1)], slot)  # the top lip
        p.face([(*i0[j], z0), (*o0[j], z0), (*o0[i], z0), (*i0[i], z0)], slot)  # the bottom lip


def extrude_yz(p, poly, x0, x1, slot):
    """A prism of the (y, z) polygon `poly` between x0 and x1."""
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1]))
    if area < 0:
        poly = list(reversed(poly))
    p.face([(x1, y, z) for y, z in poly], slot)
    p.face([(x0, y, z) for y, z in reversed(poly)], slot)
    for (ya, za), (yb, zb) in zip(poly, poly[1:] + poly[:1]):
        p.face([(x0, ya, za), (x0, yb, zb), (x1, yb, zb), (x1, ya, za)], slot)


def side_box(p, side, a, s0, s1, z0, z1, out, depth, slot):
    """A box on one face of a square body of half size `a` (side 0 front -y, 1 right +x, 2 back +y, 3 left -x): from s0 to
    s1 along the face (left to right seen from outside), z0 to z1, standing `out` proud, `depth` deep."""
    if side == 0:
        p.box((s0, -a - out, z0), (s1, -a - out + depth, z1), slot)
    elif side == 1:
        p.box((a + out - depth, s0, z0), (a + out, s1, z1), slot)
    elif side == 2:
        p.box((-s1, a + out - depth, z0), (-s0, a + out, z1), slot)
    else:
        p.box((-a - out, -s1, z0), (-a - out + depth, -s0, z1), slot)


def frets(p, k, detail):
    """Tier k's stepped-hill frets round its four faces, alternately pointing up and down, kept off the stairs."""
    a0, a1 = half(k)
    z0 = COURSE + k * TIER_H
    lo, hi = z0 + 0.6, z0 + TIER_H - CAP - 0.5
    span = 2 * a1 - 2.0
    count = max(2, round(span / 10.0))
    pitch = span / count
    clear = STAIR_HALF + RAIL + 0.6
    for side in range(4):
        for m in range(count):
            c = -a1 + 1.0 + pitch * (m + 0.5)
            w = pitch * 0.42
            if abs(c) - w < clear:
                continue
            up = (m + side + k) % 2 == 0
            if not detail:
                side_box(p, side, a0, c - w, c + w, lo + 0.4, hi - 0.4, 0.2, 0.8, 'Kit.saffron')
                side_box(p, side, a0, c - w + 0.8, c + w - 0.8, lo + 1.0, hi - 1.0, 0.35, 0.8, 'Kit.turq')
                continue
            h = (hi - lo) / 3
            side_box(p, side, a0, c - w - 0.4, c + w + 0.4, lo if up else hi - 0.55, lo + 0.55 if up else hi, 0.15, 0.7,
                     'Kit.saffron')  # the run under the hill
            for s in range(3):
                zb, zt = (lo + s * h, lo + (s + 1) * h) if up else (hi - (s + 1) * h, hi - s * h)
                ws = w * (1.0 - s * 0.3)
                side_box(p, side, a0, c - ws, c + ws, zb, zt, 0.2, 0.7, 'Kit.saffron')  # the outline
                zi0, zi1 = (zb, zt - 0.45) if up else (zb + 0.45, zt)
                side_box(p, side, a0, c - ws + 0.45, c + ws - 0.45, zi0, zi1, 0.35, 0.7, 'Kit.turq')  # the steps


def pyramid(p, detail):
    """The base course, the five tiers with their caps and frets."""
    frustum(p, BASE, BASE, BASE, BASE, 0.0, COURSE, 'Kit.cream')
    for k in range(TIERS):
        a0, a1 = half(k)
        z0 = COURSE + k * TIER_H
        frustum(p, a0, a0, a1, a1, z0, z0 + TIER_H, 'Kit.red', top='Kit.cream')
        ring(p, a1, a1, z0 + TIER_H - CAP, z0 + TIER_H, 0.25, 'Kit.cream')
        frets(p, k, detail)


class Turned:
    """A Piece seen turned `k` quarter turns about the vertical (a proper rotation: faces keep their winding)."""

    def __init__(self, p, k):
        self.p, self.k = p, k

    def at(self, v):
        x, y, z = v
        for _ in range(self.k):
            x, y = -y, x
        return (x, y, z)

    def face(self, points, slot):
        self.p.face([self.at(v) for v in points], slot)

    def box(self, lo, hi, slot, **rest):
        a, b = self.at(lo), self.at(hi)
        self.p.box(tuple(map(min, a, b)), tuple(map(max, a, b)), slot, **rest)


def stair(p, detail):
    """A broad cream stair up a face (the front's, at -y), between two balustrades that run from the ground to the platform."""
    top_y = stair_y(PLATFORM)
    if detail:
        steps = 70
        rise = PLATFORM / steps
        for i in range(steps):
            z1 = (i + 1) * rise
            y = stair_y(z1 - rise)
            p.box((-STAIR_HALF, y, max(0.0, z1 - rise * 2.2)), (STAIR_HALF, y + 1.8, z1), 'Kit.cream')
    else:
        extrude_yz(p, [(FOOT, 0.0), (top_y, PLATFORM), (top_y + 2.0, PLATFORM), (top_y + 2.0, 0.0)], -STAIR_HALF, STAIR_HALF,
                   'Kit.cream')
    for s in (-1, 1):
        x0, x1 = sorted((s * STAIR_HALF, s * (STAIR_HALF + RAIL)))
        extrude_yz(p, [(FOOT - 0.4, 0.0), (FOOT - 0.4, 1.7), (top_y - 0.3, PLATFORM + 1.5), (top_y + 3.0, PLATFORM + 1.5),
                       (top_y + 3.0, 0.0)], x0, x1, 'Kit.cream')
        p.box((x0 - 0.2, top_y - 0.5, PLATFORM), (x1 + 0.2, top_y + 1.6, PLATFORM + 2.3), 'Kit.cream')  # the newel


def spiral(p, side, a, c, z0, size, detail):
    """A turquoise square spiral panel on a wall face: its square frame and an inner hook."""
    t = size * 0.17
    s0, s1, z1 = c - size / 2, c + size / 2, z0 + size
    if not detail:
        side_box(p, side, a, s0, s1, z0, z1, 0.1, 0.4, 'Kit.turq')
        return
    side_box(p, side, a, s0, s1, z0, z0 + t, 0.15, 0.4, 'Kit.turq')
    side_box(p, side, a, s0, s1, z1 - t, z1, 0.15, 0.4, 'Kit.turq')
    side_box(p, side, a, s0, s0 + t, z0 + t, z1 - t, 0.15, 0.4, 'Kit.turq')
    side_box(p, side, a, s1 - t, s1, z0 + t, z1 - t, 0.15, 0.4, 'Kit.turq')
    side_box(p, side, a, s0 + 2 * t, s1 - t, z1 - 3 * t, z1 - 2 * t, 0.15, 0.4, 'Kit.turq')  # the hook
    side_box(p, side, a, s0 + 2 * t, s0 + 3 * t, z0 + 2 * t, z1 - 3 * t, 0.15, 0.4, 'Kit.turq')
    side_box(p, side, a, s0 + 3 * t, s1 - 2 * t, z0 + 2 * t, z0 + 3 * t, 0.15, 0.4, 'Kit.saffron')


def temple(p, detail):
    """The temple house on the platform, its front at -y facing the stair."""
    z = PLATFORM
    cy, ax, ay = -1.0, 9.5, 7.0  # its centre and its walls' half sizes at their foot
    p.box((-ax - 1.0, cy - ay - 1.0, z), (ax + 1.0, cy + ay + 1.0, z + 1.2), 'Kit.cream')  # the plinth
    p.box((-ax - 0.8, cy - ay - 0.8, z + 1.2), (ax + 0.8, cy + ay + 0.8, z + 2.0), 'Kit.turq')
    zw0, zw1 = z + 2.0, z + 9.5
    frustum(p, ax, ay, ax - 0.5, ay - 0.5, zw0, zw1, 'Kit.red', cy=cy)
    front = -(cy - ay) - 0.02  # the wall's front at its foot (as a half size from y = 0)
    p.box((-2.0, -front - 0.3, zw0), (2.0, -front + 0.3, zw0 + 5.6), 'Kit.dark')  # the doorway
    for s in (-1, 1):  # its cream frame and lintel
        x0, x1 = sorted((s * 2.0, s * 2.8))
        p.box((x0, -front - 0.45, zw0), (x1, -front + 0.2, zw0 + 5.6), 'Kit.cream')
    p.box((-3.0, -front - 0.5, zw0 + 5.6), (3.0, -front + 0.2, zw0 + 6.3), 'Kit.cream')
    for c in (-5.9, 5.9):
        spiral(p, 0, front, c, zw0 + 1.2, 4.0, detail)
    for c in (-5.9, 0.0, 5.9):  # the back wall's three
        spiral(p, 2, cy + ay, c, zw0 + 1.2, 4.0, detail)
    for side in (1, 3):  # the sides' spirals (centred on the walls' own centre, a side face spans y in cy ± ay)
        for c in (-3.0, 3.0):
            spiral(p, side, ax, c + (cy if side == 1 else -cy), zw0 + 1.2, 4.0, detail)
    p.box((-4.2, -front - 0.9, zw0 + 6.3), (4.2, -front + 0.2, zw1 + 1.6), 'Kit.cream')  # the carved panel
    if detail:
        for x0, z0, x1, z1 in ((-3.6, 0.6, -0.4, 1.2), (-3.6, 1.2, -3.0, 2.6), (-3.0, 2.0, -1.2, 2.6), (-1.8, 1.4, -1.2, 2.0),
                               (0.4, 0.6, 3.6, 1.2), (3.0, 1.2, 3.6, 2.6), (1.2, 2.0, 3.0, 2.6), (1.2, 1.4, 1.8, 2.0),
                               (-0.4, 1.2, 0.4, 3.4), (-2.6, 3.4, 2.6, 3.9)):
            p.box((x0, -front - 1.2, zw0 + 6.3 + z0), (x1, -front - 0.8, zw0 + 6.3 + z1), 'Kit.sand')
    bx, by = ax - 0.5, ay - 0.5
    ring(p, bx, by, zw1, zw1 + 0.8, 0.3, 'Kit.saffron', cy=cy)
    ring(p, bx, by, zw1 + 0.8, zw1 + 1.6, 0.5, 'Kit.turq', cy=cy)
    zc0, zc1 = zw1 + 1.6, zw1 + 4.2  # the carved cornice and the roof
    p.box((-bx - 1.0, cy - by - 1.0, zc0), (bx + 1.0, cy + by + 1.0, zc1), 'Kit.cream')
    p.box((-bx - 1.3, cy - by - 1.3, zc1), (bx + 1.3, cy + by + 1.3, zc1 + 0.6), 'Kit.cream')
    if detail:  # the cornice's fret frieze: hooks on all four faces
        for side, a, span in ((0, -(cy - by - 1.0), bx + 1.0), (2, cy + by + 1.0, bx + 1.0), (1, bx + 1.0, by + 1.0),
                              (3, bx + 1.0, by + 1.0)):
            off = 0.0 if side in (0, 2) else (cy if side == 1 else -cy)
            n = int(2 * span / 2.4)
            for m in range(n):
                c = off - span + 2.4 * (m + 0.5) + (2 * span - 2.4 * n) / 2
                side_box(p, side, a, c - 0.9, c + 0.9, zc0 + 0.5, zc0 + 1.0, 0.2, 0.4, 'Kit.sand')
                side_box(p, side, a, c + 0.3, c + 0.9, zc0 + 1.0, zc0 + 2.2, 0.2, 0.4, 'Kit.sand')
                side_box(p, side, a, c - 0.9, c + 0.3, zc0 + 1.7, zc0 + 2.2, 0.2, 0.4, 'Kit.sand')
    zr = zc1 + 0.6  # the roof comb on a stepped base, four openings through it
    p.box((-9.0, cy - 2.2, zr), (9.0, cy + 2.2, zr + 0.8), 'Kit.cream')
    zb = zr + 0.8
    top = PLATFORM + 20.0
    if detail:
        p.box((-8.2, cy - 1.0, zb), (8.2, cy + 1.0, zb + 1.2), 'Kit.cream')
        for x in (-7.2, -3.6, 0.0, 3.6, 7.2):
            p.box((x - 0.8, cy - 1.0, zb + 1.2), (x + 0.8, cy + 1.0, top - 1.2), 'Kit.cream')
        p.box((-8.4, cy - 1.1, top - 1.2), (8.4, cy + 1.1, top), 'Kit.cream')
        for x in (-5.4, -1.8, 1.8, 5.4):  # a saffron sill under each opening
            p.box((x - 1.0, cy - 1.1, zb + 1.0), (x + 1.0, cy + 1.1, zb + 1.4), 'Kit.saffron')
    else:
        p.box((-8.2, cy - 1.0, zb), (8.2, cy + 1.0, top), 'Kit.cream')


def feather(p, base, tip, width, thick, slot):
    """A flat eight-faced feather from `base` to `tip`, broadest at 60 % of its length, flat across Blender y."""
    dx, dz = tip[0] - base[0], tip[2] - base[2]
    length = math.hypot(dx, dz) or 1.0
    ux, uz = dx / length, dz / length
    mid = (base[0] + dx * 0.6, base[1], base[2] + dz * 0.6)
    # the cross-section's axes: across the feather in its plane, and through it (y); u x v = the feather's direction
    across, through = (uz, 0.0, -ux), (0.0, 1.0, 0.0)
    rim = []  # counter-clockwise seen from the tip, so [tip, i, i + 1] faces out
    for a in range(4):
        ca, sa = math.cos(a * math.pi / 2), math.sin(a * math.pi / 2)
        rim.append(tuple(mid[i] + across[i] * ca * width / 2 + through[i] * sa * thick / 2 for i in range(3)))
    for i in range(4):
        j = (i + 1) % 4
        p.face([tip, rim[i], rim[j]], slot)
        p.face([base, rim[j], rim[i]], slot)


def standard(p, x, y, detail):
    """A feather standard: a cream foot, a brown pole with a cream glyph block, a turquoise fan round a saffron one."""
    z = PLATFORM
    p.box((x - 1.0, y - 1.0, z), (x + 1.0, y + 1.0, z + 1.4), 'Kit.cream')
    p.box((x - 0.3, y - 0.3, z + 1.4), (x + 0.3, y + 0.3, z + 11.5), 'Kit.wood')
    p.box((x - 0.9, y - 0.9, z + 6.5), (x + 0.9, y + 0.9, z + 8.3), 'Kit.cream')
    if detail:
        p.box((x - 0.5, y - 1.0, z + 6.9), (x + 0.5, y - 0.9, z + 7.9), 'Kit.sand')
    hub = (x, y, z + 11.2)
    for n, length, width, slot, dy in ((9 if detail else 5, 4.6, 1.5, 'Kit.turq', 0.0), (7 if detail else 3, 3.0, 1.1, 'Kit.saffron', -0.45)):
        for i in range(n):
            a = math.radians(-15 + 210 * (i + 0.5) / n)
            base = (hub[0], hub[1] + dy, hub[2])
            tip = (hub[0] + length * math.cos(a), hub[1] + dy, hub[2] + length * math.sin(a))
            feather(p, base, tip, width, 0.35, slot)
    p.box((x - 0.5, y - 0.8, z + 10.4), (x + 0.5, y + 0.3, z + 11.6), 'Kit.saffron')  # the binding


def build(detail):
    p = Piece()
    pyramid(p, detail)
    for k in range(4):
        stair(Turned(p, k), detail)
    temple(p, detail)
    edge = half(TIERS - 1)[1]
    for s in (-1, 1):
        standard(p, s * (edge - 2.4), -(edge - 2.4), detail)
    return p


class Calm:
    """The shade jitter, halved: the painted tiers read as clean flat colour."""

    def __init__(self, seed):
        self.rng = random.Random(seed)

    def uniform(self, a, b):
        return self.rng.uniform(a / 2, b / 2)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    image = atlas_image(SWATCHES, 'ziggurat-atlas')
    near = finish(build(True), 'ziggurat', Calm(SEED), SWATCHES)
    far = finish(build(False), 'ziggurat-far', Calm(SEED), SWATCHES)
    for obj in (near, far):
        zs = [v.co.z for v in obj.data.vertices]
        print(f'{obj.name}: {triangles(obj)} triangles, {min(zs):.2f}-{max(zs):.2f} m')
    export(near, image, os.path.join(out, 'landmark.glb'))
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
