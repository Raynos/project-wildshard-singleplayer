"""fair.py <out-dir>: Patchwork Fairground's theme kit family (OPEN-PLOTS OP7), in kit.py's format (kitlib.py), retinted by
a layout's palette like every kit family. Target: art/grid/round-75-new-plot-palettes/03-patchwork-fairground.jpg.

`fair`, three variants in the fair's toy primaries:
- 0 carousel: a 12 m round deck on a cream step, a gold centre pole, eight white horses on gold poles, a striped
  red-and-sunflower cone roof with a scalloped valance and a red finial;
- 1 big top: a 16 m striped red-and-white tent, a skirt wall under a cone roof, a door flap on its front (+z) and a red
  pennant on the king pole;
- 2 helter-skelter: a 13 m tower in sunflower and royal-blue bands under a red cone roof and pennant, a red slide spiralling
  twice round it down to a landing mat on its front (the entry gate's variant).
Run: bash scripts/blender/build.sh open-plots/fair.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS  # noqa: E402

# Slots a layout may not define (sRGB); the palette's own colour wins.
FAIR_SLOTS = {**SLOTS, 'tentRed': '#e8443a', 'tentYellow': '#ffd23a', 'tentWhite': '#f4f2ec', 'tentBlue': '#3a68d8',
              'pole': '#d8a23e', 'horse': '#f4f2ec', 'deck': '#c89a62', 'step': '#eadcbc', 'mat': '#e8443a'}
FAIR_TRIMS = {**TRIMS, 'deck': 'timber'}


def cone(p, cx, cy, r, z0, z1, sides, slots, spin=0.0):
    """A cone roof from radius `r` at `z0` to a point at `z1`, its panels taking `slots` in turn, closed underneath."""
    for i in range(sides):
        a0, a1 = spin + 2 * math.pi * i / sides, spin + 2 * math.pi * (i + 1) / sides
        p.face([(cx + r * math.cos(a0), cy + r * math.sin(a0), z0), (cx + r * math.cos(a1), cy + r * math.sin(a1), z0),
                (cx, cy, z1)], slots[i % len(slots)])
    p.face(list(reversed(p.ring(cx, cy, r, z0, sides, spin))), slots[0])


def band_wall(p, cx, cy, r, z0, z1, sides, slots, spin=0.0, skip=None):
    """A round wall from `z0` to `z1`, its panels taking `slots` in turn; panel `skip` left open (a door)."""
    for i in range(sides):
        if i == skip:
            continue
        a0, a1 = spin + 2 * math.pi * i / sides, spin + 2 * math.pi * (i + 1) / sides
        q = [(cx + r * math.cos(a0), cy + r * math.sin(a0)), (cx + r * math.cos(a1), cy + r * math.sin(a1))]
        p.panel([(q[0][0], q[0][1], z0), (q[1][0], q[1][1], z0), (q[1][0], q[1][1], z1), (q[0][0], q[0][1], z1)], slots[i % len(slots)])


def pennant(p, x, y, z, slot):
    """A small triangular flag on a gold pin at (x, y, z)."""
    p.prism(x, y, 0.06, 0.06, z, z + 1.6, 4, 'Kit.pole')
    p.panel([(x, y, z + 1.6), (x, y, z + 0.9), (x + 1.2, y, z + 1.25)], slot)


def horse(p, x, y, facing):
    """A blocky white carousel horse on a gold pole, its head toward `facing` (radians about z)."""
    c, s = math.cos(facing), math.sin(facing)
    at = lambda u, v: (x + u * c - v * s, y + u * s + v * c)
    p.prism(x, y, 0.07, 0.07, 0.6, 5.4, 4, 'Kit.pole')
    for (u0, u1, v0, v1, z0, z1) in ((-0.8, 0.8, -0.25, 0.25, 1.6, 2.3), (0.6, 1.0, -0.18, 0.18, 2.2, 2.9),
                                      (0.8, 1.25, -0.15, 0.15, 2.6, 2.95), (-0.7, -0.5, -0.12, 0.12, 0.9, 1.7),
                                      (0.5, 0.7, -0.12, 0.12, 0.9, 1.7)):
        a, b = at(u0, v0), at(u1, v1)
        p.box((min(a[0], b[0]), min(a[1], b[1]), z0), (max(a[0], b[0]), max(a[1], b[1]), z1), 'Kit.horse')


def carousel():
    """Variant 0: the carousel (about 1.4k triangles)."""
    p = Piece()
    p.prism(0, 0, 6.6, 6.6, 0.0, 0.35, 24, 'Kit.step', cap_top=True)
    p.prism(0, 0, 6.0, 6.0, 0.35, 0.6, 24, 'Kit.deck', cap_top=True)
    p.prism(0, 0, 0.5, 0.5, 0.6, 5.6, 8, 'Kit.pole')
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        horse(p, 4.3 * math.cos(a), 4.3 * math.sin(a), a + math.pi / 2)
    p.prism(0, 0, 6.2, 6.2, 5.4, 5.6, 24, 'Kit.pole', cap_top=False)
    cone(p, 0, 0, 6.6, 5.6, 9.0, 16, ['Kit.tentRed', 'Kit.tentYellow'])
    for i in range(16):  # the scalloped valance under the roof's edge
        a0, a1 = 2 * math.pi * i / 16, 2 * math.pi * (i + 1) / 16
        am = (a0 + a1) / 2
        p.panel([(6.6 * math.cos(a0), 6.6 * math.sin(a0), 5.6), (6.6 * math.cos(a1), 6.6 * math.sin(a1), 5.6),
                 (6.65 * math.cos(am), 6.65 * math.sin(am), 4.9)], 'Kit.tentYellow' if i % 2 else 'Kit.tentRed')
    p.prism(0, 0, 0.35, 0.0, 9.0, 9.8, 6, 'Kit.tentRed')
    return p


def big_top():
    """Variant 1: the striped big top, its door on the front (Blender -y; the generator's +z, toward the avenue)."""
    p = Piece()
    door = 11  # the panel facing -y
    band_wall(p, 0, 0, 8.0, 0.0, 3.6, 16, ['Kit.tentRed', 'Kit.tentWhite'], skip=door)
    cone(p, 0, 0, 8.4, 3.6, 10.5, 16, ['Kit.tentRed', 'Kit.tentWhite'])
    a0, a1 = 2 * math.pi * door / 16, 2 * math.pi * (door + 1) / 16
    for a, out in ((a0, 1), (a1, -1)):  # the door flaps folded back
        x, y = 8.0 * math.cos(a), 8.0 * math.sin(a)
        p.panel([(x, y, 0.0), (x, y, 3.6), (x * 1.1 + out * 0.6, y * 1.1, 0.4)], 'Kit.tentRed')
    p.box((-1.2, -0.2, 0.0), (1.2, 0.2, 0.05), 'Kit.mat')
    p.prism(0, 0, 0.15, 0.15, 10.5, 12.0, 4, 'Kit.pole')
    pennant(p, 0, 0, 12.0, 'Kit.tentRed')
    return p


def helter_skelter():
    """Variant 2: the helter-skelter, its slide landing on the front (Blender -y)."""
    p = Piece()
    p.prism(0, 0, 2.4, 2.4, 0.0, 0.4, 12, 'Kit.step', cap_top=True)
    bands = ['Kit.tentYellow', 'Kit.tentBlue']
    for k in range(6):  # the tower in bands, a little narrower as it rises
        z0, z1 = 0.4 + k * 1.75, 0.4 + (k + 1) * 1.75
        r0, r1 = 2.0 - k * 0.08, 2.0 - (k + 1) * 0.08
        p.lathe(0, 0, [(r0, z0), (r1, z1)], 12, [bands[k % 2]], cap_top=False)
    top = 0.4 + 6 * 1.75
    p.prism(0, 0, 2.2, 2.2, top, top + 0.3, 12, 'Kit.tentRed', cap_top=False)
    cone(p, 0, 0, 2.5, top + 0.3, top + 2.6, 12, ['Kit.tentRed'])
    pennant(p, 0, 0, top + 2.6, 'Kit.tentRed')
    steps, turns = 48, 2.0  # the slide: two turns down from under the roof to the front
    for i in range(steps):
        t0, t1 = i / steps, (i + 1) / steps
        a0, a1 = -math.pi / 2 + turns * 2 * math.pi * (1 - t0), -math.pi / 2 + turns * 2 * math.pi * (1 - t1)
        z0, z1 = 0.9 + (top - 1.4) * (1 - t0), 0.9 + (top - 1.4) * (1 - t1)
        ri, ro = 2.0, 3.1
        quad = [(ri * math.cos(a0), ri * math.sin(a0), z0), (ro * math.cos(a0), ro * math.sin(a0), z0),
                (ro * math.cos(a1), ro * math.sin(a1), z1), (ri * math.cos(a1), ri * math.sin(a1), z1)]
        p.panel(quad, 'Kit.tentRed')
        p.panel([quad[1], quad[2], (quad[2][0], quad[2][1], z1 + 0.35), (quad[1][0], quad[1][1], z0 + 0.35)], 'Kit.tentRed')
    p.box((-1.0, -4.6, 0.0), (1.0, -2.6, 0.12), 'Kit.mat')
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'fair', [carousel, big_top, helter_skelter], FAIR_TRIMS, {'slots': FAIR_SLOTS})


if __name__ == '__main__':
    main()
