"""dig.py <out-dir>: Fossil Badlands' theme kit family (OPEN-PLOTS OP21), in kit.py's format (kitlib.py), retinted by a
layout's palette like every kit family. Target: art/grid/round-75-new-plot-palettes/06-fossil-badlands.jpg.

`dig`, three variants of a palaeontology dig camp:
- 0 tent: a canvas ridge tent on a timber frame, its flaps tied back on the front (+z), a lit lantern by the door;
- 1 hand crane: a timber A-frame gantry with a pulley block, a rope and a hanging sling of bone bundles;
- 2 sorting table: a trestle table with laid-out bones and a lamp, crates stacked at one end.
Run: bash scripts/blender/build.sh open-plots/dig.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS  # noqa: E402

# Slots a layout may not define (sRGB); the palette's own colour wins.
DIG_SLOTS = {**SLOTS, 'canvas': '#e0c48c', 'canvasDark': '#b89a64', 'timber': '#8a5a34', 'rope': '#6a5038', 'bone': '#f0e6d2',
             'crate': '#9a6a40', 'tablecloth': '#c8b08a'}
DIG_TRIMS = {**TRIMS, 'timber': 'timber', 'crate': 'timber'}


def post(p, x, y, z0, z1, w=0.18, slot='Kit.timber'):
    p.box((x - w, y - w, z0), (x + w, y + w, z1), slot)


def lantern(p, x, y, z):
    """A small hung lamp: an iron cap over a glowing box, its light an emitter."""
    p.box((x - 0.16, y - 0.16, z - 0.42), (x + 0.16, y + 0.16, z), 'Glow.lantern')
    p.box((x - 0.2, y - 0.2, z), (x + 0.2, y + 0.2, z + 0.08), 'Kit.iron')
    p.emitter((x, y, z - 0.2), 'lantern')


def tent():
    """Variant 0: a 5 x 4 m ridge tent, its door to the front (Blender -y; the generator's +z)."""
    p = Piece()
    hx, hy, ridge, eave = 2.5, 2.0, 2.7, 0.9
    for sx in (-1, 1):  # the two roof slopes and the low side walls
        p.panel([(sx * hx, -hy, eave), (sx * hx, hy, eave), (0, hy, ridge), (0, -hy, ridge)], 'Kit.canvas', 'Kit.canvasDark')
        p.panel([(sx * hx, -hy, 0), (sx * hx, hy, 0), (sx * hx, hy, eave), (sx * hx, -hy, eave)], 'Kit.canvasDark')
    p.panel([(-hx, hy, 0), (hx, hy, 0), (hx, hy, eave), (0, hy, ridge), (-hx, hy, eave)], 'Kit.canvas', 'Kit.canvasDark')  # the back
    for sx in (-1, 1):  # the front's flaps tied back either side of the door
        p.panel([(sx * hx, -hy, 0), (sx * 0.7, -hy, 0), (sx * 0.4, -hy, ridge * 0.85), (sx * hx, -hy, eave)], 'Kit.canvas', 'Kit.canvasDark')
    p.box((-0.08, -hy - 0.1, 0), (0.08, -hy + 0.1, ridge + 0.2), 'Kit.timber')  # the door pole
    post(p, -0.05, hy, 0, ridge + 0.2, 0.08)
    p.box((-0.06, -hy, ridge - 0.05), (0.06, hy, ridge + 0.05), 'Kit.timber')  # the ridge pole
    post(p, hx * 0.5, -hy - 0.8, 0, 1.6, 0.05)
    lantern(p, hx * 0.5, -hy - 0.8, 1.6)
    return p


def crane():
    """Variant 1: a 6 m timber A-frame gantry over a dig, its sling of bone bundles hanging from a pulley block."""
    p = Piece()
    top = 6.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.box((min(sx * 2.6, sx * 0.4) - 0.15, min(sy * 0.9, sy * 0.15) - 0.15, 0), (max(sx * 2.6, sx * 0.4) + 0.15, max(sy * 0.9, sy * 0.15) + 0.15, 0.3), 'Kit.timber')
            post(p, sx * 2.4, sy * 0.7, 0, top, 0.15)
    p.box((-3.2, -0.2, top - 0.2), (3.2, 0.2, top + 0.3), 'Kit.timber')  # the beam
    for sx in (-1, 1):
        p.box((sx * 2.4 - 0.12, -0.9, 1.4), (sx * 2.4 + 0.12, 0.9, 1.6), 'Kit.timber')  # the braces
    p.box((1.6, -0.25, top - 0.7), (2.1, 0.25, top - 0.2), 'Kit.iron')  # the pulley block
    p.box((1.83, -0.03, 2.2), (1.87, 0.03, top - 0.7), 'Kit.rope')
    for k, (dx, dy) in enumerate(((0, 0), (0.45, 0.2), (-0.4, 0.25))):  # the sling of bone bundles
        p.lathe(1.85 + dx, dy, [(0.0, 1.4 + 0.1 * k), (0.38, 1.6 + 0.1 * k), (0.42, 2.0 + 0.1 * k), (0.3, 2.3 + 0.1 * k), (0.0, 2.45 + 0.1 * k)], 6, ['Kit.bone'])
    return p


def table():
    """Variant 2: a 3 m trestle sorting table with bones laid out and a lamp, two crates stacked at one end."""
    p = Piece()
    p.box((-1.5, -0.6, 0.8), (1.5, 0.6, 0.9), 'Kit.tablecloth')
    for sx in (-1.3, 1.3):
        for sy in (-0.45, 0.45):
            post(p, sx, sy, 0, 0.8, 0.06)
    for i, (x, length) in enumerate(((-1.0, 0.8), (-0.2, 0.5), (0.5, 0.9))):  # the laid-out bones
        p.box((x - length / 2, -0.12 + 0.18 * (i % 2), 0.9), (x + length / 2, 0.05 + 0.18 * (i % 2), 1.0), 'Kit.bone')
    post(p, 1.2, 0.3, 0.9, 1.35, 0.03)
    lantern(p, 1.2, 0.3, 1.35)
    p.box((1.8, -0.5, 0), (2.7, 0.5, 0.8), 'Kit.crate')
    p.box((1.9, -0.4, 0.8), (2.6, 0.4, 1.4), 'Kit.crate')
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'dig', [tent, crane, table], DIG_TRIMS, {'slots': DIG_SLOTS})


if __name__ == '__main__':
    main()
