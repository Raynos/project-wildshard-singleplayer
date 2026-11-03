"""ruins.py <out-dir>: the shared ruin-stone kit families (open-plots build-out OB6, Mosslight Ruins; Desert Ruin reuses them).

Two families in kit.py's format (kitlib.py, at most three variants a family), retinted by a layout's palette like every
kit family (G978: blocky, mix and match). Every piece is grey stone blocks under mossy tops, hung with opaque ivy strands,
leafy clumps on and round it, a few patches of glowing moss low on its stones (Glow.mossGlow: Mosslight's emerald; a dry
palette makes it dull sand):
- `ruins`: 0 arch, two square piers and a stepped round arch between them, broken on one side; 1 wall, an L of wall with
  a broken, stepped top and a window gap, rubble at its foot; 2 terrace, three steps of cut stone with a broken parapet;
- `rubble`: 0 a heap of fallen, tilted blocks; 1 three broken column stumps on a plinth and one fallen drum.
Targets: art/grid/round-62-open-plot-palettes/19-mosslight-ruins.jpg. Run: bash scripts/blender/build.sh open-plots/ruins.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS  # noqa: E402

RUIN_SLOTS = {**SLOTS, 'ruin': '#8d938c', 'ruinTop': '#a3a99f', 'ruinDark': '#6c726b', 'moss': '#4f7a3a', 'ivy': '#3d6a2f',
              'ivyDark': '#2c5124', 'mossGlow': '#3dff7a'}
RUIN_TRIMS = {**TRIMS, 'ruin': 'stone', 'ruinDark': 'stone'}


def obox(p, cx, cy, z0, sx, sy, sz, yaw, slot, top=None, tilt=0.0):
    """A block `sx` x `sy` x `sz` m standing on z0 at (cx, cy), turned `yaw` about z and tipped `tilt` about its x axis."""
    c, s = math.cos(yaw), math.sin(yaw)
    ct, st = math.cos(tilt), math.sin(tilt)

    def at(x, y, z):
        # tip about the block's own x axis (through its foot's middle), then turn and place
        y2, z2 = y * ct - z * st, y * st + z * ct
        return (cx + x * c - y2 * s, cy + x * s + y2 * c, z0 + z2)
    hx, hy = sx / 2, sy / 2
    lo = [at(-hx, -hy, 0), at(hx, -hy, 0), at(hx, hy, 0), at(-hx, hy, 0)]
    hi = [at(-hx, -hy, sz), at(hx, -hy, sz), at(hx, hy, sz), at(-hx, hy, sz)]
    p.face(hi, top or slot)
    for i in range(4):
        j = (i + 1) % 4
        p.face([lo[i], lo[j], hi[j], hi[i]], slot)


def ivy(p, x, y, top, length, width, face, rng):
    """A hanging ivy curtain on a wall plane y (its leaves toward `face` y): a sheet whose lower edge is ragged lobes (each
    lobe 0.5-0.8 m), seen from both sides, a little proud of the stone."""
    d = 0.06 * face
    lobes = max(2, int(width / 0.6))
    top_pts = [(x - width / 2 + width * i / lobes, y + d, top) for i in range(lobes + 1)]
    low = [(tx, ty, top - length * (0.55 + 0.45 * rng.random())) for tx, ty, _ in top_pts]
    for i in range(lobes):
        mid = ((top_pts[i][0] + top_pts[i + 1][0]) / 2, y + d, min(low[i][2], low[i + 1][2]) - 0.25 * length * rng.random())
        quad = [top_pts[i], top_pts[i + 1], low[i + 1], mid, low[i]]
        p.panel(quad if face < 0 else list(reversed(quad)), 'Kit.ivy', back='Kit.ivyDark')


def bush(p, x, y, z, r, rng, squash=0.7):
    """A clump of leaves: a faceted six-sided dome `r` m across on z, jittered so no two read alike."""
    spin = rng.random() * math.pi
    p.lathe(x, y, [(r * 0.75, z), (r, z + r * 0.35 * squash), (r * 0.8, z + r * 0.85 * squash), (r * 0.35, z + r * 1.15 * squash)],
            6, ['Kit.ivyDark', 'Kit.ivy', 'Kit.moss'], spin=spin)


def glow_patch(p, x, y, z, w, h, face):
    """A patch of glowing moss on a wall plane y, facing `face` y."""
    d = 0.05 * face
    pts = [(x - w / 2, y + d, z), (x + w / 2, y + d, z), (x + w / 2, y + d, z + h), (x - w / 2, y + d, z + h)]
    p.face(pts if face < 0 else list(reversed(pts)), 'Glow.mossGlow')


def wall_run(p, x0, x1, y0, y1, base, tops, rng, along='x'):
    """A wall of block columns from x0 to x1 (or y0 to y1 when along='y'), each column's top its own height (a broken,
    stepped crest), mossy tops, a proud course every 1.4 m."""
    n = len(tops)
    for i, top in enumerate(tops):
        if along == 'x':
            a, b = x0 + (x1 - x0) * i / n, x0 + (x1 - x0) * (i + 1) / n
            p.box((a, y0, base), (b, y1, top), 'Kit.ruin', top='Kit.moss')
        else:
            a, b = y0 + (y1 - y0) * i / n, y0 + (y1 - y0) * (i + 1) / n
            p.box((x0, a, base), (x1, b, top), 'Kit.ruin', top='Kit.moss')
    lo = min(tops)
    z = base + 1.4
    while z < lo - 0.3:
        if along == 'x':
            p.box((x0 - 0.05, y0 - 0.08, z), (x1 + 0.05, y1 + 0.08, z + 0.22), 'Kit.ruinDark', top='Kit.ruinTop')
        else:
            p.box((x0 - 0.08, y0 - 0.05, z), (x1 + 0.08, y1 + 0.05, z + 0.22), 'Kit.ruinDark', top='Kit.ruinTop')
        z += 1.4 + rng.random() * 0.4


def arch():
    """Two 1.8 m square piers 7 m tall, 6 m apart, joined by a stepped round arch whose east half has fallen; its stones
    on the ground below, ivy from the arch and the piers, glowing moss at the piers' feet."""
    rng = random.Random(61)
    p = Piece()
    for x in (-3.9, 3.9):
        p.box((x - 0.9, -0.9, 0), (x + 0.9, 0.9, 0.5), 'Kit.ruinDark', top='Kit.ruinTop')
        p.box((x - 0.8, -0.8, 0.5), (x + 0.8, 0.8, 7.0), 'Kit.ruin', top='Kit.moss')
        p.box((x - 0.95, -0.95, 7.0), (x + 0.95, 0.95, 7.45), 'Kit.ruinDark', top='Kit.moss')
    # the arch: voussoir blocks on a semicircle of radius 3.9 m springing at 7.45 m, the east ones fallen
    for i in range(9):
        a0, a1 = math.pi * i / 9, math.pi * (i + 1) / 9
        if i < 2:
            continue  # the east springers are gone
        r0, r1 = 3.1, 4.5
        pts = [(r0 * math.cos(a0), r1 * math.cos(a0), r1 * math.cos(a1), r0 * math.cos(a1)),
               (r0 * math.sin(a0), r1 * math.sin(a0), r1 * math.sin(a1), r0 * math.sin(a1))]
        for y0, y1 in ((-0.75, 0.75),):
            ring = [(pts[0][k], y0, 7.45 + pts[1][k]) for k in range(4)]
            back = [(pts[0][k], y1, 7.45 + pts[1][k]) for k in range(4)]
            p.face([ring[0], ring[1], ring[2], ring[3]][::-1], 'Kit.ruin')
            p.face([back[0], back[1], back[2], back[3]], 'Kit.ruin')
            p.face([ring[1], back[1], back[2], ring[2]], 'Kit.moss')  # the extrados, mossy
            p.face([ring[0], ring[3], back[3], back[0]], 'Kit.ruinDark')  # the soffit
            if i == 2:
                p.face([ring[0], back[0], back[1], ring[1]], 'Kit.ruinDark')  # the broken end
            if i == 8:
                p.face([ring[3], ring[2], back[2], back[3]], 'Kit.ruinDark')
    for (x, y, yaw, tilt) in ((5.6, -1.6, 0.4, 0.3), (6.4, 0.9, 1.2, -0.2), (4.9, 1.8, 2.3, 0.5)):
        obox(p, x, y, 0, 1.4, 0.9, 0.8, yaw, 'Kit.ruin', top='Kit.moss', tilt=tilt)
    for x, length in ((-2.8, 4.0), (-1.2, 2.6), (0.4, 3.2)):
        ivy(p, x, -0.75, 7.45 + math.sqrt(max(0.0, 3.8 ** 2 - x ** 2)) - 0.3, length, 0.9, -1, rng)
    for x in (-3.9, 3.9):
        ivy(p, x, -0.8, 7.0, 4.5, 1.6, -1, rng)
        glow_patch(p, x, -0.8, 0.6, 1.0, 0.5, -1)
    bush(p, -3.9, 0, 7.45, 1.4, rng)
    bush(p, -1.5, 0, 7.45 + 3.6, 1.2, rng)
    for x, y, r in ((-5.6, -0.6, 1.3), (5.0, 0.2, 1.0), (-2.4, 1.6, 0.9), (6.6, -0.4, 0.8)):
        bush(p, x, y, 0, r, rng)
    return p


