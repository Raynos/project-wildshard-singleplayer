"""bayou.py <out-dir>: Lantern Bayou's theme kit families (OB2, project/archive/2026-11-03-open-plots-build-out.md, G978).

Two families in kit.py's format (kitlib.py), retinted by a layout's palette like every kit family:
- `stilts`: houses standing on timber stilts in the swamp, each with a porch deck, a ladder down to the water and a
  lantern hung on a bracket (G827: every emitter hangs on something);
- `marsh`: the water tile's dressing: a lily-pad cluster with flowers, a reed clump and a ring of cypress knees.
Their water is the canal's (kit.py BRIDGE['water']): the stilts and reeds stand in it from below. Targets:
art/grid/round-62-open-plot-palettes/18-lantern-bayou.jpg. Run: bash scripts/blender/build.sh open-plots/bayou.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import BRIDGE, SLOTS, TRIMS, window  # noqa: E402

WATER = BRIDGE['water']
# Slots a layout may not define (sRGB); the palette's own colour wins.
BAYOU_SLOTS = {**SLOTS, 'plank': '#4a3a2c', 'shingle': '#2c3a3a', 'pad': '#3f6a34', 'padDark': '#2f5228',
               'flowerPink': '#e7a3b8', 'reed': '#6b7a3a', 'reedTip': '#8a6a3a', 'knee': '#4a3c30', 'moss': '#5b6b3a',
               'rope': '#3a2e24'}
BAYOU_TRIMS = {**TRIMS, 'plank': 'timber', 'shingle': 'roofTile'}


def stilts(p, x0, x1, y0, y1, deck, step=2.4, r=0.13):
    """Round timber stilts from below the water to the deck's underside, at most `step` m apart, with cross braces."""
    nx, ny = max(1, round((x1 - x0) / step)), max(1, round((y1 - y0) / step))
    for i in range(nx + 1):
        for k in range(ny + 1):
            if 0 < i < nx and 0 < k < ny:
                continue  # stilts round the edge only
            x, y = x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * k / ny
            p.prism(x, y, r, r * 0.85, WATER - 0.8, deck, 6, 'Kit.wood', cap_top=False)
    for y in (y0, y1):  # a diagonal brace along each long side
        p.box((x0, y - 0.05, WATER + 0.3), (x1, y + 0.05, WATER + 0.45), 'Kit.wood')


def deck_boards(p, x0, x1, y0, y1, z, thick=0.18):
    """A plank deck: one slab carrying the timber trim, a fascia board round it."""
    p.box((x0, y0, z - thick), (x1, y1, z), 'Kit.plank', top='Kit.wood')


def plank_walls(p, x0, x1, y0, y1, z0, z1):
    """Board walls with corner posts and a band under the eave."""
    p.box((x0, y0, z0), (x1, y1, z1), 'Kit.plank')
    p.box((x0 - 0.04, y0 - 0.04, z1 - 0.2), (x1 + 0.04, y1 + 0.04, z1), 'Kit.wood')
    for x in (x0, x1):
        for y in (y0, y1):
            p.box((x - 0.1, y - 0.1, z0), (x + 0.1, y + 0.1, z1), 'Kit.wood')


def gable_roof(p, x0, x1, y0, y1, eave, rise, overhang=0.6, slot='Kit.shingle', under='Kit.wood'):
    """A steep shingled gable roof, its ridge along x, closed underneath, its gable ends boarded."""
    a0, a1, b0, b1 = x0 - overhang, x1 + overhang, y0 - overhang, y1 + overhang
    ym, top = (b0 + b1) / 2, eave + rise
    p.face([(a0, b0, eave), (a1, b0, eave), (a1, ym, top), (a0, ym, top)], slot)
    p.face([(a1, b1, eave), (a0, b1, eave), (a0, ym, top), (a1, ym, top)], slot)
    p.face([(a0, b0, eave - 0.08), (a0, ym, top - 0.08), (a1, ym, top - 0.08), (a1, b0, eave - 0.08)], under)
    p.face([(a1, b1, eave - 0.08), (a1, ym, top - 0.08), (a0, ym, top - 0.08), (a0, b1, eave - 0.08)], under)
    for x, s in ((x0, -1), (x1, 1)):  # the gables
        tri = [(x, y0, eave), (x, ym, eave + rise - 0.1), (x, y1, eave)]
        p.face(tri if s > 0 else list(reversed(tri)), 'Kit.plank')
    p.box((a0, ym - 0.09, top - 0.05), (a1, ym + 0.09, top + 0.12), 'Kit.wood')  # the ridge board


