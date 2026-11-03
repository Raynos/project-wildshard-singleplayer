"""hero.py <out-dir>: the open plots' hero hanging lantern (OPEN-PLOTS OP1, G827; shared with the build-out plots, OB2).

Three takes in the kit's format (kitlib.py), each hung from its hook at the origin (it hangs below y 0) so a rope or a
branch carries it: every lantern hangs on something (G827). `hero` is LOD0 (about 1.5k triangles each), `hero-lod1`
the same three at about 300 for the coarse tiles; both retint by palette slot (`paper`, `gold`, `iron`, `lantern`).
- A round: a ribbed round paper lantern, gold caps, a gold-corded tassel (Night Market's red paper, a bayou's amber);
- B drum: a tall ribbed drum with black lacquer bands top and bottom and a short tassel;
- C box: an iron-framed glass box with a pyramid cap and a ring (the bayou's lodge lantern).
Targets: art/grid/round-63-night-market-domes (A2 / D2) and art/grid/round-62-open-plot-palettes/18-lantern-bayou.jpg.
Run: bash scripts/blender/build.sh open-plots/hero.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import SLOTS, TRIMS  # noqa: E402
from kitlib import Piece, build_family, reset_scene  # noqa: E402

HERO_SLOTS = {**SLOTS, 'lacquer': '#1a1414', 'cord': '#d8a23e'}


def ribbed(p, profile, sides, ribs, slot, rib_slot, rib_depth):
    """A lathe of paper between raised ribs: every `sides // ribs`-th facet column is pushed out as a rib."""
    rings = []
    for r, z in profile:
        ring = []
        for i in range(sides):
            a = 2 * math.pi * i / sides
            out = r * (1.0 + (rib_depth if i % (sides // ribs) == 0 else 0.0))
            ring.append((out * math.cos(a), out * math.sin(a), z))
        rings.append(ring)
    for band in range(len(rings) - 1):
        a, b = rings[band], rings[band + 1]
        for i in range(sides):
            j = (i + 1) % sides
            rib = i % (sides // ribs) == 0
            p.face([a[i], a[j], b[j], b[i]], rib_slot if rib else slot)


def hook(p, top):
    """The hanger: a short gold rod and a ring at the origin, the rope's attachment."""
    p.prism(0, 0, 0.02, 0.02, top, -0.02, 4, 'Kit.gold', cap_top=False)
    p.lathe(0, 0, [(0.05, -0.04), (0.06, 0.0), (0.05, 0.04)], 6, ['Kit.gold'])


def tassel(p, z, length, sides):
    p.lathe(0, 0, [(0.04, z), (0.07, z - 0.05), (0.03, z - 0.09)], sides, ['Kit.cord'])
    p.prism(0, 0, 0.05, 0.015, z - length, z - 0.08, sides, 'Kit.stall', cap_bottom=True)


def round_lantern(lod=0):
    """A: the round paper lantern, 0.7 m across: 6 ribs on a 12-facet body (LOD0) or 4 on 8 (LOD1)."""
    p = Piece()
    sides, ribs, n = (12, 6, 7) if lod == 0 else (8, 4, 4)
    top, bottom, r = -0.18, -1.0, 0.36
    profile = [(r * math.sin(math.pi * (0.12 + 0.76 * k / n)), top - (top - bottom) * k / n) for k in range(n + 1)][::-1]
    ribbed(p, profile, sides, ribs, 'Glow.paper', 'Kit.gold', 0.04)
    for z, rr in ((top, 0.13), (bottom, 0.15)):  # the caps
        p.lathe(0, 0, [(rr, z - 0.03), (rr + 0.02, z), (rr, z + 0.03)], sides // 2, ['Kit.gold'], cap_bottom=True)
    hook(p, top + 0.03)
    tassel(p, bottom - 0.03, 0.34, 6 if lod == 0 else 4)
    p.emitter((0, 0, (top + bottom) / 2), 'paper')
    return p


def drum_lantern(lod=0):
    """B: the tall drum, 0.5 m across and 0.8 m tall, black lacquer bands, a short tassel."""
    p = Piece()
    sides, ribs, n = (24, 8, 8) if lod == 0 else (8, 4, 3)
    top, bottom, r = -0.2, -1.0, 0.25
    profile = [(r * (0.86 + 0.14 * math.sin(math.pi * k / n)), top - (top - bottom) * k / n) for k in range(n + 1)][::-1]
    ribbed(p, profile, sides, ribs, 'Glow.paper', 'Kit.lacquer', 0.03)
    for z0, z1 in ((top - 0.08, top + 0.02), (bottom - 0.02, bottom + 0.08)):  # the lacquer bands
        p.lathe(0, 0, [(r * 0.98, z0), (r * 1.01, z1)], sides, ['Kit.lacquer'], cap_bottom=True)
    hook(p, top + 0.02)
    tassel(p, bottom - 0.02, 0.22, 6 if lod == 0 else 4)
    p.emitter((0, 0, (top + bottom) / 2), 'paper')
    return p


def box_lantern(lod=0):
    """C: an iron-framed glass box (0.36 m square, 0.5 m tall) under a pyramid cap and a ring, a drip tray below."""
    p = Piece()
    half, top, bottom = 0.18, -0.3, -0.8
    p.box((-half + 0.01, -half + 0.01, bottom), (half - 0.01, half - 0.01, top), 'Glow.lantern')
    bar = 0.03
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * half, sy * half
            p.box((x - bar, y - bar, bottom - 0.04), (x + bar, y + bar, top + 0.04), 'Kit.iron')
    if lod == 0:  # the glazing bars across each pane
        for z in (bottom + 0.17, bottom + 0.34):
            p.box((-half, -half - 0.012, z - 0.012), (half, half + 0.012, z + 0.012), 'Kit.iron')
        for s in (-1, 1):
            p.box((-0.012, s * half - 0.012, bottom), (0.012, s * half + 0.012, top), 'Kit.iron')
            p.box((s * half - 0.012, -0.012, bottom), (s * half + 0.012, 0.012, top), 'Kit.iron')
    p.box((-half - 0.04, -half - 0.04, bottom - 0.06), (half + 0.04, half + 0.04, bottom), 'Kit.iron', bottom=True)
    p.box((-half - 0.05, -half - 0.05, top), (half + 0.05, half + 0.05, top + 0.04), 'Kit.iron', bottom=True)
    p.prism(0, 0, (half + 0.07) * 1.414, 0.03, top + 0.04, top + 0.24, 4, 'Kit.iron', spin=0.785398, cap_bottom=True)
    hook(p, top + 0.24)
    p.emitter((0, 0, (top + bottom) / 2), 'lantern')
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    trims = {**TRIMS, 'lacquer': None}
    trims = {k: v for k, v in trims.items() if v is not None}
    reset_scene(ground=-1.6)
    build_family(out, 'hero', [round_lantern, drum_lantern, box_lantern], trims, {'slots': HERO_SLOTS})
    reset_scene(ground=-1.6)
    build_family(out, 'hero-lod1', [lambda: round_lantern(1), lambda: drum_lantern(1), lambda: box_lantern(1)], trims,
                 {'slots': HERO_SLOTS})


if __name__ == '__main__':
    main()