def wall():
    """An L of 1 m wall: 10 m along x with a 1.6 m window gap, 7 m back along y on the west; stepped broken tops 3-6.5 m,
    ivy down its face, a few fallen blocks and glowing moss at its foot."""
    rng = random.Random(62)
    p = Piece()
    wall_run(p, -5.0, -1.2, -0.5, 0.5, 0, [5.2, 6.4, 6.0, 4.8, 5.5], rng)
    p.box((-1.2, -0.5, 0), (0.4, 0.5, 1.4), 'Kit.ruin', top='Kit.ruinTop')  # the window's sill below the gap
    p.box((-1.2, -0.5, 3.4), (0.4, 0.5, 4.0), 'Kit.ruinDark', top='Kit.moss')  # the lintel stone left in the gap
    wall_run(p, 0.4, 5.0, -0.5, 0.5, 0, [4.4, 3.6, 3.9, 2.6, 3.1], rng)
    wall_run(p, -5.0, -4.0, 0.5, 7.0, 0, [6.0, 5.1, 4.2, 4.6, 3.2], rng, along='y')
    for x, top, length in ((-3.8, 6.2, 4.2), (-2.2, 6.0, 3.0), (1.6, 3.8, 2.4), (3.6, 3.0, 1.8)):
        ivy(p, x, -0.5, top, length, 1.0, -1, rng)
    for (x, y, yaw, tilt) in ((2.4, -1.6, 0.3, 0.2), (3.8, -1.2, 1.1, -0.3), (-0.4, -1.9, 2.0, 0.4), (1.2, -2.6, 0.7, 0.0)):
        obox(p, x, y, 0, 1.1, 0.7, 0.6, yaw, 'Kit.ruin', top='Kit.moss', tilt=tilt)
    for x in (-3.4, 2.8):
        glow_patch(p, x, -0.5, 0.2, 1.4, 0.6, -1)
    for x, z, r in ((-4.3, 6.4, 1.3), (-1.9, 6.0, 1.0), (1.3, 4.4, 1.1), (-4.5, 4.6, 1.2)):
        bush(p, x, 0 if x > -4 else 3.0, z, r, rng)
    for x, y, r in ((-5.8, -1.0, 1.4), (4.8, -1.4, 1.1), (-2.8, 3.4, 1.6), (0.6, -1.4, 0.8)):
        bush(p, x, y, 0, r, rng)
    return p


