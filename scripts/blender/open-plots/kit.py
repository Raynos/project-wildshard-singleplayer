"""kit.py <out-dir>: the open-plots kit models (RM4, project/archive/2026-10-27-night-market-remaster.md).

Each family is one GLB of three variants (kitlib.py has the format). Targets: art/grid/round-63-night-market-domes/
(A2 and D2: stone post lanterns, round paper lanterns, red banners). Run: bash scripts/blender/build.sh open-plots/kit.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, realise, reset_scene  # noqa: E402

# Default colours (sRGB) for slots a layout's palette may not define; the palette's own colour wins.
SLOTS = {'iron': '#2b2b33', 'gold': '#d8a23e', 'paper': '#ff5b32', 'stone': '#8a8a94', 'stoneTop': '#a6a6b0',
         'stall': '#c0222b', 'lantern': '#ffb347', 'wood': '#5b3a24', 'cloth': '#c8242c', 'stallRoof': '#b0262a',
         'fruit': '#e8892a', 'greens': '#5e9e3e', 'crate': '#8a5a34', 'board': '#14203f', 'awning': '#ff7a2e',
         'roof': '#1c2858', 'wall': '#e9d6b0', 'window': '#ffc96a', 'door': '#4a2a1a', 'bridge': '#d9d5cc',
         'bridgeTop': '#c9c4ba', 'soil': '#3a2a20', 'banner': '#c0222b', 'foliage': '#3f8a36', 'flowerRed': '#e0334a', 'flowerGold': '#f2b632',
         'flowerWhite': '#f2ede4', 'sack': '#b89a6a', 'trunk': '#5a4030'}
# Each lit slot's ruled trim (data/trim.json, sp-o2's RM5.3 kit material); every other slot and all Glow faces are plain.
TRIMS = {'stone': 'stone', 'bridge': 'stone', 'bridgeTop': 'stone', 'roof': 'roofTile', 'stallRoof': 'roofTile', 'wood': 'timber', 'timber': 'timber',
         'wall': 'plaster', 'plaster': 'plaster', 'cloth': 'awningStripe',
         'banner': 'banner'}  # RM10.4: the banners' cloth, which the kit graph sways (sp-o2, bc5c229957)
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
    p.box((0.12, -0.012, 1.04), (0.58, 0.012, 2.24), 'Kit.banner')
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


def hip_roof(p, x0, x1, y0, y1, eave, rise, overhang=0.7, lift=0.6, slot='Kit.roof', under='Kit.wood'):
    """A tiled hip roof over [x0, x1] x [y0, y1] from `eave`, its ridge along the longer side and its corners swept up
    by `lift` (the mockup's upturned eaves), closed underneath."""
    a0, a1, b0, b1 = x0 - overhang, x1 + overhang, y0 - overhang, y1 + overhang
    top = eave + rise
    if a1 - a0 >= b1 - b0:
        ym = (b0 + b1) / 2
        r0, r1 = (a0 + (b1 - b0) / 2, ym, top), (a1 - (b1 - b0) / 2, ym, top)
    else:
        xm = (a0 + a1) / 2
        r0, r1 = (xm, b0 + (a1 - a0) / 2, top), (xm, b1 - (a1 - a0) / 2, top)
    c = {'sw': (a0, b0, eave + lift), 'se': (a1, b0, eave + lift), 'ne': (a1, b1, eave + lift), 'nw': (a0, b1, eave + lift)}
    m = {'s': ((a0 + a1) / 2, b0, eave), 'e': (a1, (b0 + b1) / 2, eave), 'n': ((a0 + a1) / 2, b1, eave), 'w': (a0, (b0 + b1) / 2, eave)}
    if a1 - a0 >= b1 - b0:
        # the long slopes (front and back) each a fan to the ridge; the hip ends a fan to their ridge end
        p.face([c['sw'], m['s'], r0], slot); p.face([m['s'], r1, r0], slot); p.face([m['s'], c['se'], r1], slot)
        p.face([c['ne'], m['n'], r1], slot); p.face([m['n'], r0, r1], slot); p.face([m['n'], c['nw'], r0], slot)
        p.face([c['se'], m['e'], r1], slot); p.face([m['e'], c['ne'], r1], slot)
        p.face([c['nw'], m['w'], r0], slot); p.face([m['w'], c['sw'], r0], slot)
    else:
        p.face([c['sw'], m['s'], r0], slot); p.face([m['s'], c['se'], r0], slot)
        p.face([c['ne'], m['n'], r1], slot); p.face([m['n'], c['nw'], r1], slot)
        p.face([c['se'], m['e'], r0], slot); p.face([m['e'], r1, r0], slot); p.face([m['e'], c['ne'], r1], slot)
        p.face([c['nw'], m['w'], r1], slot); p.face([m['w'], r0, r1], slot); p.face([m['w'], c['sw'], r0], slot)
    ring = [c['sw'], m['w'], c['nw'], m['n'], c['ne'], m['e'], c['se'], m['s']]
    p.face([(x, y, z - 0.08) for x, y, z in ring], under)  # the underside, facing down (clockwise from above)
    for i in range(len(ring)):
        a, b = ring[i], ring[(i + 1) % len(ring)]
        p.face([(a[0], a[1], a[2] - 0.08), (b[0], b[1], b[2] - 0.08), b, a], under)  # the fascia
    p.prism(r0[0], r0[1], 0.07, 0.0, top, top + 0.35, 4, 'Kit.gold', spin=0.785398)
    p.prism(r1[0], r1[1], 0.07, 0.0, top, top + 0.35, 4, 'Kit.gold', spin=0.785398)


def walls(p, x0, x1, y0, y1, z0, z1, posts=True):
    """Plaster walls over a stone plinth, timber corner posts and a timber band under the eave."""
    p.box((x0 - 0.08, y0 - 0.08, 0), (x1 + 0.08, y1 + 0.08, z0), 'Kit.stone', top='Kit.stoneTop')
    p.box((x0, y0, z0), (x1, y1, z1), 'Kit.wall')
    p.box((x0 - 0.05, y0 - 0.05, z1 - 0.25), (x1 + 0.05, y1 + 0.05, z1), 'Kit.wood')
    if posts:
        for x in (x0, x1):
            for y in (y0, y1):
                p.box((x - 0.12, y - 0.12, z0), (x + 0.12, y + 0.12, z1), 'Kit.wood')


def window(p, x, y, z, w, h, face=-1):
    """A lit window on the wall plane y (its face toward `face` y), with a timber frame and a mullion."""
    d = 0.03 * face
    p.box((x - w / 2, min(y, y + d), z), (x + w / 2, max(y, y + d), z + h), 'Glow.window')
    f = 0.06
    p.box((x - w / 2 - f, min(y, y + 2 * d), z - f), (x + w / 2 + f, max(y, y + 2 * d), z), 'Kit.wood')
    p.box((x - w / 2 - f, min(y, y + 2 * d), z + h), (x + w / 2 + f, max(y, y + 2 * d), z + h + f), 'Kit.wood')
    p.box((x - 0.03, min(y, y + 2 * d), z), (x + 0.03, max(y, y + 2 * d), z + h), 'Kit.wood')
    p.emitter((x, y + 0.6 * face, z + h / 2), 'window')


def door(p, x, y, w=1.0, h=2.0):
    p.box((x - w / 2, y - 0.04, 0.3), (x + w / 2, y, 0.3 + h), 'Kit.door')
    p.box((x - w / 2 - 0.08, y - 0.07, 0.3 + h), (x + w / 2 + 0.08, y, 0.3 + h + 0.12), 'Kit.wood')


def cottage():
    """A1/A2's cottage: an 8 x 6 m plaster house with a dark tiled hip roof swept up at the corners, two lit windows
    and a door on the front, a lit window each side (about 250 triangles)."""
    p = Piece()
    walls(p, -4, 4, -3, 3, 0.3, 3.0)
    hip_roof(p, -4, 4, -3, 3, 3.0, 2.0)
    door(p, 0, -3)
    for x in (-2.3, 2.3):
        window(p, x, -3, 1.2, 1.1, 1.0)
    window(p, 2.3, 3, 1.2, 1.1, 1.0, face=1)
    p.box((-0.9, -3.6, 0), (0.9, -3.0, 0.3), 'Kit.stone', top='Kit.stoneTop')  # the step
    return p


def two_storey():
    """A taller house: two floors of lit windows, a skirt roof between them and a hip roof above (8 x 7 m)."""
    p = Piece()
    walls(p, -4, 4, -3.5, 3.5, 0.3, 5.6)
    hip_roof(p, -4, 4, -3.5, 3.5, 5.6, 2.2)
    # the skirt roof over the ground floor: a sloped band all round
    for (a, b, c, d) in (((-4.7, -4.2, 3.2), (4.7, -4.2, 3.2), (4.0, -3.5, 3.7), (-4.0, -3.5, 3.7)),
                         ((4.7, 4.2, 3.2), (-4.7, 4.2, 3.2), (-4.0, 3.5, 3.7), (4.0, 3.5, 3.7)),
                         ((4.7, -4.2, 3.2), (4.7, 4.2, 3.2), (4.0, 3.5, 3.7), (4.0, -3.5, 3.7)),
                         ((-4.7, 4.2, 3.2), (-4.7, -4.2, 3.2), (-4.0, -3.5, 3.7), (-4.0, 3.5, 3.7))):
        p.face([a, b, c, d], 'Kit.roof')
        p.face([(a[0], a[1], a[2] - 0.06), (d[0], d[1], d[2] - 0.06), (c[0], c[1], c[2] - 0.06), (b[0], b[1], b[2] - 0.06)], 'Kit.wood')
    door(p, -1.6, -3.5)
    window(p, 1.6, -3.5, 1.2, 1.2, 1.0)
    for x in (-2.2, 0, 2.2):
        window(p, x, -3.5, 4.0, 0.9, 1.0)
    for x in (-1.6, 1.6):
        window(p, x, 3.5, 4.0, 0.9, 1.0, face=1)
        window(p, x, 3.5, 1.2, 1.1, 1.0, face=1)
    return p


def hall():
    """A wide hall (12 x 6 m) with a porch of timber posts under its front eave, three lit windows and a paper lantern
    either side of the door."""
    p = Piece()
    walls(p, -6, 6, -2.5, 3.0, 0.3, 3.3)
    hip_roof(p, -6, 6, -3.6, 3.0, 3.3, 2.3, overhang=0.5)
    for x in (-5.8, -2.0, 2.0, 5.8):
        p.box((x - 0.12, -3.85, 0.3), (x + 0.12, -3.6, 3.3), 'Kit.wood')
    p.box((-6.3, -4.1, 0), (6.3, -2.5, 0.3), 'Kit.stone', top='Kit.stoneTop')  # the porch floor
    door(p, 0, -2.5, w=1.4, h=2.2)
    for x in (-4.0, 4.0):
        window(p, x, -2.5, 1.2, 1.6, 1.1)
    window(p, 0, 3.0, 1.2, 1.6, 1.1, face=1)
    for x in (-1.2, 1.2):
        p.box((x - 0.012, -3.42, 2.75), (x + 0.012, -3.4, 3.26), 'Kit.iron')
        p.paper_lantern(x, -3.41, 2.75, radius=0.22)
    return p


def string_bulb():
    """A round gold bulb on a lane's string (a bicone, 12 triangles), lit; its origin is its centre."""
    p = Piece()
    p.lathe(0, 0, [(0.0, -0.17), (0.15, 0.0), (0.0, 0.17)], 6, ['Glow.lantern'])
    p.emitter((0, 0, 0), 'lantern')
    return p


def string_lantern():
    """A small red paper lantern hung from a lane's string every fourth bulb; its origin is its hook."""
    p = Piece()
    p.lathe(0, 0, [(0.05, -0.44), (0.16, -0.38), (0.2, -0.24), (0.16, -0.1), (0.05, -0.04)], 6,
            ['Kit.gold', 'Glow.paper', 'Glow.paper', 'Kit.gold'], cap_bottom=True)
    p.emitter((0, 0, -0.24), 'paper')
    return p


def lane_post():
    """A lane crossing's post (6.5 m): an iron pole on a stone foot with a gold cap, and a red banner with a gold head
    hung across the lane, readable from both sides."""
    p = Piece()
    p.box((-0.22, -0.22, 0), (0.22, 0.22, 0.3), 'Kit.stone', top='Kit.stoneTop')
    p.box((-0.1, -0.1, 0.3), (0.1, 0.1, 6.5), 'Kit.iron')
    p.prism(0, 0, 0.16, 0.0, 6.5, 6.8, 4, 'Kit.gold', spin=0.785398, cap_bottom=True)
    p.box((-0.5, -0.03, 5.35), (0.5, 0.03, 5.45), 'Kit.iron', bottom=True)
    p.box((-0.46, -0.012, 2.8), (0.46, 0.012, 5.3), 'Kit.banner')
    p.box((-0.48, -0.022, 5.3), (0.48, 0.022, 5.44), 'Kit.gold', bottom=True)
    p.box((-0.48, -0.022, 2.72), (0.48, 0.022, 2.82), 'Kit.gold', bottom=True)
    return p


def flower_planter():
    """A2's square stone planter (1.8 m): a stepped stone box, soil, a round shrub and red, gold and white flowers."""
    p = Piece()
    p.box((-0.9, -0.9, 0), (0.9, 0.9, 0.55), 'Kit.stone', top='Kit.stoneTop')
    p.box((-0.95, -0.95, 0.55), (0.95, 0.95, 0.65), 'Kit.stoneTop', bottom=True)
    p.box((-0.78, -0.78, 0.65), (0.78, 0.78, 0.7), 'Kit.soil')
    p.lathe(0, 0, [(0.3, 0.68), (0.55, 0.95), (0.52, 1.25), (0.3, 1.45), (0.0, 1.52)], 7, ['Kit.foliage'], spin=0.2)
    # A2's planters spill over: a ring of leafy mounds round the shrub, flowers set into them
    colours = ['Kit.flowerRed', 'Kit.flowerGold', 'Kit.flowerWhite', 'Kit.flowerRed']
    for i in range(8):
        a = 2 * math.pi * i / 8 + 0.3
        x, y = 0.56 * math.cos(a), 0.56 * math.sin(a)
        p.lathe(x, y, [(0.26, 0.68), (0.32, 0.82), (0.22, 0.98), (0.0, 1.03)], 6, ['Kit.foliage'], spin=a)
        for k, (dr, da, dz) in enumerate(((0.1, 0.5, 0.95), (0.18, -0.6, 0.88))):
            fx, fy = (0.56 + dr) * math.cos(a + da * 0.4), (0.56 + dr) * math.sin(a + da * 0.4)
            p.prism(fx, fy, 0.09, 0.02, dz, dz + 0.1, 5, colours[(i + k) % 4], spin=0.7 * i)
    return p


def bench():
    """A plaza bench (2 m): two stone feet and a timber seat and back."""
    p = Piece()
    for x in (-0.8, 0.8):
        p.box((x - 0.12, -0.22, 0), (x + 0.12, 0.22, 0.42), 'Kit.stone', top='Kit.stoneTop')
    p.box((-1.0, -0.25, 0.42), (1.0, 0.25, 0.5), 'Kit.wood', bottom=True)
    p.box((-1.0, 0.2, 0.5), (1.0, 0.26, 0.95), 'Kit.wood')
    return p


def crate_stack():
    """Goods waiting by a stall: three crates of fruit and greens and a sack."""
    p = Piece()
    p.box((-0.55, -0.35, 0), (0.05, 0.25, 0.45), 'Kit.crate', top='Kit.fruit')
    p.box((0.1, -0.3, 0), (0.65, 0.3, 0.4), 'Kit.crate', top='Kit.greens')
    p.box((-0.3, -0.25, 0.45), (0.2, 0.2, 0.8), 'Kit.crate', top='Kit.fruit')
    p.lathe(0.45, 0.45, [(0.18, 0.0), (0.24, 0.2), (0.2, 0.42), (0.06, 0.5)], 6, ['Kit.sack'])
    return p


def coping(p):
    """A 2 m canal coping block on the rim (0.8 m deep from the wall line at its origin, 0.64 m high) with a stone lip
    14 cm over the water (its front)."""
    p.box((-0.99, 0, 0), (0.99, 0.8, 0.5), 'Kit.stone')
    p.box((-1.0, -0.14, 0.5), (1.0, 0.84, 0.64), 'Kit.stoneTop', bottom=True)


def coping_plain():
    p = Piece()
    coping(p)
    return p


def coping_bollard():
    """Coping with an iron mooring bollard and its ring."""
    p = Piece()
    coping(p)
    p.lathe(0, 0.4, [(0.11, 0.64), (0.09, 0.85), (0.13, 0.92), (0.0, 0.98)], 6, ['Kit.iron'])
    return p


def coping_steps():
    """Coping with three stone steps down into the water at its front."""
    p = Piece()
    coping(p)
    for y, z in ((-0.3, 0.42), (-0.6, 0.2), (-0.9, -0.02)):
        p.box((-0.7, y, -0.45), (0.7, y + 0.3, z), 'Kit.stone', top='Kit.stoneTop')
    return p


SOURCES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sources')


def tube(p, path, radii, sides, slot, out, squash=1.0):
    """A tapered tube along `path` (3D points, first to last), its rings `radii` (a last 0 closes it to a point), each
    ring squashed by `squash` along `out` (a horizontal direction) and turned so one ridge faces it; every face winds
    outward. The willow's hanging lobes and its limbs."""
    def sub(a, b):
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

    def unit(a):
        n = math.sqrt(sum(c * c for c in a)) or 1.0
        return [c / n for c in a]

    def cross(a, b):
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

    rings = []
    for k, (c, r) in enumerate(zip(path, radii)):
        t = unit(sub(path[min(k + 1, len(path) - 1)], path[max(k - 1, 0)]))
        d = sum(o * tc for o, tc in zip(out, t))
        u = unit([o - d * tc for o, tc in zip(out, t)])
        v = cross(t, u)
        rings.append([tuple(c[j] + r * (math.cos(a) * squash * u[j] + math.sin(a) * v[j]) for j in range(3))
                      for a in (2 * math.pi * i / sides for i in range(sides))] if r > 1e-6 else [tuple(c)])

    def face(points, inside):
        n = cross(sub(points[1], points[0]), sub(points[2], points[0]))
        mid = [sum(q[j] for q in points) / len(points) for j in range(3)]
        p.face(points if sum(a * b for a, b in zip(n, sub(mid, inside))) >= 0 else list(reversed(points)), slot)

    for k in range(len(rings) - 1):
        a, b, inside = rings[k], rings[k + 1], [(path[k][j] + path[k + 1][j]) / 2 for j in range(3)]
        for i in range(sides):
            j = (i + 1) % sides
            face([a[i], a[j], b[0]] if len(b) == 1 else [a[i], a[j], b[j], b[i]], inside)
    face(rings[0], path[1])


def scripted_willow(height=8.0, seed=11):
    """RM4.7 redo: the weeping willow as a script, not an image-to-3D take (a voxel-remeshed Hunyuan willow read as a
    blob). A forked trunk under a small dome, over which rise and from which hang fourteen long leaf-blade lobes (diamond sections
    flattened against the crown, a ridge facing out), an outer ring of nine and an inner ring of five between them,
    hanging to about a quarter of the height with gaps that show the trunk: the reference's curtain silhouette. Each
    face's tint lights a lobe's outward, upper facets and darkens its inner ones, with a seeded jitter for the facets."""
    import random
    rng = random.Random(seed)
    k = height / 8.0
    p = Piece()
    p.lathe(0, 0, [(0.62 * k, 0), (0.42 * k, 0.5 * k), (0.34 * k, 2.2 * k), (0.28 * k, 3.0 * k), (0.16 * k, 4.6 * k)], 6, ['Kit.trunk'])
    for i in range(3):
        a = 2 * math.pi * i / 3 + 0.4
        tube(p, [(0, 0, 2.6 * k), (0.7 * k * math.cos(a), 0.7 * k * math.sin(a), 4.2 * k), (1.4 * k * math.cos(a), 1.4 * k * math.sin(a), 5.9 * k)],
             [0.24 * k, 0.17 * k, 0.1 * k], 4, 'Kit.trunk', (math.cos(a), math.sin(a), 0))
    p.lathe(0, 0, [(1.8 * k, 5.8 * k), (2.6 * k, 6.8 * k), (2.0 * k, 7.7 * k), (0, 8.0 * k)], 6, ['Kit.foliage'], cap_bottom=True)
    # (count, turn, path (radius, height) from over the crown down to the tip, ring radii: wide and narrow alternate,
    # the reference's layered leaf edge)
    rows = [(9, 0.0, [(0.9, 7.9), (2.2, 7.7), (3.1, 6.9), (3.5, 5.7), (3.6, 4.5), (3.5, 3.3), (3.3, 2.3), (3.1, 1.6)],
             [0.6, 0.95, 1.05, 0.82, 0.95, 0.68, 0.45, 0]),
            (5, 0.35, [(0.4, 8.1), (1.4, 8.0), (2.2, 7.2), (2.5, 5.8), (2.5, 4.3), (2.4, 3.0)], [0.55, 0.9, 0.95, 0.75, 0.55, 0])]
    for count, turn, path, radii in rows:
        for i in range(count):
            a = 2 * math.pi * (i + turn) / count + rng.uniform(-0.12, 0.12)
            drop, reach = rng.uniform(-0.35, 0.45), rng.uniform(0.92, 1.06)
            c, s = math.cos(a), math.sin(a)
            pts = [(r * reach * c * k, r * reach * s * k, (z - drop * (n / (len(path) - 1))) * k) for n, (r, z) in enumerate(path)]
            tube(p, pts, [r * k for r in radii], 4, 'Kit.foliage', (c, s, 0), squash=0.7)
    obj = realise(p, 'tree-willow', 0)
    mesh = obj.data
    fit = height / max(v.co.z for v in mesh.vertices)  # the lobes' rings rise past the path: crown top at `height`
    for v in mesh.vertices:
        v.co *= fit
    tint = mesh.attributes.new('tint', 'FLOAT', 'FACE')
    for poly in mesh.polygons:
        leaf = mesh.materials[poly.material_index].name == 'Kit.foliage'
        c, n = poly.center, poly.normal
        radial = math.hypot(c.x, c.y) or 1.0
        facing = (n.x * c.x + n.y * c.y) / radial  # outward facets light, inner ones dark
        value = 0.8 + 0.12 * facing + 0.08 * n.z + rng.uniform(-0.06, 0.06) if leaf else 0.9 + rng.uniform(-0.08, 0.08)
        tint.data[poly.index].value = max(0.55, min(1.0, value))
    return obj


def generated_tree(name, height, faces, voxel=45):
    """A tree from its image-to-3D source (sources/<name>.glb, model_source.py), `height` metres tall with the trunk's
    foot at the origin: voxel-remeshed into closed masses (a generated crown is many open, intersecting lumps that a
    decimator tears), decimated to about `faces` flat triangles, each face coloured as the nearest source face; then
    Kit.foliage or Kit.trunk by that colour (green or not), its tint the face's brightness against its class's bright
    facets (so light and dark facets survive a palette retint)."""
    import bmesh
    import bpy
    from mathutils.bvhtree import BVHTree
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SOURCES, f'{name}.glb'))
    obj = next(o for o in bpy.data.objects if o not in before and o.type == 'MESH')
    for o in [o for o in bpy.data.objects if o not in before and o is not obj]:
        bpy.data.objects.remove(o)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mesh = obj.data
    zs = [v.co.z for v in mesh.vertices]
    low, top = min(zs), max(zs)
    foot = [v.co for v in mesh.vertices if v.co.z < low + 0.08 * (top - low)]
    cx, cy, k = sum(c.x for c in foot) / len(foot), sum(c.y for c in foot) / len(foot), height / (top - low)
    for v in mesh.vertices:
        v.co.x, v.co.y, v.co.z = (v.co.x - cx) * k, (v.co.y - cy) * k, (v.co.z - low) * k
    # the source's colours, face by face, behind a nearest-face lookup
    colours = mesh.color_attributes[0]
    source = []
    for poly in mesh.polygons:
        values = [colours.data[i if colours.domain == 'CORNER' else mesh.loops[i].vertex_index].color for i in poly.loop_indices]
        source.append([sum(c[j] for c in values) / len(values) for j in range(3)])
    tree = BVHTree.FromPolygons([v.co.copy() for v in mesh.vertices], [list(p.vertices) for p in mesh.polygons], epsilon=0.0)
    mesh.remesh_voxel_size = height / voxel  # a coarser voxel merges a willow's fronds into masses the decimator can reach
    bpy.ops.object.voxel_remesh()
    mod = obj.modifiers.new('decimate', 'DECIMATE')
    mod.ratio = min(1.0, faces / max(1, 2 * len(obj.data.polygons)))  # its ratio counts triangles: a quad is two
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()
    mesh = obj.data
    rgb = [source[tree.find_nearest(poly.center)[2]] for poly in mesh.polygons]
    green = [g > r * 1.08 and g > b * 1.08 for r, g, b in rgb]
    lum = [0.3 * r + 0.59 * g + 0.11 * b for r, g, b in rgb]
    reference = {}
    for cls in (True, False):
        values = sorted(l for l, gr in zip(lum, green) if gr == cls)
        reference[cls] = values[int(0.9 * (len(values) - 1))] if values else 1.0
    mesh.materials.clear()
    mesh.materials.append(bpy.data.materials.get('Kit.trunk') or bpy.data.materials.new('Kit.trunk'))
    mesh.materials.append(bpy.data.materials.get('Kit.foliage') or bpy.data.materials.new('Kit.foliage'))
    tint = mesh.attributes.new('tint', 'FLOAT', 'FACE')
    for poly, gr, l in zip(mesh.polygons, green, lum):
        poly.material_index = 1 if gr else 0
        poly.use_smooth = False
        tint.data[poly.index].value = max(0.55, min(1.0, l / max(1e-6, reference[gr])))
    for attr in list(mesh.color_attributes):
        mesh.color_attributes.remove(attr)
    obj.name = f'tree-{name}'
    return obj


