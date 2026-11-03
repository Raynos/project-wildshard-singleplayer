"""race.py <out-dir>: Floating Island Race's theme kit family (OPEN-PLOTS OP22), in kit.py's format (kitlib.py), retinted
by a layout's palette like every kit family. Target: art/grid/round-62-open-plot-palettes/15-sky-race.jpg.

`race`, three variants of a bright race circuit's paddock:
- 0 race car: a 4.6 m open-wheel racer in red with a white stripe, a blue cockpit, front and rear wings and four black
  wheels, its nose to the front (+z, glTF);
- 1 pit garage: a 12 x 9 m white garage open to the front under a blue hipped roof, a red fascia and a dark bay;
- 2 grandstand: a 16 m stand of five white tiers with blue seats under a blue canopy on white posts, facing the front.
Run: bash scripts/blender/build.sh open-plots/race.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS  # noqa: E402

# Slots a layout may not define (sRGB); the palette's own colour wins.
RACE_SLOTS = {**SLOTS, 'body': '#d8322e', 'stripe': '#f4f4f4', 'cockpit': '#2e5ad8', 'tyre': '#26282e', 'wing': '#26282e',
              'garage': '#f2f2f4', 'garageRoof': '#2e5ad8', 'fascia': '#d8322e', 'bay': '#3a3e4a', 'seat': '#2e5ad8',
              'tier': '#e8eaee', 'canopy': '#2e5ad8'}
RACE_TRIMS = dict(TRIMS)


def car():
    """Variant 0: the racer, its nose to the front (Blender -y; the generator's +z)."""
    p = Piece()
    p.box((-0.45, -2.3, 0.25), (0.45, 1.9, 0.75), 'Kit.body', 'Kit.body')  # the tub
    p.box((-0.12, -2.31, 0.3), (0.12, 1.9, 0.76), 'Kit.stripe')
    p.box((-0.32, -0.4, 0.75), (0.32, 0.5, 1.05), 'Kit.cockpit')
    for x0, x1 in ((-0.85, -0.45), (0.45, 0.85)):  # the sidepods
        p.box((x0, -0.6, 0.25), (x1, 1.2, 0.62), 'Kit.body')
    p.box((-0.95, -2.6, 0.25), (0.95, -2.2, 0.35), 'Kit.wing')  # the front wing
    p.box((-0.8, 1.9, 1.0), (0.8, 2.3, 1.1), 'Kit.wing')  # the rear wing on its post
    p.box((-0.08, 1.95, 0.6), (0.08, 2.1, 1.0), 'Kit.wing')
    for y in (-1.5, 1.5):  # the wheels, rolling along y
        for sx in (-1, 1):
            p.box((sx * 0.95 - 0.17, y - 0.36, 0.0), (sx * 0.95 + 0.17, y + 0.36, 0.72), 'Kit.tyre')
    return p


def garage():
    """Variant 1: the pit garage, open to the front."""
    p = Piece()
    hx, hy, h = 6.0, 4.5, 4.2
    p.box((-hx, hy - 0.4, 0), (hx, hy, h), 'Kit.garage')  # the back wall
    for x0, x1 in ((-hx, -hx + 0.4), (hx - 0.4, hx)):  # the side walls
        p.box((x0, -hy, 0), (x1, hy, h), 'Kit.garage')
    p.box((-hx + 0.4, -hy + 0.5, 0.02), (hx - 0.4, hy - 0.4, 0.06), 'Kit.bay')  # the bay's floor
    p.box((-hx, -hy - 0.1, h - 0.9), (hx, -hy + 0.3, h), 'Kit.fascia')  # the fascia over the opening
    p.slab([(-hx - 0.6, -hy - 0.6, h), (hx + 0.6, -hy - 0.6, h), (hx * 0.4, 0, h + 2.4), (-hx * 0.4, 0, h + 2.4)], 0.2, 'Kit.garageRoof')
    p.slab([(hx + 0.6, hy + 0.6, h), (-hx - 0.6, hy + 0.6, h), (-hx * 0.4, 0, h + 2.4), (hx * 0.4, 0, h + 2.4)], 0.2, 'Kit.garageRoof')
    p.slab([(-hx - 0.6, hy + 0.6, h), (-hx - 0.6, -hy - 0.6, h), (-hx * 0.4, 0, h + 2.4)], 0.2, 'Kit.garageRoof')
    p.slab([(hx + 0.6, -hy - 0.6, h), (hx + 0.6, hy + 0.6, h), (hx * 0.4, 0, h + 2.4)], 0.2, 'Kit.garageRoof')
    return p


def stand():
    """Variant 2: the grandstand, facing the front."""
    p = Piece()
    hx = 8.0
    for k in range(5):  # the tiers, stepping up toward the back
        y0, z1 = -3.0 + k * 1.2, 0.6 + k * 0.7
        p.box((-hx, y0, 0), (hx, y0 + 1.2, z1), 'Kit.tier')
        p.box((-hx + 0.2, y0 + 0.1, z1), (hx - 0.2, y0 + 0.6, z1 + 0.35), 'Kit.seat')
    for x in (-hx, -hx / 3, hx / 3, hx):  # the canopy's posts at the back
        p.box((x - 0.15, 2.9, 0), (x + 0.15, 3.2, 6.4), 'Kit.tier')
    p.slab([(-hx - 0.4, -3.6, 5.6), (hx + 0.4, -3.6, 5.6), (hx + 0.4, 3.4, 6.6), (-hx - 0.4, 3.4, 6.6)], 0.2, 'Kit.canopy')
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'race', [car, garage, stand], RACE_TRIMS, {'slots': RACE_SLOTS})


if __name__ == '__main__':
    main()