def rubble():
    """A heap of thirteen fallen, tilted blocks about 6 m across and 2.5 m high, moss on their tops and glowing moss between."""
    rng = random.Random(63)
    p = Piece()
    for i in range(13):
        a = rng.random() * math.pi * 2
        r = 2.6 * math.sqrt(rng.random())
        z = 0.0 if r > 1.4 else 0.6 + 0.5 * rng.random()
        size = 0.7 + 0.8 * rng.random()
        obox(p, r * math.cos(a), r * math.sin(a), z if i > 3 else 0.0, size * 1.4, size, size * 0.8,
             rng.random() * math.pi, 'Kit.ruin', top='Kit.moss', tilt=(rng.random() - 0.5) * 0.8)
    obox(p, 0, 0, 0, 2.4, 2.0, 1.1, 0.3, 'Kit.ruinDark', top='Kit.moss')
    p.face([(-0.9, -1.2, 1.12), (0.7, -1.4, 1.12), (0.9, 0.4, 1.12), (-0.6, 0.6, 1.12)], 'Glow.mossGlow')
    for a, r in ((0.3, 1.3), (2.2, 1.0), (4.1, 1.5)):
        bush(p, 3.0 * math.cos(a), 3.0 * math.sin(a), 0, r, rng)
    return p


def columns():
    """Three broken octagonal column stumps (4.5, 2.8, 1.6 m) on a stepped plinth, capitals on the tallest, one drum fallen."""
    p = Piece()
    p.box((-6.0, -1.6, 0), (6.0, 1.6, 0.4), 'Kit.ruinDark', top='Kit.ruinTop')
    p.box((-5.6, -1.2, 0.4), (5.6, 1.2, 0.8), 'Kit.ruin', top='Kit.moss')
    for x, h in ((-3.6, 4.5), (0.0, 2.8), (3.6, 1.6)):
        p.box((x - 0.8, -0.8, 0.8), (x + 0.8, 0.8, 1.2), 'Kit.ruinDark', top='Kit.ruinTop')
        p.prism(x, 0, 0.62, 0.55, 1.2, 1.2 + h, 8, 'Kit.ruin', spin=math.pi / 8)
        p.prism(x, 0, 0.6, 0.6, 1.2 + h, 1.25 + h, 8, 'Kit.moss', spin=math.pi / 8)
    p.box((-4.5, -0.9, 5.7), (-2.7, 0.9, 6.1), 'Kit.ruinDark', top='Kit.moss')  # the tall stump's capital
    # the fallen drum, lying along x in front of the plinth
    drum = Piece()
    drum.prism(0, 0, 0.6, 0.6, -1.4, 1.4, 8, 'Kit.ruin', spin=math.pi / 8, cap_bottom=True)
    for v in drum.bm.verts:
        x, y, z = v.co
        v.co = (z + 1.5, y - 3.0, x + 0.6)
    for f in drum.bm.faces:
        verts = [p.bm.verts.new(v.co) for v in f.verts]
        nf = p.bm.faces.new(verts)
        nf.material_index = p.slot(drum.slots[f.material_index])
    p.face([(-1.6, -1.65, 0.42), (-0.4, -1.65, 0.42), (-0.4, -1.65, 0.75), (-1.6, -1.65, 0.75)], 'Glow.mossGlow')
    rng = random.Random(64)
    for x, y, z, r in ((-3.6, 0, 6.1, 1.0), (5.2, 0.6, 0.8, 1.0), (-5.4, -0.6, 0.8, 0.9), (1.8, 1.0, 0.8, 0.8), (6.8, -1.6, 0, 1.2)):
        bush(p, x, y, z, r, rng)
    return p