# G755: the figures' own colours (sRGB); a layout's palette may override any of them
FIGURE_SLOTS = {'figSkin': '#e9b892', 'figFace': '#2a1a16', 'figHair': '#2e2420', 'figShoe': '#2b2b33',
                'vendorRobe': '#c8342c', 'vendorApron': '#f1e4c8', 'vendorCap': '#f1e4c8',
                'shopperTop': '#3d74b8', 'shopperSkirt': '#e9b949', 'elderRobe': '#6d5b8e', 'elderHat': '#d8b26a'}


def scripted_figure(kind, height=1.75):
    """G755: a hand-built low-poly market figure (`vendor`, `shopper` or `elder`) facing -y (the kit's front), feet at
    the origin: a robe (or a top over a skirt), arms bent forward, a big round head with a painted face (two dot eyes
    and a mouth line, just proud of the head's front facet) under the figure's own cap, hair bun or straw hat. About
    300 flat-shaded triangles in its own colour slots."""
    p = Piece()
    lower, upper = {'vendor': ('Kit.vendorRobe', 'Kit.vendorRobe'), 'shopper': ('Kit.shopperSkirt', 'Kit.shopperTop'),
                    'elder': ('Kit.elderRobe', 'Kit.elderRobe')}[kind]
    turn = math.pi / 8  # a facet, not a ridge, faces -y: the face sits flat on it
    for x in (-0.09, 0.09):
        p.box((x - 0.06, -0.12, 0), (x + 0.06, 0.06, 0.07), 'Kit.figShoe')
    p.lathe(0, 0, [(0.27, 0.05), (0.25, 0.35), (0.2, 0.8)], 8, [lower], spin=turn, cap_top=False, cap_bottom=True)
    p.lathe(0, 0, [(0.2, 0.8), (0.21, 1.1), (0.23, 1.32), (0.1, 1.43), (0.06, 1.47)], 8, [upper], spin=turn)
    for side in (-1, 1):
        hand = (side * 0.19, -0.2, 0.98)
        tube(p, [(side * 0.22, 0, 1.33), (side * 0.27, -0.05, 1.1), hand], [0.06, 0.055, 0.05], 4, upper, (side, 0, 0))
        p.box((hand[0] - 0.045, hand[1] - 0.05, hand[2] - 0.05), (hand[0] + 0.045, hand[1] + 0.03, hand[2] + 0.04), 'Kit.figSkin')
    p.lathe(0, 0, [(0.07, 1.45), (0.14, 1.5), (0.17, 1.57), (0.17, 1.67), (0.13, 1.75), (0.06, 1.79), (0, 1.8)], 8, ['Kit.figSkin'], spin=turn)
    # the painted face: the front facet is 0.157 m out (0.17 x cos 22.5 degrees) between 1.57 and 1.67 m
    for x in (-0.055, 0.055):
        p.box((x - 0.016, -0.168, 1.622), (x + 0.016, -0.15, 1.652), 'Kit.figFace')
    p.box((-0.045, -0.165, 1.586), (0.045, -0.15, 1.598), 'Kit.figFace')
    if kind == 'vendor':  # a cloth cap and an apron
        p.lathe(0, 0, [(0.178, 1.68), (0.16, 1.77), (0.1, 1.82), (0, 1.84)], 8, ['Kit.vendorCap'], spin=turn, cap_bottom=True)
        p.panel([(-0.15, -0.247, 0.3), (0.15, -0.247, 0.3), (0.13, -0.202, 1.05), (-0.13, -0.202, 1.05)], 'Kit.vendorApron')
    elif kind == 'shopper':  # hair over the crown and a bun at the back
        p.lathe(0, 0.01, [(0.178, 1.66), (0.165, 1.75), (0.1, 1.81), (0, 1.83)], 8, ['Kit.figHair'], spin=turn, cap_bottom=True)
        p.lathe(0, 0.15, [(0.05, 1.66), (0.08, 1.71), (0.06, 1.77), (0, 1.79)], 6, ['Kit.figHair'])
    else:  # a wide straw hat and a cane
        p.lathe(0, 0, [(0.36, 1.71), (0.3, 1.73), (0.12, 1.82), (0, 1.92)], 8, ['Kit.elderHat'], spin=turn, cap_bottom=True)
        tube(p, [(0.19, -0.2, 0.98), (0.23, -0.27, 0.0)], [0.02, 0.02], 4, 'Kit.wood', (1, 0, 0))
    obj = realise(p, f'fig-{kind}', 0)
    fit = height / max(v.co.z for v in obj.data.vertices)  # crown (or hat) top at `height`
    for v in obj.data.vertices:
        v.co *= fit
    return obj


