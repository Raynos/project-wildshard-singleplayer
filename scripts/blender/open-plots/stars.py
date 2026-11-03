"""stars.py <out-dir>: Starfall Observatory's theme kit family (OPEN-PLOTS OP15), in kit.py's format (kitlib.py), retinted
by a layout's palette like every kit family. Target: art/grid/round-62-open-plot-palettes/12-starfall-observatory.jpg.

`stars`, three variants in the observatory's white, royal blue and silver:
- 0 telescope: a 3.4 m royal-blue refractor on a silver tripod, tilted up toward the north (glTF -z), a lit finder lamp;
- 1 armillary: a 3.6 m armillary sphere of silver rings on a white stone plinth, a gold axis and a lit globe at its heart;
- 2 pavilion: a 7 m stargazer's pavilion, a white drum with lit windows and a blue door under a royal-blue dome on a
  white step (the gardens' small observatories).
Run: bash scripts/blender/build.sh open-plots/stars.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS  # noqa: E402

# Slots a layout may not define (sRGB); the palette's own colour wins.
STAR_SLOTS = {**SLOTS, 'scope': '#2e4ac0', 'silver': '#cfd6e0', 'marble': '#eef0f6', 'domeBlue': '#2a42b0',
              'brass': '#d8b24e', 'starlight': '#e8f0ff'}
STAR_TRIMS = {**TRIMS, 'marble': 'stone'}


def tube(p, a, b, r, sides, slot, end=None):
    """A round tube of radius `r` from `a` to `b`, capped at both ends (`end`: the far cap's slot)."""
    d = [b[i] - a[i] for i in range(3)]
    length = math.sqrt(sum(c * c for c in d)) or 1.0
    d = [c / length for c in d]
    ref = (0.0, 0.0, 1.0) if abs(d[2]) < 0.9 else (1.0, 0.0, 0.0)
    u = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]]
    ul = math.sqrt(sum(c * c for c in u)) or 1.0
    u = [c / ul for c in u]
    v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]
    ring = lambda o, k: tuple(o[i] + r * (math.cos(2 * math.pi * k / sides) * u[i] + math.sin(2 * math.pi * k / sides) * v[i]) for i in range(3))
    lo, hi = [ring(a, k) for k in range(sides)], [ring(b, k) for k in range(sides)]
    for k in range(sides):
        n = (k + 1) % sides
        p.face([lo[k], lo[n], hi[n], hi[k]], slot)
    p.face(list(reversed(lo)), slot)
    p.face(hi, end or slot)


def hoop(p, cx, cy, cz, r, w, axis, sides, slot):
    """A thin flat ring of radius `r` and band width `w` about (cx, cy, cz), in the plane normal to `axis` ('x', 'y', 'z')."""
    def at(a, rr):
        c, s = rr * math.cos(a), rr * math.sin(a)
        return {'z': (cx + c, cy + s, cz), 'x': (cx, cy + c, cz + s), 'y': (cx + c, cy, cz + s)}[axis]
    for k in range(sides):
        a0, a1 = 2 * math.pi * k / sides, 2 * math.pi * (k + 1) / sides
        quad = [at(a0, r - w), at(a1, r - w), at(a1, r), at(a0, r)]
        p.panel(quad, slot)


def telescope():
    """Variant 0: the refractor on its tripod, its objective up toward Blender +y (glTF -z, the north)."""
    p = Piece()
    head = (0.0, 0.0, 1.6)
    for k in range(3):  # the tripod's legs
        a = 2 * math.pi * k / 3 + math.pi / 6
        tube(p, (1.0 * math.cos(a), 1.0 * math.sin(a), 0.0), head, 0.05, 4, 'Kit.silver')
    p.box((-0.18, -0.18, 1.5), (0.18, 0.18, 1.75), 'Kit.silver')  # the mount
    tilt = math.radians(40)
    d = (0.0, math.cos(tilt), math.sin(tilt))
    mount = (0.0, 0.0, 1.8)
    a, b = tuple(mount[i] - d[i] * 0.9 for i in range(3)), tuple(mount[i] + d[i] * 2.0 for i in range(3))
    tube(p, a, b, 0.2, 8, 'Kit.scope', end='Kit.iron')
    band = tuple(mount[i] + d[i] * 1.2 for i in range(3)), tuple(mount[i] + d[i] * 1.4 for i in range(3))
    tube(p, band[0], band[1], 0.22, 8, 'Kit.silver')
    finder = tuple(mount[i] + d[i] * 0.6 + (0.0, 0.0, 0.32)[i] for i in range(3))
    p.box((finder[0] - 0.06, finder[1] - 0.06, finder[2] - 0.06), (finder[0] + 0.06, finder[1] + 0.06, finder[2] + 0.06), 'Glow.starlight')
    p.emitter(finder, 'starlight')
    return p