def terrace():
    """Three 0.6 m steps of cut stone, 9 m wide and 4.2 m deep, a broken parapet along the top's back edge."""
    rng = random.Random(65)
    p = Piece()
    for i in range(3):
        p.box((-4.5, -2.1 + 1.4 * i, 0), (4.5, 2.1, 0.6 * (i + 1)), 'Kit.ruin', top='Kit.ruinTop')
    wall_run(p, -4.5, 4.5, 1.5, 2.1, 1.8, [3.0, 2.6, 2.9, 2.2, 2.4, 1.9, 2.7], rng)
    for x in (-3.2, 1.0, 3.6):
        ivy(p, x, 1.5, 2.7, 1.8, 0.8, -1, rng)
    glow_patch(p, -1.6, -2.1, 0.1, 1.2, 0.4, -1)
    for x, z, r in ((-4.0, 2.6, 1.1), (2.4, 2.4, 1.0), (4.4, 2.2, 0.9)):
        bush(p, x, 1.8, z, r, rng)
    for x, r in ((-5.4, 1.2), (5.5, 1.3)):
        bush(p, x, -1.4, 0, r, rng)
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'ruins', [arch, wall, terrace], RUIN_TRIMS, {'slots': RUIN_SLOTS})
    reset_scene()
    build_family(out, 'rubble', [rubble, columns], RUIN_TRIMS, {'slots': RUIN_SLOTS})


if __name__ == '__main__':
    main()
