"""peak.py <out-dir>: Frostline Peaks' landmark as a Blender script (OB3, docs/plans/open-plots/build-out-mini-plan.md):
the script take of the granite peak with its summit lodge and chair lift, beside the image-to-3D takes on the pick board
(art/frostline-peaks/round-1-landmark/).

Faceted low poly in the open plots' kit idiom (G978: blocky): a crag of stepped, jittered rock rings whose every
up-facing face is snow (by its normal), boulders on its shoulders, a two-storey timber lodge with a steep snow-loaded
roof and lit windows on the summit ledge, and the chair lift up the south-east flank: three lattice towers, a cable
loop and twelve chairs hung from it. Every face samples the swatch atlas (landmarklib.py). Exports landmark.glb (near,
<= 20k triangles) and landmark-far.glb (<= 2.5k), 70 m tall, pivot at the crag's foot, front +Z.
Run: bash scripts/blender/build.sh open-plots/peak.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import tube  # noqa: E402
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, far_copy, finish, triangles  # noqa: E402

HEIGHT = 70.0
SEED = 11
# sRGB swatches, lightest first (judged against art/grid/round-62-open-plot-palettes/16-frostline-peaks.jpg)
SWATCHES = {
    'rock': ['#8e949c', '#757b84', '#5f646d', '#4a4e57'],
    'snow': ['#f4f8fc', '#dfe8f2', '#c4d3e6', '#a7bcd8'],
    'timber': ['#8a6040', '#734f34', '#5c3f2a', '#46301f'],
    'window': ['#ffd88a', '#ffc96a', '#f0b456', '#d89a44'],
    'iron': ['#4a4f58', '#3c4048', '#30333a', '#25272d'],
    'chair': ['#c84a3a', '#a83c30', '#8a3128', '#6c2620'],
    'pine': ['#3f6a52', '#335a45', '#284a39', '#1e3a2d'],
}
# the crag's profile, foot to summit ledge (height m, radius m); every third level steps in (a snowy ledge)
PROFILE = [(0.0, 40.0), (3.0, 38.5), (6.5, 35.0), (6.5, 32.0), (11.0, 30.5), (16.0, 28.0), (16.0, 25.5), (21.0, 24.0),
           (27.0, 21.5), (27.0, 19.0), (33.0, 17.5), (39.0, 15.0), (39.0, 12.8), (46.0, 11.2), (54.0, 9.0)]
# the rock's rings: the profile with a jittered mid ring between two levels that are not a ledge
RINGS = [ring for (z0, r0), (z1, r1) in zip(PROFILE, PROFILE[1:]) for ring in ([(z0, r0)] if z0 == z1 else
         [(z0, r0), ((z0 + z1) / 2, (r0 + r1) / 2)])] + [PROFILE[-1]]
SIDES = 52


def surface(d):
    """The crag's height at distance `d` from its axis (the profile's radius falls as it rises)."""
    for (z0, r0), (z1, r1) in zip(PROFILE, PROFILE[1:]):
        if r1 <= d <= r0 and r0 > r1:
            return z0 + (z1 - z0) * (r0 - d) / (r0 - r1)
    return 0.0 if d > PROFILE[0][1] else PROFILE[-1][0]


def crag(p, rng):
    """The rock: jittered rings (radius and height per vertex), a flat summit ledge for the lodge."""
    bm, slot = p.bm, p.slot('Kit.rock')
    loops = []
    for n, (z, r) in enumerate(RINGS):
        ring = []
        for i in range(SIDES):
            a = 2 * math.pi * i / SIDES + n * 0.17
            inner = 0 < n < len(RINGS) - 1
            rr = r * (rng.uniform(0.86, 1.1) + (0.07 if i % 3 == 0 else 0.0)) if inner else r * rng.uniform(0.95, 1.05)
            zz = z + (rng.uniform(-1.2, 1.2) if inner else 0.0)
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), zz)))
        loops.append(ring)
    for a, b in zip(loops, loops[1:]):
        for i in range(SIDES):
            j = (i + 1) % SIDES
            bm.faces.new((a[i], a[j], b[j], b[i])).material_index = slot
    bm.faces.new(loops[-1]).material_index = slot  # the summit ledge


def boulders(p, rng):
    """Chunky boulders on the shoulders and round the foot: eight-sided lumpy lathes."""
    for z, r, count, size in ((0.0, 41.0, 30, 4.6), (6.5, 33.0, 22, 3.6), (16.0, 26.0, 16, 3.2), (27.0, 19.5, 13, 2.8),
                              (39.0, 13.2, 9, 2.4)):
        for i in range(count):
            a = 2 * math.pi * (i + rng.uniform(0, 0.6)) / count
            x, y, s = r * math.cos(a), r * math.sin(a), size * rng.uniform(0.7, 1.3)
            p.lathe(x, y, [(s * 0.9, z - 0.5), (s, z + s * 0.4), (s * 0.82, z + s * 0.75), (s * 0.5, z + s * 1.0),
                           (0.0, z + s * 1.15)], 12,
                    ['Kit.rock'], spin=rng.uniform(0, math.pi))


def pines(p, rng):
    """Snow-dusted pines on the ledges and round the foot (the mockup's dense pines): a trunk and three stacked
    seven-sided tiers each, a snow cap on the top tier, 5-9 m tall."""
    rows = [(0.0, 43.0, 36), (6.5, 34.0, 26), (16.0, 26.5, 17), (27.0, 20.0, 12), (39.0, 13.8, 8)]
    for z, r, count in rows:
        for i in range(count):
            a = 2 * math.pi * (i + rng.uniform(0.2, 0.8)) / count
            if abs(((a - math.radians(-35) + math.pi) % (2 * math.pi)) - math.pi) < 0.32:
                continue  # the lift's line stays clear
            x, y, h = r * math.cos(a), r * math.sin(a), rng.uniform(5.0, 9.0)
            p.prism(x, y, 0.35, 0.25, z - 0.3, z + h * 0.3, 5, 'Kit.timber')
            for k, (lo, hi, w) in enumerate(((0.22, 0.62, 0.42), (0.45, 0.85, 0.32), (0.66, 1.0, 0.22))):
                p.lathe(x, y, [(h * w, z + h * lo), (0.0, z + h * hi)], 7, ['Kit.snow' if k == 2 else 'Kit.pine'],
                        spin=rng.uniform(0, math.pi), cap_bottom=True)


def lodge(p, base):
    """The summit lodge: a 10 x 7 m two-storey timber house, a steep gable roof whose slopes are snow, a chimney, lit
    windows on both floors, a balcony on its front (-y)."""
    x0, x1, y0, y1, eave, rise = -5.0, 5.0, -3.5, 3.5, base + 6.4, 4.2
    p.box((x0, y0, base), (x1, y1, eave), 'Kit.timber')
    for x in (x0, x1):  # corner posts
        for y in (y0, y1):
            p.box((x - 0.25, y - 0.25, base), (x + 0.25, y + 0.25, eave), 'Kit.timber')
    o, ym, top = 0.9, 0.0, eave + rise
    p.face([(x0 - o, y0 - o, eave), (x1 + o, y0 - o, eave), (x1 + o, ym, top), (x0 - o, ym, top)], 'Kit.snow')
    p.face([(x1 + o, y1 + o, eave), (x0 - o, y1 + o, eave), (x0 - o, ym, top), (x1 + o, ym, top)], 'Kit.snow')
    p.face([(x0 - o, y0 - o, eave - 0.3), (x0 - o, ym, top - 0.3), (x1 + o, ym, top - 0.3), (x1 + o, y0 - o, eave - 0.3)], 'Kit.timber')
    p.face([(x1 + o, y1 + o, eave - 0.3), (x1 + o, ym, top - 0.3), (x0 - o, ym, top - 0.3), (x0 - o, y1 + o, eave - 0.3)], 'Kit.timber')
    for x, s in ((x0, -1), (x1, 1)):  # the gables
        tri = [(x, y0, eave), (x, ym, top - 0.2), (x, y1, eave)]
        p.face(tri if s > 0 else list(reversed(tri)), 'Kit.timber')
    p.box((2.2, 0.8, top - 2.0), (3.4, 2.0, top + 1.6), 'Kit.rock', top='Kit.snow')  # the chimney
    for z in (base + 1.0, base + 4.0):  # lit windows, front and back
        for x in (-3.2, -1.0, 1.2, 3.4):
            p.box((x - 0.55, y0 - 0.06, z), (x + 0.55, y0, z + 1.3), 'Kit.window')
            p.box((x - 0.55, y1, z), (x + 0.55, y1 + 0.06, z + 1.3), 'Kit.window')
    p.box((x0 - 0.4, y0 - 2.2, base + 3.1), (x1 + 0.4, y0, base + 3.4), 'Kit.timber', top='Kit.snow', bottom=True)  # balcony
    p.box((x0 - 0.4, y0 - 2.3, base + 3.4), (x1 + 0.4, y0 - 2.1, base + 4.3), 'Kit.timber')  # its rail


def tower(p, x, y, z0, z1):
    """A lift tower: a tapered four-legged iron lattice with a cross arm and sheave wheels."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            tube(p, [(x + sx * 1.6, y + sy * 1.6, z0), (x + sx * 0.5, y + sy * 0.5, z1)], [0.22, 0.16], 4, 'Kit.iron', (sx, sy, 0))
    for k in range(1, 4):  # the lattice rings
        t = k / 4
        h, r = z0 + (z1 - z0) * t, 1.6 - 1.1 * t
        p.box((x - r, y - r, h - 0.1), (x + r, y + r, h + 0.1), 'Kit.iron')
    p.box((x - 0.3, y - 3.6, z1), (x + 0.3, y + 3.6, z1 + 0.6), 'Kit.iron')  # the cross arm (across the line)


def lift(p, rng):
    """The chair lift up the south-east flank, from a bottom station at the crag's foot to the lodge ledge: three towers,
    an up and a down cable 3 m apart, twelve red chairs hanging from them on their poles."""
    a = math.radians(-35)  # the line's bearing (Blender y back = game -z: the front-right flank)
    ux, uy = math.cos(a), math.sin(a)
    # (distance out, cable height): the bottom station past the foot, three towers 9 m over the crag's surface just
    # outside it, the top station at the lodge's ledge
    path = [(50.0, 4.0)] + [(d, surface(d - 2.5) + 9.0) for d in (37.0, 27.0, 18.0)] + [(9.5, PROFILE[-1][0] + 3.0)]
    for d, h in path[1:-1]:
        tower(p, d * ux, d * uy, surface(d - 2.5) - 1.0, h)
    p.box((48.0 * ux - 3, 48.0 * uy - 3, 0.0), (48.0 * ux + 3, 48.0 * uy + 3, 3.2), 'Kit.timber', top='Kit.snow')  # bottom hut
    for side in (-1.5, 1.5):
        ox, oy = -uy * side, ux * side
        pts = [(d * ux + ox, d * uy + oy, h + 0.6) for d, h in path]
        tube(p, pts, [0.08] * len(pts), 3, 'Kit.iron', (ox, oy, 0))
        for k in range(6):  # chairs hung on the cable
            t = (k + 0.5) / 6
            seg = min(int(t * (len(path) - 1)), len(path) - 2)
            u = t * (len(path) - 1) - seg
            (d0, h0), (d1, h1) = path[seg], path[seg + 1]
            d, h = d0 + (d1 - d0) * u, h0 + (h1 - h0) * u
            cx, cy = d * ux + ox, d * uy + oy
            p.box((cx - 0.05, cy - 0.05, h - 2.0), (cx + 0.05, cy + 0.05, h + 0.6), 'Kit.iron')
            p.box((cx - 0.8, cy - 0.5, h - 2.4), (cx + 0.8, cy + 0.5, h - 2.0), 'Kit.chair')
            p.box((cx - 0.8, cy + 0.4, h - 2.4), (cx + 0.8, cy + 0.5, h - 1.5), 'Kit.chair')


def snow_on_top(slot, poly):
    """Rock that faces up is snow: a ledge, a shoulder, a boulder's crown."""
    return 'snow' if slot == 'rock' and poly.normal.z > 0.3 else slot


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(SEED)
    p = Piece()
    crag(p, rng)
    boulders(p, rng)
    pines(p, rng)
    lodge(p, RINGS[-1][0])
    lift(p, rng)
    near = finish(p, 'peak', random.Random(SEED + 1), SWATCHES, snow_on_top)
    top = max(v.co.z for v in near.data.vertices)
    for v in near.data.vertices:
        v.co *= HEIGHT / top
    image = atlas_image(SWATCHES, 'peak-atlas')
    print(f'peak near: {triangles(near)} triangles')
    export(near, image, os.path.join(out, 'landmark.glb'))
    far = far_copy(near, 2400)
    print(f'peak far: {triangles(far)} triangles')
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
