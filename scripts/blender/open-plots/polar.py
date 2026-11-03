"""polar.py <out-dir>: Thin Ice's theme kit family (OPEN-PLOTS OP18), in kit.py's format (kitlib.py), retinted by a
layout's palette like every kit family. Target: art/grid/round-62-open-plot-palettes/08-thin-ice.jpg.

`polar`, three variants of a frozen lake's shore:
- 0 igloo: a 6.4 m snow-block dome with its course lines, an entrance tunnel to the front (+z, glTF) and a dark doorway;
- 1 fishing gear: crossed skis stood in the snow, a timber stool, a bucket and a rod leant over the hole (the generator
  cuts the hole in the ice in front of it, at the model's +z);
- 2 bench: a timber slat bench on two stone legs, snow on its seat's ends.
Run: bash scripts/blender/build.sh open-plots/polar.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS  # noqa: E402

# Slots a layout may not define (sRGB); the palette's own colour wins.
POLAR_SLOTS = {**SLOTS, 'snow': '#f4f8fc', 'snowShade': '#c8d8ec', 'doorway': '#2a3a52', 'timber': '#8a5a34',
               'ski': '#d83a30', 'bucket': '#3a68d0', 'rod': '#5a4030'}
POLAR_TRIMS = {**TRIMS, 'timber': 'timber'}


def beam(p, a, b, w, slot):
    """A square beam `w` wide from `a` to `b` (four sides, both ends capped)."""
    d = [b[i] - a[i] for i in range(3)]
    length = math.sqrt(sum(c * c for c in d)) or 1.0
    d = [c / length for c in d]
    ref = (0.0, 0.0, 1.0) if abs(d[2]) < 0.9 else (1.0, 0.0, 0.0)
    u = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]]
    ul = math.sqrt(sum(c * c for c in u)) or 1.0
    u = [c / ul * w / 2 for c in u]
    v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]
    corners = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
    end = lambda o, s, t: tuple(o[i] + s * u[i] + t * v[i] for i in range(3))
    lo = [end(a, s, t) for s, t in corners]
    hi = [end(b, s, t) for s, t in corners]
    for i in range(4):
        j = (i + 1) % 4
        p.face([lo[i], lo[j], hi[j], hi[i]], slot)
    p.face(list(reversed(lo)), slot)
    p.face(hi, slot)


def igloo():
    """Variant 0: the igloo, its tunnel to the front (Blender -y; the generator's +z)."""
    p = Piece()
    r, n = 3.2, 6
    profile = [(r * math.cos(math.pi / 2 * k / n), r * math.sin(math.pi / 2 * k / n)) for k in range(n + 1)]
    p.lathe(0, 0, profile, 12, ['Kit.snow', 'Kit.snowShade', 'Kit.snow', 'Kit.snowShade', 'Kit.snow', 'Kit.snow'])
    # the tunnel: a half-round arch from the dome's wall out to the front, its doorway dark
    tr, ty0, ty1, m = 1.2, -r + 0.4, -r - 1.8, 6
    arch = [(tr * math.cos(math.pi * k / m), tr * math.sin(math.pi * k / m)) for k in range(m + 1)]
    for k in range(m):
        (xa, za), (xb, zb) = arch[k], arch[k + 1]
        p.face([(xa, ty0, za), (xb, ty0, zb), (xb, ty1, zb), (xa, ty1, za)], 'Kit.snow')  # facing out
    p.face([(x, ty1, z) for x, z in arch], 'Kit.snowShade')
    inner = [(x * 0.7, z * 0.75) for x, z in arch]
    p.face([(x, ty1 - 0.02, z) for x, z in inner], 'Kit.doorway')
    return p


def gear():
    """Variant 1: the ice-fishing gear behind its hole (the hole is the generator's, at the model's front)."""
    p = Piece()
    for lean in (-0.35, 0.35):  # the crossed skis stood in the snow
        beam(p, (-1.6 + lean * 1.2, 0.6, 0.0), (-1.6 - lean * 1.2, 0.6, 1.9), 0.12, 'Kit.ski')
    p.box((-0.3, 0.2, 0.0), (0.3, 0.8, 0.45), 'Kit.timber')  # the stool
    p.prism(0.9, 0.5, 0.25, 0.3, 0.0, 0.5, 8, 'Kit.bucket')
    beam(p, (0.2, 0.5, 0.45), (0.0, -1.4, 1.3), 0.05, 'Kit.rod')  # the rod over the hole
    p.box((-0.01, -1.42, 0.05), (0.01, -1.38, 1.3), 'Kit.rope')  # its line
    return p


def bench():
    """Variant 2: a 2.4 m slat bench on stone legs facing the front, snow on its ends."""
    p = Piece()
    for x in (-1.0, 1.0):
        p.box((x - 0.15, -0.3, 0.0), (x + 0.15, 0.3, 0.45), 'Kit.stone')
    p.box((-1.2, -0.3, 0.45), (1.2, 0.3, 0.55), 'Kit.timber')
    p.box((-1.2, 0.25, 0.55), (1.2, 0.33, 1.0), 'Kit.timber')
    for x in (-1.2, 0.8):
        p.box((x, -0.3, 0.55), (x + 0.4, 0.25, 0.62), 'Kit.snow')
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'polar', [igloo, gear, bench], POLAR_TRIMS, {'slots': POLAR_SLOTS})


if __name__ == '__main__':
    main()
