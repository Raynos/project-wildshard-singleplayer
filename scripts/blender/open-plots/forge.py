"""forge.py <out-dir>: Ember Forge's theme kit families (OB4, project/archive/2026-11-03-open-plots-build-out.md, G978).

Two families in kit.py's format (kitlib.py), retinted by a layout's palette like every kit family:
- `forges`: the forge-hall tile's buildings in coursed basalt under iron roofs: a smithy with a glowing hearth and a
  squat stack, a two-stack foundry hall with a lava-lit door, and an open anvil yard (a lean-to over an anvil, a
  glowing hearth and a quench trough);
- `ore`: the ore-heap-and-crane tile's dressing: a faceted coal heap with glowing embers, a lattice crane hanging a
  bucket over a heap, and a pair of loaded ore carts on a short track.
Lava and embers are `Glow.window` (the layout's window colour is its molten orange), the cold lamps `Glow.lantern` (its
lantern colour is the blue); each lamp hangs on a bracket or a post (G827). Target:
art/grid/round-62-open-plot-palettes/17-ember-forge.jpg. Run: bash scripts/blender/build.sh open-plots/forge.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS  # noqa: E402
from bayou import hung_lantern  # noqa: E402

# Slots a layout may not define (sRGB); the palette's own colour wins.
FORGE_SLOTS = {**SLOTS, 'basalt': '#2c2e36', 'basaltTop': '#3a3d46', 'coal': '#1c1c22', 'ore': '#4a3a30',
               'rope': '#2a2420', 'rail': '#5a5f6a'}
FORGE_TRIMS = {**TRIMS, 'basalt': 'stone', 'basaltTop': 'stone'}


def jitter(i, k=0):
    """A seeded draw in [0, 1) from two integers (the kit's builders stay deterministic without an rng)."""
    return ((i * 7919 + k * 104729 + 13) % 1009) / 1009


def basalt_walls(p, x0, x1, y0, y1, z0, z1):
    """Basalt walls: the box, a plinth course, chamfer-like corner piers and a cornice under the eave."""
    p.box((x0, y0, z0), (x1, y1, z1), 'Kit.basalt', top='Kit.basaltTop')
    p.box((x0 - 0.12, y0 - 0.12, z0), (x1 + 0.12, y1 + 0.12, z0 + 0.5), 'Kit.basaltTop')
    p.box((x0 - 0.1, y0 - 0.1, z1 - 0.25), (x1 + 0.1, y1 + 0.1, z1), 'Kit.iron')
    for x in (x0, x1):
        for y in (y0, y1):
            p.box((x - 0.25, y - 0.25, z0), (x + 0.25, y + 0.25, z1 + 0.15), 'Kit.basaltTop')
    for z in (z0 + 1.4, z0 + 2.6):  # two courses picked out round the walls
        p.box((x0 - 0.04, y0 - 0.04, z), (x1 + 0.04, y1 + 0.04, z + 0.08), 'Kit.basaltTop')


def iron_roof(p, x0, x1, y0, y1, eave, rise, overhang=0.4):
    """A ribbed iron gable roof, its ridge along x, closed underneath, its gables in basalt."""
    a0, a1, b0, b1 = x0 - overhang, x1 + overhang, y0 - overhang, y1 + overhang
    ym, top = (b0 + b1) / 2, eave + rise
    p.face([(a0, b0, eave), (a1, b0, eave), (a1, ym, top), (a0, ym, top)], 'Kit.roof')
    p.face([(a1, b1, eave), (a0, b1, eave), (a0, ym, top), (a1, ym, top)], 'Kit.roof')
    p.face([(a0, b0, eave - 0.08), (a0, ym, top - 0.08), (a1, ym, top - 0.08), (a1, b0, eave - 0.08)], 'Kit.iron')
    p.face([(a1, b1, eave - 0.08), (a1, ym, top - 0.08), (a0, ym, top - 0.08), (a0, b1, eave - 0.08)], 'Kit.iron')
    for x, s in ((x0, -1), (x1, 1)):
        tri = [(x, y0, eave), (x, ym, top - 0.1), (x, y1, eave)]
        p.face(tri if s > 0 else list(reversed(tri)), 'Kit.basalt')
    n = max(2, round((a1 - a0) / 0.9))
    for i in range(n + 1):  # the ribs down both slopes
        x = a0 + (a1 - a0) * i / n
        for b in (b0, b1):
            p.face([(x - 0.05, b, eave + 0.04), (x + 0.05, b, eave + 0.04), (x + 0.05, ym, top + 0.04), (x - 0.05, ym, top + 0.04)][::(1 if b == b0 else -1)], 'Kit.iron')
    p.box((a0, ym - 0.12, top - 0.05), (a1, ym + 0.12, top + 0.14), 'Kit.iron')


def stack(p, x, y, z0, z1, r=0.55):
    """A round banded basalt stack from the roof, its mouth glowing."""
    p.lathe(x, y, [(r + 0.12, z0), (r, z0 + 0.4), (r, z1 - 0.6), (r + 0.15, z1 - 0.6), (r + 0.15, z1), (r - 0.12, z1), (r - 0.12, z1 - 0.2)],
            10, ['Kit.basaltTop', 'Kit.basalt', 'Kit.iron', 'Kit.coal', 'Kit.coal', 'Glow.window'])
    p.prism(x, y, r + 0.05, r + 0.05, z0 + (z1 - z0) * 0.45, z0 + (z1 - z0) * 0.45 + 0.18, 10, 'Kit.iron')


def lit_door(p, x, y, w, h, face=-1):
    """An iron-framed doorway glowing with the forge's light, a lintel over it."""
    d = 0.03 * face
    p.box((x - w / 2, min(y, y + d), 0.0), (x + w / 2, max(y, y + d), h), 'Glow.window')
    p.box((x - w / 2 - 0.2, min(y, y + 2 * d), 0.0), (x - w / 2, max(y, y + 2 * d), h + 0.2), 'Kit.iron')
    p.box((x + w / 2, min(y, y + 2 * d), 0.0), (x + w / 2 + 0.2, max(y, y + 2 * d), h + 0.2), 'Kit.iron')
    p.box((x - w / 2 - 0.35, min(y, y + 5 * d), h + 0.2), (x + w / 2 + 0.35, max(y, y + 5 * d), h + 0.55), 'Kit.basaltTop')


def lit_slit(p, x, y, z, w, h, face=-1):
    """A narrow glowing window slit with an iron sill."""
    d = 0.03 * face
    p.box((x - w / 2, min(y, y + d), z), (x + w / 2, max(y, y + d), z + h), 'Glow.window')
    p.box((x - w / 2 - 0.08, min(y, y + 4 * d), z - 0.1), (x + w / 2 + 0.08, max(y, y + 4 * d), z), 'Kit.iron')


def smithy():
    """A 6 x 5 m basalt smithy under a ribbed iron roof: a glowing hearth door, two lit slits, a squat stack and a blue
    lamp on a bracket by its door (about 700 triangles)."""
    p = Piece()
    basalt_walls(p, -3.0, 3.0, -2.5, 2.5, 0.0, 3.6)
    iron_roof(p, -3.0, 3.0, -2.5, 2.5, 3.6, 1.6)
    lit_door(p, -0.8, -2.5, 1.4, 2.2)
    for x in (1.3, 2.2):
        lit_slit(p, x, -2.5, 1.2, 0.35, 1.0)
    lit_slit(p, 0.0, 2.5, 1.2, 0.5, 1.0, face=1)
    stack(p, 1.6, 0.9, 4.2, 7.4)
    p.box((-2.05, -2.64, 0.0), (-1.9, -2.5, 2.9), 'Kit.iron')  # the lamp's post
    hung_lantern(p, -1.97, -2.57, 2.8, arm=0.5)
    return p


def foundry():
    """A 10 x 6 m two-stack foundry hall: a wide lava-lit door, four lit slits along the front, two banded stacks with
    glowing mouths, a blue lamp at each front corner on its bracket (about 1,100 triangles)."""
    p = Piece()
    basalt_walls(p, -5.0, 5.0, -3.0, 3.0, 0.0, 4.6)
    iron_roof(p, -5.0, 5.0, -3.0, 3.0, 4.6, 2.0)
    lit_door(p, 0.0, -3.0, 2.4, 3.0)
    for x in (-3.8, -2.4, 2.4, 3.8):
        lit_slit(p, x, -3.0, 1.6, 0.35, 1.4)
    for x in (-2.5, 2.5):
        lit_slit(p, x, 3.0, 1.6, 0.5, 1.2, face=1)
    stack(p, -2.4, 1.2, 5.6, 10.6, 0.7)
    stack(p, 2.4, 1.2, 5.6, 9.8, 0.7)
    for x in (-4.9, 4.9):
        hung_lantern(p, x, -3.12, 3.8, arm=0.55)
    return p


def anvil_yard():
    """An open forge yard: an iron lean-to on four posts over an anvil on its block, a glowing hearth with a hood and a
    quench trough, a rack of tools, a blue lamp hung from the roof's front beam (about 800 triangles)."""
    p = Piece()
    for x in (-3.0, 3.0):  # the posts and the lean-to
        for y, h in ((-2.2, 3.0), (2.2, 3.8)):
            p.box((x - 0.14, y - 0.14, 0.0), (x + 0.14, y + 0.14, h), 'Kit.iron')
    p.slab([(-3.4, -2.6, 3.0), (3.4, -2.6, 3.0), (3.4, 2.6, 3.8), (-3.4, 2.6, 3.8)], 0.12, 'Kit.roof', under='Kit.iron')
    p.box((-3.2, -2.32, 2.8), (3.2, -2.08, 3.0), 'Kit.iron')  # the front beam
    p.box((-1.6, -0.6, 0.0), (-0.6, 0.4, 0.7), 'Kit.basaltTop')  # the anvil's block, then the anvil
    p.box((-1.5, -0.35, 0.7), (-0.7, 0.15, 0.85), 'Kit.iron')
    p.box((-1.35, -0.25, 0.85), (-0.85, 0.05, 1.0), 'Kit.iron')
    p.box((-1.75, -0.32, 1.0), (-0.55, 0.12, 1.18), 'Kit.iron')
    p.prism(-1.85, -0.1, 0.12, 0.02, 1.02, 1.16, 4, 'Kit.iron', spin=0.785398)  # its horn
    p.box((0.6, 0.4, 0.0), (2.6, 2.0, 0.9), 'Kit.basalt', top='Kit.basaltTop')  # the hearth, its coals and hood
    p.box((0.85, 0.65, 0.9), (2.35, 1.75, 0.98), 'Glow.window')
    p.prism(1.6, 1.2, 1.15, 0.35, 1.9, 2.9, 4, 'Kit.iron', spin=0.785398, cap_top=False)
    p.prism(1.6, 1.2, 0.32, 0.32, 2.9, 4.6, 6, 'Kit.iron')
    p.box((-2.8, 1.0, 0.0), (-1.0, 1.8, 0.6), 'Kit.iron')  # the quench trough and its water
    p.box((-2.65, 1.15, 0.6), (-1.15, 1.65, 0.61), 'Kit.water')
    for i in range(4):  # tongs and hammers on a rack along the back posts
        x = -2.6 + i * 0.5
        p.box((x - 0.03, 2.05, 1.2), (x + 0.03, 2.11, 2.1), 'Kit.iron')
        p.box((x - 0.08, 2.03, 2.0 - (i % 2) * 0.6), (x + 0.08, 2.13, 2.12 - (i % 2) * 0.6), 'Kit.iron')
    p.box((-3.2, 2.06, 2.15), (-0.6, 2.14, 2.25), 'Kit.iron')
    hung_lantern(p, 2.4, -2.2, 2.85, arm=0.05)
    return p


def lumps(p, cx, cy, radius, height, count, seed, slots):
    """A faceted heap: `count` tetra-ish lumps strewn in a cone (bigger and lower at the rim, smaller on top)."""
    for i in range(count):
        a, d = i * 2.399963 + seed, radius * math.sqrt((i + 0.5) / count)
        x, y = cx + d * math.cos(a), cy + d * math.sin(a)
        z = height * (1.0 - (d / radius) ** 1.4)
        r = 0.25 + 0.35 * jitter(i, seed)
        p.prism(x, y, r, r * 0.45, max(0.0, z - r * 0.8), z + r * 0.6, 5, slots[i % len(slots)], spin=a)


def coal_heap():
    """A broad faceted coal-and-ore heap with embers glowing among the lumps, a shovel stuck in it (about 900 triangles)."""
    p = Piece()
    p.lathe(0.0, 0.0, [(4.2, 0.0), (3.4, 0.6), (2.2, 1.5), (1.0, 2.3), (0.0, 2.6)], 9, ['Kit.coal', 'Kit.coal', 'Kit.ore', 'Kit.coal'], spin=0.3)
    lumps(p, 0.0, 0.0, 3.6, 2.4, 60, 3, ['Kit.coal', 'Kit.ore', 'Kit.coal'])
    for i in range(7):  # the embers
        a, d = i * 2.1 + 0.7, 1.2 + 1.8 * jitter(i, 9)
        z = 2.4 * (1.0 - (d / 3.6) ** 1.4)
        p.prism(d * math.cos(a), d * math.sin(a), 0.22, 0.0, z - 0.05, z + 0.25, 4, 'Glow.window', spin=a)
    p.box((1.2, -0.04, 1.4), (1.26, 0.04, 3.0), 'Kit.wood')  # the shovel
    p.box((1.0, -0.03, 1.2), (1.46, 0.03, 1.6), 'Kit.iron')
    return p


def ore_crane():
    """A lattice crane on a basalt foot, its boom out over a small ore heap, a bucket hung on its chain, a blue lamp on
    its mast (about 1,000 triangles)."""
    p = Piece()
    p.box((-1.1, -1.1, 0.0), (1.1, 1.1, 0.8), 'Kit.basalt', top='Kit.basaltTop')
    for dx in (-0.45, 0.45):
        for dy in (-0.45, 0.45):
            p.box((dx - 0.08, dy - 0.08, 0.8), (dx + 0.08, dy + 0.08, 9.0), 'Kit.iron')
    for k in range(8):
        z = 1.4 + k * 1.0
        p.box((-0.55, -0.55, z), (0.55, 0.55, z + 0.1), 'Kit.iron')
        if k % 2 == 0:  # a diagonal on each face
            p.face([(-0.53, -0.56, z), (-0.4, -0.56, z), (0.53, -0.56, z + 1.0), (0.4, -0.56, z + 1.0)], 'Kit.iron')
    p.box((-0.6, -0.6, 9.0), (0.6, 0.6, 9.4), 'Kit.iron')
    p.box((-0.15, -0.7, 9.2), (0.15, 5.8, 9.5), 'Kit.iron')  # the boom, over the heap at +y
    p.box((-0.4, -1.6, 8.8), (0.4, -0.7, 9.6), 'Kit.basalt')  # the counterweight
    for t in range(6):  # the stay: a bar from the mast head down to the boom's end, in short steps
        y0, y1 = 5.6 * t / 6, 5.6 * (t + 1) / 6
        z0, z1 = 11.0 - 1.5 * t / 6, 11.0 - 1.5 * (t + 1) / 6
        p.box((-0.05, y0, min(z0, z1) - 0.05), (0.05, y1, max(z0, z1)), 'Kit.iron')
    p.box((-0.12, -0.12, 9.4), (0.12, 0.12, 11.0), 'Kit.iron')
    for k in range(10):  # the chain
        z = 9.2 - (k + 1) * 0.5
        w = (0.04, 0.12) if k % 2 == 0 else (0.12, 0.04)
        p.box((-w[0], 5.2 - w[1], z), (w[0], 5.2 + w[1], z + 0.46), 'Kit.iron')
    p.lathe(0.0, 5.2, [(0.3, 3.1), (0.75, 3.3), (0.85, 4.1), (0.7, 4.1), (0.7, 3.95)], 8, ['Kit.iron', 'Kit.iron', 'Kit.iron', 'Kit.ore'],
            cap_bottom=True)
    lumps(p, 0.0, 5.0, 2.4, 1.4, 26, 5, ['Kit.ore', 'Kit.coal'])
    hung_lantern(p, 0.0, -0.55, 4.0, arm=0.45)
    return p


def ore_carts():
    """Two loaded ore carts on a short length of track along x (rails on sleepers), one heaped with glowing slag (about
    700 triangles)."""
    p = Piece()
    for i in range(9):  # the sleepers, then the rails
        x = -4.0 + i
        p.box((x - 0.15, -0.9, 0.0), (x + 0.15, 0.9, 0.12), 'Kit.wood')
    for y in (-0.55, 0.55):
        p.box((-4.2, y - 0.06, 0.12), (4.2, y + 0.06, 0.24), 'Kit.rail')
    for k, (cx, slot) in enumerate(((-1.8, 'Kit.ore'), (1.6, 'Glow.window'))):
        p.box((cx - 1.0, -0.75, 0.45), (cx + 1.0, 0.75, 1.3), 'Kit.iron')  # the tub, its rim and band
        p.box((cx - 1.05, -0.8, 1.2), (cx + 1.05, 0.8, 1.32), 'Kit.rail')
        p.box((cx - 1.03, -0.78, 0.8), (cx + 1.03, 0.78, 0.88), 'Kit.rail')
        for wx in (cx - 0.6, cx + 0.6):
            for wy in (-0.55, 0.55):
                p.wheel(wx, wy, 0.32, 0.3, 0.12, 8, 'Kit.iron')
        lumps(p, cx, 0.0, 0.8, 0.6, 9, 7 + k, [slot, 'Kit.coal'] if slot == 'Kit.ore' else [slot])
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'forges', [smithy, foundry, anvil_yard], FORGE_TRIMS, {'slots': FORGE_SLOTS})
    reset_scene()
    build_family(out, 'ore', [coal_heap, ore_crane, ore_carts], FORGE_TRIMS, {'slots': FORGE_SLOTS})


if __name__ == '__main__':
    main()