def hung_lantern(p, x, y, top, arm=0.7, face=-1):
    """A small iron-framed lantern hung on a rope from a bracket arm off a post or wall at height `top`."""
    p.box((x - 0.04, y - 0.04, top - 0.05), (x + 0.04, y + face * arm, top + 0.05), 'Kit.iron')
    hy = y + face * (arm - 0.08)
    p.box((x - 0.012, hy - 0.012, top - 0.45), (x + 0.012, hy + 0.012, top - 0.05), 'Kit.rope')
    p.box((x - 0.13, hy - 0.13, top - 0.82), (x + 0.13, hy + 0.13, top - 0.45), 'Glow.lantern')
    p.prism(x, hy, 0.19, 0.03, top - 0.45, top - 0.32, 4, 'Kit.iron', spin=0.785398, cap_bottom=True)
    p.box((x - 0.16, hy - 0.16, top - 0.86), (x + 0.16, hy + 0.16, top - 0.82), 'Kit.iron')
    p.emitter((x, hy, top - 0.64), 'lantern')


def ladder(p, x, y, deck, face=-1):
    """A timber ladder from the deck's edge down into the water."""
    for dx in (-0.3, 0.3):
        p.box((x + dx - 0.05, y - 0.05, WATER - 0.3), (x + dx + 0.05, y + 0.05, deck), 'Kit.wood')
    z = WATER + 0.1
    while z < deck - 0.1:
        p.box((x - 0.3, y - 0.04, z), (x + 0.3, y + 0.04, z + 0.06), 'Kit.wood')
        z += 0.35


def stilt_shack():
    """A 6 x 5 m board shack on stilts 1.6 m over the swamp: a porch deck on its front with a rail, a ladder, a lit
    window either side of its door, a lantern on the porch post (about 600 triangles)."""
    p = Piece()
    deck = 1.6
    stilts(p, -3.2, 3.2, -4.2, 2.6, deck)
    deck_boards(p, -3.2, 3.2, -4.2, 2.6, deck)
    plank_walls(p, -3.0, 3.0, -2.4, 2.5, deck, deck + 2.7)
    gable_roof(p, -3.0, 3.0, -2.4, 2.5, deck + 2.7, 2.2)
    p.box((-0.5, -2.44, deck), (0.5, -2.4, deck + 2.0), 'Kit.door')
    for x in (-1.8, 1.8):
        window(p, x, -2.4, deck + 0.9, 0.9, 0.9)
    window(p, 0, 2.5, deck + 0.9, 1.0, 0.9, face=1)
    for x in (-3.1, 3.1):  # the porch rail posts and rail
        p.box((x - 0.07, -4.17, deck), (x + 0.07, -4.03, deck + 1.0), 'Kit.wood')
    p.box((-3.1, -4.14, deck + 0.9), (3.1, -4.06, deck + 1.0), 'Kit.wood')
    p.box((2.4, -4.17, deck), (2.54, -4.03, deck + 2.6), 'Kit.wood')  # the lantern post
    hung_lantern(p, 2.47, -4.1, deck + 2.5)
    ladder(p, -2.2, -4.25, deck)
    return p


def stilt_house():
    """A 9 x 6 m two-room stilt house with a porch along its front under the eave on posts, three lit windows, a
    lantern at each porch end and a ladder (about 900 triangles)."""
    p = Piece()
    deck = 1.8
    stilts(p, -4.8, 4.8, -4.6, 3.2, deck)
    deck_boards(p, -4.8, 4.8, -4.6, 3.2, deck)
    plank_walls(p, -4.5, 4.5, -2.6, 3.0, deck, deck + 2.9)
    gable_roof(p, -4.5, 4.5, -2.6, 3.0, deck + 2.9, 2.4)
    # the porch roof: a lean-to from under the eave over the front deck, on four posts
    p.face([(-4.7, -4.6, deck + 2.5), (4.7, -4.6, deck + 2.5), (4.7, -2.6, deck + 2.9), (-4.7, -2.6, deck + 2.9)], 'Kit.shingle')
    p.face([(-4.7, -4.6, deck + 2.42), (-4.7, -2.6, deck + 2.82), (4.7, -2.6, deck + 2.82), (4.7, -4.6, deck + 2.42)], 'Kit.wood')
    for x in (-4.5, -1.5, 1.5, 4.5):
        p.box((x - 0.09, -4.5, deck), (x + 0.09, -4.32, deck + 2.5), 'Kit.wood')
    p.box((-1.2, -2.64, deck), (-0.2, -2.6, deck + 2.0), 'Kit.door')
    for x in (-3.0, 1.2, 3.0):
        window(p, x, -2.6, deck + 0.9, 0.9, 1.0)
    for x in (-2.0, 2.0):
        window(p, x, 3.0, deck + 0.9, 0.9, 1.0, face=1)
    for x in (-4.5, 4.5):
        hung_lantern(p, x, -4.41, deck + 2.3, arm=0.5)
    ladder(p, 3.6, -4.65, deck)
    return p