def armillary():
    """Variant 1: the armillary sphere on a white plinth: a horizon ring, a meridian ring and a tilted ecliptic ring of
    silver about a lit globe, a brass axis through them."""
    p = Piece()
    p.box((-0.7, -0.7, 0.0), (0.7, 0.7, 0.35), 'Kit.marble')
    p.prism(0.0, 0.0, 0.32, 0.22, 0.35, 1.5, 8, 'Kit.marble')
    c, r = 2.5, 1.0
    hoop(p, 0.0, 0.0, c, r, 0.08, 'z', 24, 'Kit.silver')
    hoop(p, 0.0, 0.0, c, r, 0.08, 'x', 24, 'Kit.silver')
    hoop(p, 0.0, 0.0, c, r * 0.94, 0.08, 'y', 24, 'Kit.brass')
    tilt = math.radians(23.5)
    axis = (0.0, math.sin(tilt), math.cos(tilt))
    tube(p, tuple(-axis[i] * 1.25 + (0, 0, c)[i] for i in range(3)), tuple(axis[i] * 1.25 + (0, 0, c)[i] for i in range(3)), 0.04, 4, 'Kit.brass')
    p.lathe(0.0, 0.0, [(0.0, c - 0.3), (0.26, c - 0.15), (0.3, c), (0.26, c + 0.15), (0.0, c + 0.3)], 10, ['Glow.starlight'])
    p.emitter((0.0, 0.0, c), 'starlight')
    p.box((-0.04, -0.04, 1.5), (0.04, 0.04, c - r), 'Kit.brass')
    return p


def pavilion():
    """Variant 2: the stargazer's pavilion, its door to the front (Blender -y, glTF +z)."""
    p = Piece()
    p.prism(0.0, 0.0, 3.4, 3.4, 0.0, 0.4, 16, 'Kit.marble', cap_top=True)
    p.lathe(0.0, 0.0, [(2.8, 0.4), (2.8, 3.8)], 16, ['Kit.marble'], cap_top=False)
    p.lathe(0.0, 0.0, [(2.8, 3.8), (3.1, 3.9), (3.1, 4.2), (2.8, 4.3)], 16, ['Kit.silver'], cap_top=False)
    p.lathe(0.0, 0.0, [(3.0, 4.3), (2.85, 5.1), (2.4, 5.9), (1.6, 6.5), (0.0, 6.85)], 16, ['Kit.domeBlue'])
    p.box((-0.6, -2.85, 0.4), (0.6, -2.7, 2.6), 'Kit.door')
    for k in range(6):
        a = 2 * math.pi * (k + 0.5) / 6 - math.pi / 2
        if abs(a + math.pi / 2) < 0.6:
            continue
        x, y = 2.82 * math.cos(a), 2.82 * math.sin(a)
        tx, ty = -math.sin(a) * 0.35, math.cos(a) * 0.35
        x, y = x * 1.01, y * 1.01  # just proud of the wall, seen from either side
        p.panel([(x - tx, y - ty, 1.4), (x + tx, y + ty, 1.4), (x + tx, y + ty, 3.0), (x - tx, y - ty, 3.0)], 'Glow.window')
    p.emitter((0.0, -3.2, 2.9), 'window')
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'stars', [telescope, armillary, pavilion], STAR_TRIMS, {'slots': STAR_SLOTS})


if __name__ == '__main__':
    main()
