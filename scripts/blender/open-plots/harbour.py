"""harbour.py <out-dir>: Saltwind Lighthouse's theme kit family (OPEN-PLOTS OP9), in kit.py's format (kitlib.py), retinted
by a layout's palette like every kit family. Target: art/grid/round-75-new-plot-palettes/04-saltwind-lighthouse.jpg.

`harbour`, three variants in the harbour's storm palette (whitewash and black tar, one red):
- 0 boat: an 11 m fishing boat moored in a basin, a signal-red hull with a white sheer strake and black boot top, a white
  wheelhouse with lit windows and a black roof, a mast with a stay and a lamp, a winch and a tarred hatch (its waterline
  at the model's 0: the generator stands it on the basin's water);
- 1 cottage: a 9 x 6 m whitewashed fisher's cottage on a basalt footing, a steep black gable roof with a chimney at each
  end, two lit windows and a black door on its front (+z, glTF), a lit window on its back (the corner boathouse is this
  variant, turned);
- 2 nets: a 6 m net-drying rack (black tarred posts and rails hung with grey-green nets), a stack of lobster pots
  beside it and a red-and-white buoy post.
Run: bash scripts/blender/build.sh open-plots/harbour.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS, door, window  # noqa: E402

# Slots a layout may not define (sRGB); the palette's own colour wins.
HARBOUR_SLOTS = {**SLOTS, 'hull': '#c8362c', 'hullTrim': '#f0eee8', 'boot': '#1c1e22', 'cabin': '#f0eee8',
                 'tar': '#232428', 'net': '#5c6a64', 'pot': '#7a5a3a', 'buoy': '#d63a30', 'basalt': '#3e4248',
                 'chimney': '#e4e0d6'}
HARBOUR_TRIMS = {**TRIMS, 'tar': 'timber', 'basalt': 'stone'}


def hull(p, y0, y1, half, z0, z1, bow, slot):
    """A boat's hull band from `z0` to `z1`: a box from stern (y1) to the bow's shoulder, then a wedge to the stem at y0."""
    shoulder = y0 + bow
    p.box((-half, shoulder, z0), (half, y1, z1), slot, bottom=z0 < 0)
    stem = [(0.0, y0, z0), (0.0, y0, z1)]
    left, right = [(-half, shoulder, z0), (-half, shoulder, z1)], [(half, shoulder, z0), (half, shoulder, z1)]
    p.face([left[0], stem[0], stem[1], left[1]], slot)
    p.face([stem[0], right[0], right[1], stem[1]], slot)
    p.face([left[1], stem[1], right[1]], slot)
    if z0 < 0:
        p.face([right[0], stem[0], left[0]], slot)


def boat():
    """Variant 0: the moored fishing boat, its bow toward Blender -y (glTF +z)."""
    p = Piece()
    y0, y1, half = -5.5, 5.5, 1.9
    hull(p, y0, y1, half - 0.25, -0.9, -0.1, 3.0, 'Kit.boot')  # under the waterline, narrower
    hull(p, y0 - 0.2, y1, half, -0.1, 1.1, 3.2, 'Kit.hull')
    hull(p, y0 - 0.3, y1 + 0.05, half + 0.05, 1.1, 1.45, 3.3, 'Kit.hullTrim')  # the sheer strake
    p.box((-half + 0.2, y0 + 3.2, 1.0), (half - 0.2, y1 - 0.2, 1.12), 'Kit.wood')  # the deck
    # the wheelhouse aft, its windows lit forward
    p.box((-1.2, 1.6, 1.12), (1.2, 4.2, 3.3), 'Kit.cabin')
    p.box((-1.4, 1.4, 3.3), (1.4, 4.4, 3.5), 'Kit.tar', bottom=True)
    for x in (-0.6, 0.6):
        p.box((x - 0.4, 1.57, 2.3), (x + 0.4, 1.6, 2.9), 'Glow.window')
    # the mast forward of it, a stay to the stem, a lamp at its head
    p.prism(0, -0.6, 0.12, 0.08, 1.12, 8.2, 6, 'Kit.tar')
    p.box((-1.3, -0.68, 6.4), (1.3, -0.52, 6.55), 'Kit.tar')  # the cross-tree
    stay = 0.04
    p.box((-stay, y0 + 0.2, 1.4), (stay, -0.6, 1.5), 'Kit.tar')
    p.box((-0.16, -0.76, 8.2), (0.16, -0.44, 8.55), 'Glow.lantern')
    p.emitter((0, -0.6, 8.4), 'lantern')
    # the winch and the tarred hatch on the fore deck
    p.wheel(0, -2.4, 1.6, 0.42, 1.4, 8, 'Kit.tar')
    p.box((-0.9, -1.8, 1.12), (0.9, -0.4, 1.5), 'Kit.tar')
    return p


def cottage():
    """Variant 1: the whitewashed fisher's cottage, its front toward Blender -y (glTF +z)."""
    p = Piece()
    x0, x1, y0, y1, eave, ridge = -4.5, 4.5, -3.0, 3.0, 3.0, 6.2
    p.box((x0 - 0.15, y0 - 0.15, 0), (x1 + 0.15, y1 + 0.15, 0.5), 'Kit.basalt')  # the basalt footing
    p.box((x0, y0, 0.5), (x1, y1, eave), 'Kit.wall')
    # the gable ends and the steep black roof, overhanging front and back
    for x in (x0, x1):
        p.face([(x, y0, eave), (x, y1, eave), (x, 0.0, ridge)] if x == x1 else [(x, y1, eave), (x, y0, eave), (x, 0.0, ridge)], 'Kit.wall')
    o = 0.55
    for side in (-1, 1):
        y = y0 - o if side < 0 else y1 + o
        a, b = (x0 - 0.3, y, eave - 0.35), (x1 + 0.3, y, eave - 0.35)
        c, d = (x1 + 0.3, 0.0, ridge + 0.05), (x0 - 0.3, 0.0, ridge + 0.05)
        quad = [a, b, c, d] if side < 0 else [b, a, d, c]
        p.face(quad, 'Kit.roof')
        p.face([(q[0], q[1], q[2] - 0.12) for q in reversed(quad)], 'Kit.tar')
    for x in (x0 + 0.4, x1 - 1.4):  # the chimneys, one at each gable
        p.box((x, -0.5, ridge - 1.2), (x + 1.0, 0.5, ridge + 1.3), 'Kit.chimney')
        p.box((x - 0.08, -0.58, ridge + 1.3), (x + 1.08, 0.58, ridge + 1.45), 'Kit.tar')
    door(p, -0.2, y0)
    for x in (-2.8, 2.4):
        window(p, x, y0, 1.3, 1.0, 1.0)
    window(p, -1.8, y1, 1.3, 1.0, 1.0, face=1)
    return p