def boat_house():
    """An open boat shelter on stilts: a shingled roof on posts over a slip, a moored flat boat with a pole lantern,
    a side deck (about 500 triangles)."""
    p = Piece()
    deck = 1.2
    stilts(p, 2.0, 4.0, -3.5, 3.5, deck)
    deck_boards(p, 2.0, 4.0, -3.5, 3.5, deck)
    for x in (-3.5, 4.0):
        for y in (-3.5, 0.0, 3.5):
            p.prism(x, y, 0.12, 0.1, WATER - 0.8, deck + 2.6, 6, 'Kit.wood', cap_top=False)
    gable_roof(p, -3.5, 4.0, -3.5, 3.5, deck + 2.6, 1.8, overhang=0.5)
    # the boat: a flat-bottomed skiff with raised ends in the slip
    bz = WATER + 0.05
    p.box((-2.6, -2.6, bz), (0.6, 2.6, bz + 0.35), 'Kit.wood', top='Kit.plank')
    p.box((-2.4, -2.9, bz + 0.05), (0.4, -2.6, bz + 0.55), 'Kit.wood')
    p.box((-2.4, 2.6, bz + 0.05), (0.4, 2.9, bz + 0.55), 'Kit.wood')
    p.box((-1.04, 1.9, bz + 0.35), (-0.96, 1.98, bz + 2.2), 'Kit.wood')  # the lantern pole
    hung_lantern(p, -1.0, 1.94, bz + 2.15, arm=0.45, face=1)
    p.emitter((3.0, 0.0, deck + 2.2), 'window')  # a warm spill under the roof
    p.box((2.8, -0.2, deck + 2.15), (3.2, 0.2, deck + 2.4), 'Glow.window')
    return p


def lily_cluster(seed=3):
    """Lily pads floating on the water (notched discs in two greens) round three pink flowers (about 400 triangles)."""
    p = Piece()
    rng = (seed * 9301 + 49297) % 233280
    def rand():
        nonlocal rng
        rng = (rng * 9301 + 49297) % 233280
        return rng / 233280
    z = WATER + 0.03
    for i in range(30):
        a, d = i * 2.399963, 0.5 + 4.5 * math.sqrt((i + 0.5) / 30)
        cx, cy, r = d * math.cos(a), d * math.sin(a), 0.45 + 0.45 * rand()
        notch, sides = rand() * math.tau, 9
        pts = []
        for s in range(sides):
            t = notch + 0.35 + (math.tau - 0.7) * s / (sides - 1)
            pts.append((cx + r * math.cos(t), cy + r * math.sin(t), z))
        pts.append((cx, cy, z))
        p.face(pts, 'Kit.pad' if i % 3 else 'Kit.padDark')
    for i, (fx, fy) in enumerate(((0.4, 0.2), (-1.3, 1.1), (1.6, -1.4), (-2.8, -1.9), (3.1, 2.2), (-0.6, 3.4))):
        p.lathe(fx, fy, [(0.06, z), (0.3, z + 0.16), (0.16, z + 0.36)], 6, ['Kit.flowerPink', 'Kit.flowerPink'], spin=i * 0.4)
        p.prism(fx, fy, 0.08, 0.03, z + 0.12, z + 0.28, 5, 'Kit.flowerGold')
    return p


def reed_clump():
    """A wide clump of tall reeds and cattails standing out of the water (tapered blades, brown heads), dense enough to
    read as a reed bed from 100 m."""
    p = Piece()
    for i in range(44):
        a, d = i * 2.399963, 0.2 + 2.2 * math.sqrt((i + 0.5) / 44)
        x, y, h = d * math.cos(a), d * math.sin(a), 1.4 + 1.2 * ((i * 37) % 10) / 10
        p.prism(x, y, 0.09, 0.01, WATER - 0.1, WATER + h, 3, 'Kit.reed', spin=a)
        if i % 4 == 0:
            p.prism(x, y, 0.08, 0.08, WATER + h * 0.72, WATER + h * 0.88, 5, 'Kit.reedTip')
    return p


def cypress_knees():
    """A ring of cypress knees (knobbly stumps poking out of the water) with moss on their tops."""
    p = Piece()
    for i in range(9):
        a, d = i * 2.399963, 0.5 + 1.8 * math.sqrt((i + 0.5) / 9)
        x, y, h = d * math.cos(a), d * math.sin(a), 0.4 + 0.5 * ((i * 53) % 10) / 10
        r = 0.16 + 0.1 * ((i * 17) % 10) / 10
        p.lathe(x, y, [(r * 1.3, WATER - 0.2), (r, WATER + h * 0.5), (r * 0.6, WATER + h), (0.0, WATER + h + 0.06)], 7,
                ['Kit.knee', 'Kit.knee', 'Kit.moss'], spin=a)
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene(ground=WATER)
    build_family(out, 'stilts', [stilt_shack, stilt_house, boat_house], BAYOU_TRIMS, {'slots': BAYOU_SLOTS})
    reset_scene(ground=WATER)
    build_family(out, 'marsh', [lily_cluster, reed_clump, cypress_knees], BAYOU_TRIMS, {'slots': BAYOU_SLOTS})


if __name__ == '__main__':
    main()
