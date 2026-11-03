"""skyport.py <out-dir>: Sky Harbor's theme kit family (OPEN-PLOTS OP11), in kit.py's format (kitlib.py), retinted by a
layout's palette like every kit family. Target: art/grid/round-62-open-plot-palettes/09-sky-harbor.jpg.

`skyport`, three variants of a bright timber harbour:
- 0 dock crane: a 9 m timber jib crane on a stone footing, a braced mast, a jib reaching out over the water (+z, glTF) with a
  pulley, a rope and a hanging crate, a lamp on its mast;
- 1 rowboat: a 5 m clinker rowboat in cornflower and white with two thwarts and a pair of oars (its waterline at the
  model's 0: the generator stands it on the basin's water);
- 2 cargo: a stack of timber crates, two barrels and a pile of sacks on a pallet, a navy tarp over the top crate.
Run: bash scripts/blender/build.sh open-plots/skyport.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS  # noqa: E402

# Slots a layout may not define (sRGB); the palette's own colour wins.
PORT_SLOTS = {**SLOTS, 'timber': '#a8743e', 'rope': '#7a6040', 'hull': '#3a68d0', 'hullTrim': '#f4f2ec', 'oar': '#c89a62',
              'tarp': '#2e4c96', 'barrel': '#8a5a34', 'hoop': '#3a3c44', 'footing': '#c8c4bc'}
PORT_TRIMS = {**TRIMS, 'timber': 'timber', 'barrel': 'timber', 'footing': 'stone'}


def post(p, x, y, z0, z1, w=0.18, slot='Kit.timber'):
    p.box((x - w, y - w, z0), (x + w, y + w, z1), slot)


def crate(p, x, y, z, s, slot='Kit.crate'):
    """A crate of side `s` standing at (x, y, z), its two slats a shade darker."""
    p.box((x - s / 2, y - s / 2, z), (x + s / 2, y + s / 2, z + s), slot)
    p.box((x - s / 2 - 0.02, y - s / 2 - 0.02, z + s * 0.45), (x + s / 2 + 0.02, y + s / 2 + 0.02, z + s * 0.55), 'Kit.timber')


def barrel(p, x, y, z, h=1.1, r=0.42):
    p.lathe(x, y, [(r * 0.85, z), (r, z + h * 0.5), (r * 0.85, z + h)], 8, ['Kit.barrel'])
    p.prism(x, y, r * 0.98, r * 0.98, z + h * 0.2, z + h * 0.26, 8, 'Kit.hoop', cap_top=False)


def crane():
    """Variant 0: the dock crane, its jib out to the front (Blender -y; the generator's +z)."""
    p = Piece()
    p.box((-1.2, -1.2, 0), (1.2, 1.2, 0.6), 'Kit.footing')
    post(p, 0, 0, 0.6, 9.0, 0.28)
    for sx, sy in ((-1, 0), (1, 0), (0, 1)):  # the mast's three raking braces
        p.box((sx * 1.0 - 0.1, sy * 1.0 - 0.1, 0.6), (sx * 1.0 + 0.1, sy * 1.0 + 0.1, 0.9), 'Kit.timber')
    for sx in (-1, 1):
        p.panel([(sx * 1.0, 0.1, 0.6), (sx * 1.2, 0.1, 0.6), (sx * 0.28, 0.1, 5.0), (sx * 0.1, 0.1, 5.0)], 'Kit.timber')
    p.box((-0.2, -6.0, 7.6), (0.2, 0.6, 8.0), 'Kit.timber')  # the jib
    p.panel([(0, 0.0, 5.2), (0, 0.0, 7.6), (0, -4.6, 7.6)], 'Kit.timber')  # its strut web
    p.box((-0.18, 0.6, 7.0), (0.18, 1.8, 8.4), 'Kit.iron')  # the counterweight
    p.box((-0.2, -6.1, 7.2), (0.2, -5.6, 7.6), 'Kit.iron')  # the pulley block
    p.box((-0.03, -5.88, 3.2), (0.03, -5.82, 7.2), 'Kit.rope')
    crate(p, 0, -5.85, 2.2, 1.0)
    p.box((-0.18, 0.28, 4.0), (0.18, 0.6, 4.4), 'Glow.lantern')
    p.emitter((0, 0.44, 4.2), 'lantern')
    return p


def rowboat():
    """Variant 1: the rowboat, its bow to the front (Blender -y), its waterline at z 0."""
    p = Piece()
    y0, y1, half = -2.6, 2.4, 0.85
    for z0, z1, slot, inset in ((-0.3, 0.15, 'Kit.hull', 0.18), (0.15, 0.45, 'Kit.hull', 0.0), (0.45, 0.58, 'Kit.hullTrim', -0.03)):
        h, sy = half - inset, y0 + 1.4  # the band's half beam and the bow's shoulder; open on top, seen from both sides
        outline = [(-h, y1), (-h, sy), (0, y0), (h, sy), (h, y1)]
        for i in range(len(outline)):
            (ax, ay), (bx, by) = outline[i], outline[(i + 1) % len(outline)]
            p.panel([(ax, ay, z0), (bx, by, z0), (bx, by, z1), (ax, ay, z1)], slot)
    p.face([(-half + 0.18, y1, -0.3), (half - 0.18, y1, -0.3), (half - 0.18, y0 + 1.4, -0.3), (0, y0, -0.3), (-half + 0.18, y0 + 1.4, -0.3)][::-1], 'Kit.hull')
    p.box((-half + 0.12, y0 + 1.3, 0.3), (half - 0.12, y1 - 0.12, 0.36), 'Kit.oar')  # the floorboards
    for y in (-0.4, 1.0):
        p.box((-half + 0.05, y - 0.15, 0.36), (half - 0.05, y + 0.15, 0.44), 'Kit.oar')  # the thwarts
    for sx in (-1, 1):
        p.box((sx * 0.9 - 0.05, -1.6, 0.5), (sx * 0.9 + 0.05, 1.4, 0.58), 'Kit.oar')  # the shipped oars
        p.box((sx * 0.9 - 0.12, -2.0, 0.5), (sx * 0.9 + 0.12, -1.6, 0.58), 'Kit.oar')
    return p


def cargo():
    """Variant 2: crates, barrels and sacks on a 3 x 2 m pallet, a navy tarp over the top crate."""
    p = Piece()
    p.box((-1.5, -1.0, 0), (1.5, 1.0, 0.15), 'Kit.timber')
    crate(p, -0.75, -0.2, 0.15, 1.2)
    crate(p, 0.55, -0.35, 0.15, 1.0)
    crate(p, -0.6, -0.1, 1.35, 0.9)
    p.box((-1.1, -0.6, 2.25), (-0.1, 0.4, 2.32), 'Kit.tarp')
    for x in (0.4, 1.1):
        barrel(p, x, 0.6, 0.15)
    for x, y in ((1.2, -0.6), (0.9, -0.3)):
        p.lathe(x, y, [(0.3, 1.15), (0.36, 1.35), (0.2, 1.6)], 6, ['Kit.sack'])
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'skyport', [crane, rowboat, cargo], PORT_TRIMS, {'slots': PORT_SLOTS})


if __name__ == '__main__':
    main()
