"""lagoon.py <out-dir>: Coral Drift's theme kit families (OB5, project/archive/2026-11-03-open-plots-build-out.md, G978).

Three families in kit.py's format (kitlib.py), retinted by a layout's palette like every kit family:
- `huts`: the beach-hut tile's buildings in sun-bleached timber under blue roofs: a stilt hut over the water with a
  ladder, a hut on a short pier with a lit doorway, and an open cabana on four posts;
- `palms`: the shared palm tile's trees (Desert Ruin reuses them): a tall leaning palm, a short double palm and a
  young palm, each a curved ringed trunk under drooping fronds, coconuts at the crown;
- `reef`: the coral-pool tile's dressing: a staghorn coral cluster, a mound of brain coral and sea fans, and a group of
  pale rocks.
Their water is the canal's (kit.py BRIDGE['water']): stilts, piers and coral stand in it from below. Each lamp hangs on
a post or bracket (G827). Target: art/grid/round-62-open-plot-palettes/10-coral-drift.jpg.
Run: bash scripts/blender/build.sh open-plots/lagoon.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import BRIDGE, SLOTS, TRIMS, window  # noqa: E402
from bayou import deck_boards, hung_lantern, ladder, stilts  # noqa: E402

WATER = BRIDGE['water']
# Slots a layout may not define (sRGB); the palette's own colour wins.
LAGOON_SLOTS = {**SLOTS, 'plank': '#d8c8a8', 'hutRoof': '#2a4e8a', 'thatch': '#c8a868', 'palmTrunk': '#8a6a48',
                'palmRing': '#6e5238', 'frond': '#3f9a48', 'frondDark': '#2e7a3a', 'coconut': '#6a4a2a',
                'coralPink': '#f585b4', 'coralPeach': '#f7ad84', 'coralLilac': '#bb8ce4', 'rock': '#c8c4b8',
                'rockDark': '#a8a498', 'rope': '#8a7458'}
LAGOON_TRIMS = {**TRIMS, 'plank': 'timber', 'hutRoof': 'roofTile'}


def jitter(i, k=0):
    """A seeded draw in [0, 1) from two integers (the kit's builders stay deterministic without an rng)."""
    return ((i * 7919 + k * 104729 + 13) % 1009) / 1009


def hut_walls(p, x0, x1, y0, y1, z0, z1):
    """Bleached board walls with corner posts and a band under the eave."""
    p.box((x0, y0, z0), (x1, y1, z1), 'Kit.plank')
    p.box((x0 - 0.04, y0 - 0.04, z1 - 0.2), (x1 + 0.04, y1 + 0.04, z1), 'Kit.wood')
    for x in (x0, x1):
        for y in (y0, y1):
            p.box((x - 0.1, y - 0.1, z0), (x + 0.1, y + 0.1, z1), 'Kit.wood')


def hip_roof(p, x0, x1, y0, y1, eave, rise, overhang=0.7):
    """A blue hipped roof (four slopes to a short ridge along x), closed underneath."""
    a0, a1, b0, b1 = x0 - overhang, x1 + overhang, y0 - overhang, y1 + overhang
    ym, top, inset = (b0 + b1) / 2, eave + rise, min((a1 - a0) / 2 - 0.1, (b1 - b0) / 2)
    r0, r1 = a0 + inset, a1 - inset
    p.face([(a0, b0, eave), (a1, b0, eave), (r1, ym, top), (r0, ym, top)], 'Kit.hutRoof')
    p.face([(a1, b1, eave), (a0, b1, eave), (r0, ym, top), (r1, ym, top)], 'Kit.hutRoof')
    p.face([(a1, b0, eave), (a1, b1, eave), (r1, ym, top)], 'Kit.hutRoof')
    p.face([(a0, b1, eave), (a0, b0, eave), (r0, ym, top)], 'Kit.hutRoof')
    p.face([(a0, b1, eave - 0.06), (a1, b1, eave - 0.06), (a1, b0, eave - 0.06), (a0, b0, eave - 0.06)], 'Kit.wood')
    p.box((r0 - 0.05, ym - 0.1, top - 0.05), (r1 + 0.05, ym + 0.1, top + 0.1), 'Kit.wood')


def stilt_hut():
    """A 5 x 4 m beach hut on stilts 1.4 m over the lagoon under a blue hipped roof: a front deck with a rail, a lit
    window either side of its door, a lantern on the deck post, a ladder (about 600 triangles)."""
    p = Piece()
    deck = 1.4
    stilts(p, -2.8, 2.8, -3.8, 2.3, deck)
    deck_boards(p, -2.8, 2.8, -3.8, 2.3, deck)
    hut_walls(p, -2.5, 2.5, -2.0, 2.0, deck, deck + 2.5)
    hip_roof(p, -2.5, 2.5, -2.0, 2.0, deck + 2.5, 1.6)
    p.box((-0.45, -2.04, deck), (0.45, -2.0, deck + 1.9), 'Kit.door')
    for x in (-1.6, 1.6):
        window(p, x, -2.0, deck + 0.9, 0.8, 0.8)
    for x in (-2.7, 2.7):
        p.box((x - 0.06, -3.76, deck), (x + 0.06, -3.64, deck + 0.95), 'Kit.wood')
    p.box((-2.7, -3.74, deck + 0.85), (2.7, -3.66, deck + 0.95), 'Kit.wood')
    p.box((2.1, -3.77, deck), (2.23, -3.64, deck + 2.4), 'Kit.wood')
    hung_lantern(p, 2.16, -3.7, deck + 2.3, arm=0.4)
    ladder(p, -1.9, -3.85, deck)
    return p


def pier_hut():
    """A small hut at the end of a short timber pier, a lit doorway, rope rails on posts, a lantern on the pier's end
    post (about 700 triangles)."""
    p = Piece()
    deck = 0.9
    stilts(p, -1.2, 1.2, -6.0, 0.0, deck, step=2.0)
    deck_boards(p, -1.2, 1.2, -6.0, 0.0, deck)
    stilts(p, -2.6, 2.6, 0.0, 4.6, deck)
    deck_boards(p, -2.6, 2.6, 0.0, 4.6, deck)
    hut_walls(p, -2.2, 2.2, 0.6, 4.2, deck, deck + 2.4)
    hip_roof(p, -2.2, 2.2, 0.6, 4.2, deck + 2.4, 1.4, overhang=0.6)
    p.box((-0.5, 0.56, deck), (0.5, 0.6, deck + 1.9), 'Glow.window')
    window(p, 1.5, 0.6, deck + 0.9, 0.7, 0.7)
    for x in (-1.15, 1.15):  # the rope rails
        for y in (-5.9, -4.0, -2.0, -0.1):
            p.box((x - 0.06, y - 0.06, deck), (x + 0.06, y + 0.06, deck + 0.95), 'Kit.wood')
        p.box((x - 0.02, -5.9, deck + 0.82), (x + 0.02, -0.1, deck + 0.87), 'Kit.rope')
    p.box((1.08, -6.06, deck), (1.22, -5.92, deck + 2.3), 'Kit.wood')
    hung_lantern(p, 1.15, -5.99, deck + 2.2, arm=0.45)
    return p


def cabana():
    """An open cabana on four posts: a thatched hipped roof, a bench and a low table under it, on the sand (about 400
    triangles)."""
    p = Piece()
    for x in (-2.0, 2.0):
        for y in (-2.0, 2.0):
            p.box((x - 0.1, y - 0.1, 0.0), (x + 0.1, y + 0.1, 2.5), 'Kit.wood')
    p.box((-2.1, -2.1, 2.35), (2.1, 2.1, 2.5), 'Kit.wood')
    a0, a1, top = -2.7, 2.7, 3.9
    p.face([(a0, a0, 2.5), (a1, a0, 2.5), (0.0, 0.0, top)], 'Kit.thatch')
    p.face([(a1, a0, 2.5), (a1, a1, 2.5), (0.0, 0.0, top)], 'Kit.thatch')
    p.face([(a1, a1, 2.5), (a0, a1, 2.5), (0.0, 0.0, top)], 'Kit.thatch')
    p.face([(a0, a1, 2.5), (a0, a0, 2.5), (0.0, 0.0, top)], 'Kit.thatch')
    p.face([(a0, a1, 2.45), (a1, a1, 2.45), (a1, a0, 2.45), (a0, a0, 2.45)], 'Kit.thatch')
    p.box((-1.6, 1.0, 0.0), (1.6, 1.6, 0.45), 'Kit.plank')  # the bench, then the table
    p.box((-0.8, -0.6, 0.0), (0.8, 0.4, 0.6), 'Kit.plank')
    return p


def trunk(p, base, lean, height, r0, r1, rings=9, sides=7):
    """A palm trunk: a ringed tapered tube bending along `lean` (unit xy), each ring a slightly wider band."""
    pts = []
    for i in range(rings + 1):
        t = i / rings
        bend = height * 0.32 * t * t
        pts.append((base[0] + lean[0] * bend, base[1] + lean[1] * bend, base[2] + height * t, r0 + (r1 - r0) * t))
    for i in range(rings):
        (xa, ya, za, ra), (xb, yb, zb, rb) = pts[i], pts[i + 1]
        for k in range(sides):
            a0, a1 = 2 * math.pi * k / sides, 2 * math.pi * (k + 1) / sides
            p.face([(xa + ra * math.cos(a0), ya + ra * math.sin(a0), za), (xa + ra * math.cos(a1), ya + ra * math.sin(a1), za),
                    (xb + rb * math.cos(a1), yb + rb * math.sin(a1), zb), (xb + rb * math.cos(a0), yb + rb * math.sin(a0), zb)],
                   'Kit.palmTrunk' if i % 2 else 'Kit.palmRing')
    return pts[-1][:3]


def crown(p, top, fronds, length, seed):
    """Drooping fronds from the crown (each a strip of four tapering, sagging quads seen from both sides, its leaflets
    as a zigzag edge) and three coconuts under them."""
    x, y, z = top
    for f in range(fronds):
        a = 2 * math.pi * f / fronds + jitter(f, seed) * 0.5
        lift = 0.55 - 0.5 * jitter(f, seed + 1)
        ca, sa = math.cos(a), math.sin(a)
        prev = None
        for s in range(5):
            t = s / 4
            d = length * t
            h = z + length * (lift * t - 0.9 * t * t)
            w = 0.9 * math.sin(math.pi * min(1.0, t * 1.15 + 0.08))
            mid = (x + ca * d, y + sa * d, h)
            edge = (-sa * w, ca * w, 0.0)
            row = [(mid[0] - edge[0], mid[1] - edge[1], mid[2] - 0.12 * t), mid, (mid[0] + edge[0], mid[1] + edge[1], mid[2] - 0.12 * t)]
            if prev is not None:
                slot = 'Kit.frond' if f % 2 else 'Kit.frondDark'
                p.panel([prev[0], row[0], row[1], prev[1]], slot)
                p.panel([prev[1], row[1], row[2], prev[2]], slot)
            prev = row
    for c in range(3):
        a = c * 2.1 + seed
        p.prism(x + 0.28 * math.cos(a), y + 0.28 * math.sin(a), 0.2, 0.12, z - 0.45, z - 0.1, 6, 'Kit.coconut', cap_bottom=True)


def palm_tall():
    """A 9 m palm leaning out, eleven fronds (about 450 triangles)."""
    p = Piece()
    top = trunk(p, (0.0, 0.0, 0.0), (0.8, 0.6), 9.0, 0.3, 0.2)
    crown(p, top, 11, 3.6, 1)
    return p


def palm_double():
    """Two palms from one foot, a short one leaning the other way (about 750 triangles)."""
    p = Piece()
    crown(p, trunk(p, (0.15, 0.0, 0.0), (0.9, -0.4), 7.5, 0.28, 0.19), 10, 3.2, 2)
    crown(p, trunk(p, (-0.15, 0.1, 0.0), (-0.8, 0.5), 5.2, 0.24, 0.17, rings=7), 9, 2.8, 3)
    return p


def palm_young():
    """A young 4 m palm, nearly straight, eight short fronds (about 300 triangles)."""
    p = Piece()
    crown(p, trunk(p, (0.0, 0.0, 0.0), (0.3, 0.9), 4.0, 0.22, 0.16, rings=6), 8, 2.4, 4)
    return p


def lump(p, x, y, z, r, slot, seed):
    """A faceted coral lump: a jittered seven-sided double cone."""
    sides = 7
    ring = [(x + r * (0.85 + 0.3 * jitter(i, seed)) * math.cos(2 * math.pi * i / sides),
             y + r * (0.85 + 0.3 * jitter(i, seed + 1)) * math.sin(2 * math.pi * i / sides), z + r * 0.2 * (jitter(i, seed + 2) - 0.5))
            for i in range(sides)]
    top, bottom = (x, y, z + r * 0.9), (x, y, z - r * 0.7)
    for i in range(sides):
        a, b = ring[i], ring[(i + 1) % sides]
        p.face([a, b, top], slot)
        p.face([b, a, bottom], slot)


def staghorn(p, x, y, base, height, r, slot, seed):
    """A staghorn finger: a tapered five-sided limb up and out, forked at its top, blunt tips."""
    for k, (dx, dy, h) in enumerate(((0.0, 0.0, 1.0), (0.35, 0.2, 0.55), (-0.3, -0.25, 0.5))):
        x1, y1 = x + dx * height * 0.5, y + dy * height * 0.5
        z0 = base if k == 0 else base + height * 0.55
        z1 = z0 + height * h
        p.prism(x if k == 0 else x + dx * 0.2, y if k == 0 else y + dy * 0.2, r if k == 0 else r * 0.7, r * 0.6 if k == 0 else r * 0.45,
                z0, z1, 5, slot, spin=seed + k)
        if k > 0:
            lump(p, x1, y1, z1, r * 0.55, slot, seed + k)


def coral_cluster():
    """A staghorn coral cluster standing out of the lagoon: fingers in pink, peach and lilac among faceted lumps (about
    700 triangles)."""
    p = Piece()
    slots = ['Kit.coralPink', 'Kit.coralPeach', 'Kit.coralLilac']
    for i in range(14):
        a, d = i * 2.399963, 0.3 + 2.0 * math.sqrt((i + 0.5) / 14)
        x, y = d * math.cos(a), d * math.sin(a)
        if i % 2 == 0:
            staghorn(p, x, y, WATER - 0.4, 1.2 + 1.0 * jitter(i, 5), 0.22, slots[i % 3], i)
        else:
            lump(p, x, y, WATER + 0.1, 0.4 + 0.3 * jitter(i, 6), slots[(i + 1) % 3], i)
    return p


def brain_mound():
    """A mound of brain coral heads with sea fans fanned up behind them (about 600 triangles)."""
    p = Piece()
    for i, (x, y, r) in enumerate(((0.0, 0.0, 1.1), (1.3, 0.5, 0.8), (-1.1, 0.7, 0.75), (0.4, -1.2, 0.7), (-0.6, -0.9, 0.55))):
        p.lathe(x, y, [(r, WATER - 0.3), (r * 1.05, WATER + 0.1), (r * 0.85, WATER + r * 0.6), (r * 0.45, WATER + r * 0.9), (0.0, WATER + r)],
                9, ['Kit.coralPeach', 'Kit.coralPeach', 'Kit.coralPink', 'Kit.coralPink'], spin=i * 0.7)
    for i, (x, y, a) in enumerate(((-0.4, 1.4, 0.2), (0.9, 1.5, -0.3), (-1.6, 0.0, 1.2))):  # the sea fans
        ca, sa = math.cos(a), math.sin(a)
        fan = [(x, y, WATER)] + [(x + ca * 1.1 * math.cos(t), y + sa * 1.1 * math.cos(t), WATER + 0.2 + 1.4 * math.sin(t))
                                 for t in [math.pi * k / 6 for k in range(7)]]
        p.panel(fan, 'Kit.coralLilac')
    return p


def rock_group():
    """A group of pale faceted rocks half out of the water, the biggest with a coral crust (about 300 triangles)."""
    p = Piece()
    for i, (x, y, r, h) in enumerate(((0.0, 0.0, 1.3, 1.1), (1.6, -0.6, 0.8, 0.6), (-1.4, 0.8, 0.9, 0.8), (0.7, 1.4, 0.5, 0.4))):
        p.lathe(x, y, [(r, WATER - 0.5), (r * 1.08, WATER + h * 0.3), (r * 0.7, WATER + h * 0.8), (r * 0.2, WATER + h)],
                6, ['Kit.rockDark', 'Kit.rock', 'Kit.rock'], spin=i * 0.9)
    lump(p, 0.2, 0.3, WATER + 1.0, 0.45, 'Kit.coralPink', 3)
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene(ground=WATER)
    build_family(out, 'huts', [stilt_hut, pier_hut, cabana], LAGOON_TRIMS, {'slots': LAGOON_SLOTS})
    reset_scene()
    build_family(out, 'palms', [palm_tall, palm_double, palm_young], LAGOON_TRIMS, {'slots': LAGOON_SLOTS})
    reset_scene(ground=WATER)
    build_family(out, 'reef', [coral_cluster, brain_mound, rock_group], LAGOON_TRIMS, {'slots': LAGOON_SLOTS})


if __name__ == '__main__':
    main()