BRIDGE = {'half': 11.5, 'rise': 2.0, 'deck': 0.3, 'width': 4.0, 'water': -0.45, 'open': 10.0}


def deck_top(x):
    u = (x + BRIDGE['half']) / (2 * BRIDGE['half'])
    return BRIDGE['rise'] * math.sin(math.pi * max(0.0, min(1.0, u))) + BRIDGE['deck']


def soffit(x):
    """The arch's underside: an elliptical arch over the water, the abutments solid beyond it."""
    t = abs(x) / BRIDGE['open']
    if t >= 1:
        return BRIDGE['water']
    return min(BRIDGE['water'] + 2.05 * math.sqrt(1 - t * t), deck_top(x) - 0.4)


def bridge_body(p, steps=18):
    """Half of an 8 m arched stone bridge along x: its deck from the seam (y = 0, the lane's middle) to y = width (the
    tile's side), the arch soffit over the canal and the spandrel face on the tile's side."""
    w, n = BRIDGE['width'], steps
    xs = [-BRIDGE['half'] + 2 * BRIDGE['half'] * i / n for i in range(n + 1)]
    for x0, x1 in zip(xs, xs[1:]):
        t0, t1, s0, s1 = deck_top(x0), deck_top(x1), soffit(x0), soffit(x1)
        p.face([(x0, 0, t0), (x1, 0, t1), (x1, w, t1), (x0, w, t0)], 'Kit.bridgeTop')
        p.face([(x1, w, s1), (x0, w, s0), (x0, w, t0), (x1, w, t1)], 'Kit.bridge')
        p.face([(x0, 0, s0), (x0, w, s0), (x1, w, s1), (x1, 0, s1)], 'Kit.bridge')
    for x in (xs[0], xs[-1]):  # the abutment ends, down to the water
        z = deck_top(x)
        pts = [(x, 0, BRIDGE['water']), (x, w, BRIDGE['water']), (x, w, z), (x, 0, z)]
        p.face(pts if x > 0 else list(reversed(pts)), 'Kit.bridge')
    return xs


