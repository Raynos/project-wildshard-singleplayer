"""frost.py <out-dir>: Frostline Peaks' theme kit families (OB3, project/archive/2026-11-03-open-plots-build-out.md, G978).

Two families in kit.py's format (kitlib.py), retinted by a layout's palette like every kit family:
- `lodges`: timber alpine houses under steep snow-loaded roofs (a lodge with a balcony, a two-storey chalet, a small
  cabin), lit windows, a stone chimney, each lantern hung on an iron bracket (G827);
- `pines`: the shared snow-dusted pine clumps (three, five and eight trees; Thin Ice reuses them), each tree a trunk and
  three stacked tiers with a snow cap;
- `lift`: the landmark's chair lift as kit pieces the plot places up the peak's flank (a tower, a chair hung from its
  grip, a station hut with its bull wheel), so the lift stands with whichever peak take ships.
Targets: art/grid/round-62-open-plot-palettes/16-frostline-peaks.jpg. Run: bash scripts/blender/build.sh open-plots/frost.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS, window  # noqa: E402
from bayou import hung_lantern  # noqa: E402

FROST_SLOTS = {**SLOTS, 'timber': '#7a5236', 'snow': '#eef4fa', 'pine': '#33604a', 'pineDark': '#264a3a',
               'stone': '#8e949c', 'stoneTop': '#a6acb4', 'rope': '#2b2b33'}
FROST_TRIMS = {**TRIMS, 'timber': 'timber'}


def log_walls(p, x0, x1, y0, y1, z0, z1):
    """Timber walls on a stone plinth, corner posts proud of them, a band under the eave."""
    p.box((x0 - 0.1, y0 - 0.1, 0), (x1 + 0.1, y1 + 0.1, z0), 'Kit.stone', top='Kit.stoneTop')
    p.box((x0, y0, z0), (x1, y1, z1), 'Kit.timber')
    for x in (x0, x1):
        for y in (y0, y1):
            p.box((x - 0.16, y - 0.16, z0), (x + 0.16, y + 0.16, z1), 'Kit.wood')


def snow_roof(p, x0, x1, y0, y1, eave, rise, overhang=0.8):
    """A steep gable roof along x whose slopes are snow, a timber underside and fascia, timber gables, a snow ridge."""
    a0, a1, b0, b1 = x0 - overhang, x1 + overhang, y0 - overhang, y1 + overhang
    ym, top = (b0 + b1) / 2, eave + rise
    p.face([(a0, b0, eave), (a1, b0, eave), (a1, ym, top), (a0, ym, top)], 'Kit.snow')
    p.face([(a1, b1, eave), (a0, b1, eave), (a0, ym, top), (a1, ym, top)], 'Kit.snow')
    p.face([(a0, b0, eave - 0.3), (a0, ym, top - 0.3), (a1, ym, top - 0.3), (a1, b0, eave - 0.3)], 'Kit.wood')
    p.face([(a1, b1, eave - 0.3), (a1, ym, top - 0.3), (a0, ym, top - 0.3), (a0, b1, eave - 0.3)], 'Kit.wood')
    for x, s in ((x0, -1), (x1, 1)):
        tri = [(x, y0, eave), (x, ym, top - 0.25), (x, y1, eave)]
        p.face(tri if s > 0 else list(reversed(tri)), 'Kit.timber')
    p.box((a0, ym - 0.2, top - 0.1), (a1, ym + 0.2, top + 0.2), 'Kit.snow')


def chimney(p, x, y, top):
    p.box((x - 0.5, y - 0.5, top - 2.4), (x + 0.5, y + 0.5, top + 0.9), 'Kit.stone', top='Kit.snow')


def lodge():
    """A 10 x 7 m timber lodge: two floors of lit windows, a balcony across its front on the upper floor, a steep snow
    roof, a chimney, a lantern either side of its door (about 700 triangles)."""
    p = Piece()
    log_walls(p, -5, 5, -3.5, 3.5, 0.4, 6.0)
    snow_roof(p, -5, 5, -3.5, 3.5, 6.0, 4.0)
    chimney(p, 3.0, 1.2, 10.0)
    p.box((-0.6, -3.54, 0.4), (0.6, -3.5, 2.6), 'Kit.door')
    for x in (-3.2, -1.6, 1.6, 3.2):
        window(p, x, -3.5, 1.2, 0.9, 1.1)
        window(p, x, -3.5, 3.9, 0.9, 1.1)
    for x in (-2.4, 2.4):
        window(p, x, 3.5, 1.2, 0.9, 1.1, face=1)
    p.box((-5.3, -5.2, 3.2), (5.3, -3.5, 3.45), 'Kit.wood', top='Kit.snow', bottom=True)  # the balcony
    p.box((-5.3, -5.25, 3.45), (5.3, -5.1, 4.3), 'Kit.wood')
    for x in (-5.0, 5.0):
        p.box((x - 0.12, -5.2, 0.4), (x + 0.12, -5.0, 3.2), 'Kit.wood')
    for x in (-1.3, 1.3):
        hung_lantern(p, x, -3.5, 2.9, arm=0.5)
    return p


def chalet():
    """A two-storey 8 x 8 m chalet, its gable to the front with a big lit window, a deep snow roof (about 550)."""
    p = Piece()
    log_walls(p, -4, 4, -4, 4, 0.4, 5.6)
    # the roof turned 90 degrees: its ridge front to back, gables to the front and back
    a0, a1, b0, b1, eave, top = -4.9, 4.9, -4.9, 4.9, 5.6, 9.4
    p.face([(a0, b1, eave), (a0, b0, eave), (0, b0, top), (0, b1, top)], 'Kit.snow')
    p.face([(a1, b0, eave), (a1, b1, eave), (0, b1, top), (0, b0, top)], 'Kit.snow')
    p.face([(a0, b0, eave - 0.3), (a0, b1, eave - 0.3), (0, b1, top - 0.3), (0, b0, top - 0.3)], 'Kit.wood')
    p.face([(a1, b1, eave - 0.3), (a1, b0, eave - 0.3), (0, b0, top - 0.3), (0, b1, top - 0.3)], 'Kit.wood')
    for y, s in ((-4, -1), (4, 1)):
        tri = [(-4, y, eave), (4, y, eave), (0, y, top - 0.25)]
        p.face(tri if s < 0 else list(reversed(tri)), 'Kit.timber')
    p.box((-0.2, b0, top - 0.1), (0.2, b1, top + 0.2), 'Kit.snow')
    chimney(p, -2.0, 2.0, 9.0)
    window(p, 0, -4, 5.9, 1.6, 1.6)
    for x in (-2.2, 2.2):
        window(p, x, -4, 1.2, 1.0, 1.1)
        window(p, x, -4, 3.6, 1.0, 1.1)
    p.box((-0.6, -4.04, 0.4), (0.6, -4.0, 2.6), 'Kit.door')
    hung_lantern(p, 1.2, -4.0, 2.9, arm=0.5)
    return p


def cabin():
    """A small 6 x 5 m cabin with a woodpile and one lit window, its roof heavy with snow (about 350)."""
    p = Piece()
    log_walls(p, -3, 3, -2.5, 2.5, 0.3, 3.0)
    snow_roof(p, -3, 3, -2.5, 2.5, 3.0, 2.6, overhang=0.7)
    chimney(p, -1.6, 0.8, 5.4)
    p.box((-0.5, -2.54, 0.3), (0.5, -2.5, 2.3), 'Kit.door')
    window(p, 1.7, -2.5, 1.1, 0.9, 0.9)
    p.box((-2.9, -3.4, 0), (-1.1, -2.6, 1.2), 'Kit.wood', top='Kit.snow')  # the woodpile
    hung_lantern(p, -0.9, -2.5, 2.5, arm=0.4)
    return p


def pine(p, x, y, h, spin):
    p.prism(x, y, 0.18 * h / 7, 0.12 * h / 7, 0, h * 0.3, 5, 'Kit.wood')
    for k, (lo, hi, w) in enumerate(((0.2, 0.6, 0.4), (0.42, 0.82, 0.3), (0.64, 1.0, 0.2))):
        # OB3 look round 5 (Frostline's T0: snow on every tier): the snow line sits low on each tier, a short needle
        # skirt under it, so the tiers read snow-laden from the ground as well as from above (the same rings)
        p.lathe(x, y, [(h * w, h * lo), (h * w * 0.7, h * (lo + 0.3 * (hi - lo))), (0.0, h * hi)], 7,
                ['Kit.pineDark' if k == 0 else 'Kit.pine', 'Kit.snow'], spin=spin + k * 0.4, cap_bottom=True)


def clump(spots):
    p = Piece()
    for i, (x, y, h) in enumerate(spots):
        pine(p, x, y, h, i * 0.9)
    return p


def lift_tower():
    """A chair-lift tower, 12 m to its cable line: a tapered four-legged iron lattice, a cross arm 3.6 m across the line
    (along x) with a sheave each end, a red cap; its origin at its foot, the line along y."""
    p = Piece()
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.prism(sx * 1.1, sy * 1.1, 0.16, 0.1, 0, 11.4, 4, 'Kit.iron', cap_top=False)
    for k in range(1, 5):  # the lattice rings, narrowing up the tower
        z, r = 11.4 * k / 5, 1.1 - 0.75 * k / 5
        p.box((-r, -r, z - 0.08), (r, r, z + 0.08), 'Kit.iron')
    p.box((-0.35, -0.35, 11.4), (0.35, 0.35, 12.0), 'Kit.iron')
    p.box((-1.9, -0.25, 11.8), (1.9, 0.25, 12.2), 'Kit.iron')
    for x in (-1.8, 1.8):
        p.wheel(x, 0, 11.9, 0.4, 0.2, 8, 'Kit.iron')
    p.box((-0.4, -0.4, 12.2), (0.4, 0.4, 12.5), 'Kit.stall')
    return p


def lift_chair():
    """A two-seat chair hung from its cable grip at the origin: a 2.4 m hanger, a red seat, back and foot bar."""
    p = Piece()
    p.box((-0.05, -0.05, -2.4), (0.05, 0.05, 0.0), 'Kit.iron')
    p.box((-0.12, -0.12, -0.1), (0.12, 0.12, 0.1), 'Kit.iron')  # the grip
    p.box((-0.8, -0.35, -2.4), (0.8, 0.05, -2.15), 'Kit.iron')  # the hanger's yoke
    p.box((-0.8, -0.55, -2.55), (0.8, 0.05, -2.4), 'Kit.stall', bottom=True)  # the seat
    p.box((-0.8, 0.0, -2.4), (0.8, 0.1, -1.7), 'Kit.stall')  # the back
    p.box((-0.6, -0.75, -3.05), (0.6, -0.65, -2.95), 'Kit.iron')  # the foot bar
    return p


def lift_station():
    """A lift station: a timber hut under a snow roof with the bull wheel housing on its front, a lit window."""
    p = Piece()
    log_walls(p, -3, 3, -2.5, 2.5, 0.3, 3.4)
    snow_roof(p, -3, 3, -2.5, 2.5, 3.4, 2.2, overhang=0.6)
    p.box((-2.2, -4.4, 2.6), (2.2, -2.5, 3.4), 'Kit.iron')
    p.lathe(0, -3.6, [(1.7, 3.4), (1.7, 3.7)], 12, ['Kit.stall'], cap_bottom=True)  # the bull wheel, flat on its housing
    window(p, 1.6, -2.5, 1.3, 0.9, 0.9)
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'lodges', [lodge, chalet, cabin], FROST_TRIMS, {'slots': FROST_SLOTS})
    reset_scene()
    build_family(out, 'pines', [lambda: clump([(0, 0, 8.5), (2.6, 1.4, 6.5), (-2.2, 1.8, 5.5)]),
                                lambda: clump([(0, 0, 9.0), (3.0, -1.0, 7.0), (-2.8, -0.6, 6.5), (1.0, 3.0, 5.5), (-1.4, -3.0, 6.0)]),
                                lambda: clump([(0, 0, 10.0), (3.2, 0.6, 7.5), (-3.0, 1.2, 8.0), (1.4, 3.4, 6.0), (-1.6, -3.2, 6.5),
                                               (4.4, -2.6, 5.5), (-4.6, -2.0, 5.0), (0.4, -4.4, 5.5)])],
                 FROST_TRIMS, {'slots': FROST_SLOTS})
    reset_scene()
    build_family(out, 'lift', [lift_tower, lift_chair, lift_station], FROST_TRIMS, {'slots': FROST_SLOTS})


if __name__ == '__main__':
    main()
