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
         'stall': '#c0222b', 'lantern': '#ffb347', 'wood': '#5b3a24', 'cloth': '#c8242c', 'stallRoof': '#b0262a',
         'fruit': '#e8892a', 'greens': '#5e9e3e', 'crate': '#8a5a34', 'board': '#14203f', 'awning': '#ff7a2e'}
# Each lit slot's ruled trim (data/trim.json, sp-o2's RM5.3 kit material); every other slot and all Glow faces are plain.
TRIMS = {'stone': 'stone', 'roof': 'roofTile', 'stallRoof': 'roofTile', 'wood': 'timber', 'timber': 'timber',
         'wall': 'plaster', 'plaster': 'plaster', 'cloth': 'awningStripe'}
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


def frame(p, half_w, half_d, height, slot='Kit.wood', size=0.07):
    """Four corner posts of a stall or cart."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * half_w, sy * half_d
            p.box((x - size, y - size, 0), (x + size, y + size, height), slot)


def valance(p, x0, x1, y, top, depth, count, slot):
    """A scalloped valance hanging from an eave along x at `y`: `count` tongues with pointed tips, both sides."""
    step = (x1 - x0) / count
    for i in range(count):
        a, b = x0 + i * step, x0 + (i + 1) * step
        mid = (a + b) / 2
        p.panel([(a, y, top), (a, y, top - depth * 0.7), (mid, y, top - depth), (b, y, top - depth * 0.7), (b, y, top)], slot)


def goods(p, x0, x1, y, z, kinds):
    """A row of goods on a counter: fruit heaps, greens baskets and crates."""
    step = (x1 - x0) / len(kinds)
    for i, kind in enumerate(kinds):
        x = x0 + (i + 0.5) * step
        if kind == 'fruit':
            p.prism(x, y, 0.17, 0.05, z, z + 0.16, 6, 'Kit.fruit', spin=0.3 * i)
        elif kind == 'greens':
            p.prism(x, y, 0.14, 0.17, z, z + 0.1, 6, 'Kit.wood')
            p.prism(x, y, 0.15, 0.06, z + 0.1, z + 0.22, 6, 'Kit.greens', spin=0.5)
        else:
            p.box((x - 0.16, y - 0.13, z), (x + 0.16, y + 0.13, z + 0.2), 'Kit.crate', top='Kit.fruit')


def hero_stall():
    """D2 / A2's market stall: a timber frame, a striped cloth gable with a scalloped valance and a name board, a red
    counter crowded with goods, paper lanterns at the front corners and a warm light under the roof (4.4 x 3.2 m)."""
    p = Piece()
    frame(p, 2.05, 1.45, 2.5)
    p.box((-1.9, -1.45, 0), (1.9, -0.75, 1.0), 'Kit.wood')
    p.box((-1.85, -1.48, 0.12), (1.85, -1.45, 0.86), 'Kit.stall')
    p.box((-1.75, -1.5, 0.72), (1.75, -1.48, 0.8), 'Kit.gold')
    p.box((-1.98, -1.52, 1.0), (1.98, -0.7, 1.07), 'Kit.wood', bottom=True)
    p.box((-1.9, 0.95, 0), (1.9, 1.4, 1.5), 'Kit.wood')
    goods(p, -1.75, 1.75, -1.1, 1.07, ['fruit', 'greens', 'crate', 'fruit', 'greens', 'fruit'])
    goods(p, -1.6, 1.6, 1.17, 1.5, ['crate', 'greens', 'crate', 'fruit'])
    p.box((1.3, -2.05, 0), (1.7, -1.7, 0.36), 'Kit.crate', top='Kit.fruit')
    p.box((-1.75, -2.0, 0), (-1.35, -1.7, 0.3), 'Kit.crate', top='Kit.greens')
    # the cloth gable, ridge along x: two striped slopes and the gable ends
    eave, ridge, w, d = 2.45, 3.3, 2.35, 1.8
    p.slab([(-w, -d, eave), (w, -d, eave), (w, 0, ridge), (-w, 0, ridge)], 0.05, 'Kit.cloth')
    p.slab([(w, d, eave), (-w, d, eave), (-w, 0, ridge), (w, 0, ridge)], 0.05, 'Kit.cloth')
    for x in (-w + 0.02, w - 0.02):
        p.panel([(x, -d, eave - 0.05), (x, d, eave - 0.05), (x, 0, ridge - 0.05)] if x > 0 else
                [(x, d, eave - 0.05), (x, -d, eave - 0.05), (x, 0, ridge - 0.05)], 'Kit.stall')
    valance(p, -w, w, -d - 0.01, eave - 0.045, 0.3, 9, 'Kit.stall')
    p.box((-w, -d - 0.03, eave - 0.04), (w, -d + 0.02, eave + 0.02), 'Kit.gold')
    p.box((-0.75, -0.42, ridge - 0.25), (0.75, -0.36, ridge + 0.32), 'Kit.board', top='Kit.gold')
    p.box((-0.8, -0.44, ridge + 0.32), (0.8, -0.34, ridge + 0.38), 'Kit.gold', bottom=True)
    p.box((-1.7, -0.25, ridge - 0.42), (1.7, 0.25, ridge - 0.34), 'Glow.awning', bottom=True)
    p.emitter((0, 0, ridge - 0.5), 'awning')
    for x in (-1.95, 1.95):
        p.box((x - 0.012, -1.86, eave - 0.36), (x + 0.012, -1.84, eave - 0.05), 'Kit.iron')
        p.paper_lantern(x, -1.85, eave - 0.36, radius=0.2)
    return p


def row_stall():
    """A2's red-roofed row stall: a lean-to of red tiles over a timber frame, a striped awning flap, crates of goods and
    a framed lantern under the eave (4.0 x 3.0 m)."""
    p = Piece()
    frame(p, 1.85, 1.35, 2.4)
    p.box((1.78, 1.28, 2.4), (1.92, 1.42, 2.85), 'Kit.wood')
    p.box((-1.92, 1.28, 2.4), (-1.78, 1.42, 2.85), 'Kit.wood')
    p.box((-1.7, -1.35, 0), (1.7, -0.8, 0.95), 'Kit.wood')
    p.box((-1.78, -1.4, 0.95), (1.78, -0.75, 1.01), 'Kit.wood', bottom=True)
    goods(p, -1.55, 1.55, -1.07, 1.01, ['crate', 'fruit', 'crate', 'greens', 'crate'])
    for i, x in enumerate((-1.2, -0.4, 0.4, 1.2)):
        p.box((x - 0.3, 0.7, 0), (x + 0.3, 1.25, 0.45 + 0.1 * (i % 2)), 'Kit.crate', top='Kit.fruit' if i % 2 else 'Kit.greens')
    p.slab([(-2.1, -1.65, 2.45), (2.1, -1.65, 2.45), (2.1, 1.6, 2.95), (-2.1, 1.6, 2.95)], 0.1, 'Kit.stallRoof',
           under='Kit.wood')
    p.panel([(-2.0, -1.66, 2.33), (2.0, -1.66, 2.33), (2.0, -2.35, 2.05), (-2.0, -2.35, 2.05)], 'Kit.cloth')
    valance(p, -2.0, 2.0, -2.36, 2.05, 0.2, 8, 'Kit.cloth')
    p.box((-0.012, -1.42, 1.95), (0.012, -1.4, 2.35), 'Kit.iron')
    p.box((-0.15, -1.56, 1.6), (0.15, -1.26, 1.95), 'Glow.lantern')
    p.box((-0.19, -1.6, 1.95), (0.19, -1.22, 2.0), 'Kit.iron', bottom=True)
    p.box((-0.17, -1.58, 1.56), (0.17, -1.24, 1.6), 'Kit.iron', bottom=True)
    p.emitter((0, -1.41, 1.78), 'lantern')
    return p


def food_cart():
    """A wheeled food cart: a red-sided counter, a striped canopy with valances front and back, a cooking pot and a
    paper lantern (2.6 x 1.6 m, handles behind)."""
    p = Piece()
    p.box((-1.2, -0.7, 0.45), (1.2, 0.7, 1.05), 'Kit.wood', bottom=True)
    p.box((-1.15, -0.73, 0.5), (1.15, -0.7, 0.98), 'Kit.stall')
    p.box((-1.1, -0.75, 0.86), (1.1, -0.73, 0.92), 'Kit.gold')
    for y in (-0.78, 0.78):
        p.wheel(-0.3, y, 0.42, 0.42, 0.08, 10, 'Kit.wood', hub='Kit.iron')
    p.box((1.2, 0.5, 0.8), (1.9, 0.56, 0.86), 'Kit.wood', bottom=True)
    p.box((1.2, -0.56, 0.8), (1.9, -0.5, 0.86), 'Kit.wood', bottom=True)
    frame(p, 1.1, 0.6, 2.3, size=0.04)
    eave, ridge = 2.2, 2.62
    p.slab([(-1.4, -0.95, eave), (1.4, -0.95, eave), (1.4, 0, ridge), (-1.4, 0, ridge)], 0.04, 'Kit.cloth')
    p.slab([(1.4, 0.95, eave), (-1.4, 0.95, eave), (-1.4, 0, ridge), (1.4, 0, ridge)], 0.04, 'Kit.cloth')
    valance(p, -1.4, 1.4, -0.96, eave, 0.24, 6, 'Kit.stall')
    valance(p, 1.4, -1.4, 0.96, eave, 0.24, 6, 'Kit.stall')
    p.lathe(0.5, 0.1, [(0.2, 1.05), (0.26, 1.15), (0.25, 1.32), (0.2, 1.34)], 8, ['Kit.iron'])
    goods(p, -1.0, 0.1, -0.35, 1.05, ['fruit', 'greens', 'fruit'])
    p.box((-0.012, -0.98, 1.78), (0.012, -0.96, 2.18), 'Kit.iron')
    p.paper_lantern(0, -0.97, 1.78, radius=0.17)
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'lanterns', [stone_post, paper_post, banner_post], TRIMS, {'slots': SLOTS, **LANTERN})
    reset_scene()
    build_family(out, 'stalls', [hero_stall, row_stall, food_cart], TRIMS, {'slots': SLOTS})


if __name__ == '__main__':
    main()