def railing(p, xs, solid=False, lanterns=False):
    """The balustrade on the tile's side (y 3.55 to 3.85): stone posts every other step with a top and a mid rail, or a
    solid parapet with a coping; `lanterns` hangs paper lanterns from the two crown posts."""
    y0, y1 = 3.55, 3.85
    coarse = xs[::2]
    for x0, x1 in zip(coarse, coarse[1:]):
        t0, t1 = deck_top(x0), deck_top(x1)
        bands = [(0.0, 0.85)] if solid else [(0.82, 0.95), (0.3, 0.4)]
        for lo, hi in bands:
            p.face([(x0, y0, t0 + hi), (x1, y0, t1 + hi), (x1, y1, t1 + hi), (x0, y1, t0 + hi)], 'Kit.bridgeTop')
            p.face([(x0, y0, t0 + lo), (x1, y0, t1 + lo), (x1, y0, t1 + hi), (x0, y0, t0 + hi)], 'Kit.bridge')
            p.face([(x1, y1, t1 + lo), (x0, y1, t0 + lo), (x0, y1, t0 + hi), (x1, y1, t1 + hi)], 'Kit.bridge')
            if lo > 0:
                p.face([(x0, y1, t0 + lo), (x1, y1, t1 + lo), (x1, y0, t1 + lo), (x0, y0, t0 + lo)], 'Kit.bridge')
        if solid:
            p.face([(x0, y0 - 0.06, t0 + 0.92), (x1, y0 - 0.06, t1 + 0.92), (x1, y1 + 0.06, t1 + 0.92), (x0, y1 + 0.06, t0 + 0.92)], 'Kit.gold')
    for x in coarse:
        t = deck_top(x)
        p.box((x - 0.15, y0 - 0.03, t - 0.05), (x + 0.15, y1 + 0.03, t + 1.05), 'Kit.bridge', top='Kit.bridgeTop')
    if lanterns:
        for x in (coarse[len(coarse) // 2 - 1], coarse[len(coarse) // 2]):
            t = deck_top(x)
            p.box((x - 0.02, y0 - 0.32, t + 1.05), (x + 0.02, y0 - 0.02, t + 1.09), 'Kit.iron', bottom=True)
            p.paper_lantern(x, y0 - 0.3, t + 1.05, radius=0.18)


def bridge_rails():
    """D2's white arched bridge: posts and rails."""
    p = Piece()
    railing(p, bridge_body(p))
    return p


def bridge_parapet():
    """A solid parapet with a gold-edged coping."""
    p = Piece()
    railing(p, bridge_body(p), solid=True)
    return p


def bridge_lanterns():
    """Posts and rails with red paper lanterns hung at the crown."""
    p = Piece()
    railing(p, bridge_body(p), lanterns=True)
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'lanterns', [stone_post, paper_post, banner_post], TRIMS, {'slots': SLOTS, **LANTERN})
    reset_scene()
    build_family(out, 'stalls', [hero_stall, row_stall, food_cart], TRIMS, {'slots': SLOTS})
    reset_scene()
    build_family(out, 'houses', [cottage, two_storey, hall], TRIMS, {'slots': SLOTS})
    reset_scene()
    build_family(out, 'props', [flower_planter, bench, crate_stack], TRIMS, {'slots': SLOTS})
    reset_scene()
    build_family(out, 'trees', [lambda: generated_tree('tree-round', 8.0, 420), lambda: generated_tree('tree-tall', 8.0, 420),
                                scripted_willow], TRIMS, {'slots': SLOTS})
    reset_scene()
    build_family(out, 'figures', [lambda n=n: scripted_figure(n) for n in ('vendor', 'shopper', 'elder')], TRIMS,
                 {'slots': {**SLOTS, **FIGURE_SLOTS}})
    reset_scene(ground=-1.0)  # the string's bulbs and lanterns hang below their hooks (origin y 0)
    build_family(out, 'strings', [string_bulb, string_lantern, lane_post], TRIMS, {'slots': SLOTS})
    reset_scene(ground=BRIDGE['water'])
    build_family(out, 'canal', [coping_plain, coping_bollard, coping_steps], TRIMS, {'slots': SLOTS})
    reset_scene(ground=BRIDGE['water'])
    build_family(out, 'bridges', [bridge_rails, bridge_parapet, bridge_lanterns], TRIMS, {'slots': SLOTS})


if __name__ == '__main__':
    main()