def nets():
    """Variant 2: a net-drying rack with lobster pots and a buoy post (the rack along x, its front toward Blender -y)."""
    p = Piece()
    for x in (-3.0, 0.0, 3.0):  # tarred posts and the two rails
        p.box((x - 0.12, -0.12, 0), (x + 0.12, 0.12, 2.4), 'Kit.tar')
    for z in (1.4, 2.3):
        p.box((-3.1, -0.07, z), (3.1, 0.07, z + 0.1), 'Kit.tar')
    for k, (a, b) in enumerate(((-2.9, -0.1), (0.1, 2.9))):  # the nets, hung over the top rail, sagging
        sag = 0.25 + 0.1 * k
        p.panel([(a, -0.16, 2.35), (b, -0.16, 2.35), (b - 0.2, -0.3, 0.7 + sag), (a + 0.2, -0.3, 0.5 + sag)], 'Kit.net')
        p.panel([(b, 0.16, 2.35), (a, 0.16, 2.35), (a + 0.2, 0.3, 0.6 + sag), (b - 0.2, 0.3, 0.8 + sag)], 'Kit.net')
    for i, (x, y, z) in enumerate(((3.9, -0.8, 0.0), (4.9, -0.8, 0.0), (4.4, -0.8, 0.7), (4.4, 0.4, 0.0))):  # lobster pots
        p.box((x - 0.45, y - 0.35, z), (x + 0.45, y + 0.35, z + 0.6), 'Kit.pot')
        p.box((x - 0.47, y - 0.37, z + 0.58), (x + 0.47, y + 0.37, z + 0.66), 'Kit.tar')
    p.prism(-4.3, -0.4, 0.16, 0.16, 0.0, 2.2, 6, 'Kit.tar')  # the buoy post and its red-and-white buoys
    for k, z in enumerate((0.9, 1.6)):
        p.lathe(-4.3, -0.4, [(0.0, z - 0.3), (0.32, z - 0.2), (0.32, z + 0.2), (0.0, z + 0.3)], 8,
                ['Kit.buoy' if k == 0 else 'Kit.hullTrim'])
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'harbour', [boat, cottage, nets], HARBOUR_TRIMS, {'slots': HARBOUR_SLOTS})


if __name__ == '__main__':
    main()
