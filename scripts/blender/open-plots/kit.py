"""kit.py <out-dir>: the open-plots kit models (RM4, docs/plans/shard-platform/night-market-remaster-mini-plan.md).

Each family is one GLB of three variants (kitlib.py has the format). Targets: art/grid/round-63-night-market-domes/
(A2 and D2: stone post lanterns, round paper lanterns, red banners). Run: bash scripts/blender/build.sh open-plots/kit.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402

# Default colours (sRGB) for slots a layout's palette may not define; the palette's own colour wins.
SLOTS = {'iron': '#2b2b33', 'gold': '#d8a23e', 'paper': '#ff5b32', 'stone': '#8a8a94', 'stoneTop': '#a6a6b0',
         'stall': '#c0222b', 'lantern': '#ffb347'}
# Each lit slot's ruled trim (data/trim.json, sp-o2's RM5.3 kit material); every other slot and all Glow faces are plain.
TRIMS = {'stone': 'stone', 'roof': 'roofTile', 'wood': 'timber', 'timber': 'timber', 'wall': 'plaster',
         'plaster': 'plaster', 'awning': 'awningStripe', 'cloth': 'awningStripe'}
# A lantern's post height in the generator moves its head; vertices between these heights stretch, those above shift.
LANTERN = {'nominal': 2.6, 'stretch': [0.5, 2.0]}


def head(p, half, z0, z1, cap, finial=True):
    """A square lantern head: lit panes framed by iron corner bars, an iron eave and a pyramid cap with a gold finial."""
    p.box((-half, -half, z0), (half, half, z1), 'Glow.lantern')
    bar = 0.035
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * half, sy * half
            p.box((x - bar, y - bar, z0), (x + bar, y + bar, z1), 'Kit.iron')
    p.box((-half - 0.05, -half - 0.05, z0 - 0.06), (half + 0.05, half + 0.05, z0), 'Kit.iron', bottom=True)
    p.box((-half - 0.06, -half - 0.06, z1), (half + 0.06, half + 0.06, z1 + 0.04), 'Kit.iron', bottom=True)
    p.prism(0, 0, cap, 0.04, z1 + 0.04, z1 + 0.04 + cap * 0.7, 4, 'Kit.iron', spin=0.785398, cap_bottom=True)
    if finial:
        top = z1 + 0.04 + cap * 0.7
        p.prism(0, 0, 0.045, 0.0, top, top + 0.14, 6, 'Kit.gold')
    p.emitter((0, 0, (z0 + z1) / 2), 'lantern')


def stone_post():
    """A1/A2's avenue lantern: a stepped stone base, a square iron post and a framed lantern head."""
    p = Piece()
    p.box((-0.3, -0.3, 0), (0.3, 0.3, 0.28), 'Kit.stone', top='Kit.stoneTop')
    p.box((-0.19, -0.19, 0.28), (0.19, 0.19, 0.45), 'Kit.stone', top='Kit.stoneTop')
    p.box((-0.1, -0.1, 0.45), (0.1, 0.1, 2.54), 'Kit.iron')
    head(p, 0.2, 2.6, 3.1, 0.34)
    return p


def paper_post():
    """A bracket post with a round red paper lantern hung from its arm (the mockup's red lanterns), a gold-capped top."""
    p = Piece()
    p.box((-0.22, -0.22, 0), (0.22, 0.22, 0.24), 'Kit.stone', top='Kit.stoneTop')
    p.box((-0.075, -0.075, 0.24), (0.075, 0.075, 3.0), 'Kit.iron')
    p.prism(0, 0, 0.13, 0.0, 3.0, 3.16, 4, 'Kit.iron', spin=0.785398, cap_bottom=True)
    p.box((-0.04, -0.035, 2.88), (0.86, 0.035, 2.95), 'Kit.iron', bottom=True)
    p.box((0.4, -0.02, 2.62), (0.44, 0.02, 2.88), 'Kit.iron')  # the brace's hanger
    p.prism(0.86, 0, 0.05, 0.0, 2.95, 3.03, 6, 'Kit.gold')
    p.box((0.845, -0.012, 2.62), (0.875, 0.012, 2.88), 'Kit.iron')  # the cord
    x = 0.86
    p.lathe(x, 0, [(0.07, 2.12), (0.18, 2.17), (0.29, 2.27), (0.32, 2.38), (0.29, 2.49), (0.18, 2.58), (0.07, 2.62)], 8,
            ['Kit.gold', 'Glow.paper', 'Glow.paper', 'Glow.paper', 'Glow.paper', 'Kit.gold'], cap_bottom=True)
    p.prism(x, 0, 0.025, 0.06, 1.92, 2.12, 4, 'Kit.stall')  # the tassel
    p.emitter((x, 0, 2.38), 'paper')
    return p


def banner_post():
    """A post with a red banner on a yard arm (A2's banner posts) and a small lantern head on top."""
    p = Piece()
    p.box((-0.25, -0.25, 0), (0.25, 0.25, 0.25), 'Kit.stone', top='Kit.stoneTop')
    p.box((-0.09, -0.09, 0.25), (0.09, 0.09, 2.56), 'Kit.iron')
    p.box((-0.06, -0.03, 2.36), (0.64, 0.03, 2.43), 'Kit.iron', bottom=True)
    # corners outside the gold strips: a vertex buried in another part bakes black (the shade is per corner)
    p.box((0.12, -0.012, 1.04), (0.58, 0.012, 2.24), 'Kit.stall')
    p.box((0.1, -0.022, 2.24), (0.6, 0.022, 2.34), 'Kit.gold', bottom=True)
    p.box((0.1, -0.022, 0.96), (0.6, 0.022, 1.04), 'Kit.gold', bottom=True)
    p.box((0.29, -0.016, 1.5), (0.41, 0.016, 1.8), 'Kit.gold')  # the banner's emblem, both faces
    head(p, 0.15, 2.6, 2.98, 0.27)
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'lanterns', [stone_post, paper_post, banner_post], TRIMS, {'slots': SLOTS, **LANTERN})


main()
