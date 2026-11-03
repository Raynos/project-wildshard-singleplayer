"""furnace.py <out-dir>: Ember Forge's landmark as a Blender script (OB4, docs/plans/open-plots/build-out-mini-plan.md):
the script take of the dwarven furnace hall, beside the image-to-3D takes on the pick board
(art/ember-forge/round-1-landmark/).

Hard-surface faceted basalt in the open plots' kit idiom (G978: blocky), after
art/grid/round-62-open-plot-palettes/17-ember-forge.jpg: a stepped plinth, a hall of coursed basalt blocks with chamfered
pilasters and buttresses, a ribbed iron roof, a gabled front over a great stepped arch glowing molten orange under an
iron diamond emblem, four round furnace stacks along the ridge with glowing mouths, low annex wings with lit windows,
a crane either side hanging a glowing crucible, lava troughs along the plinth and cold blue lamps on every buttress.
Every face samples the swatch atlas (landmarklib.py); the lit parts (lava, mouths, windows, blue lamps) are swatches
the Landmark material draws as they are (their glow is the plot's light bake and pools). Exports landmark.glb (near,
15-25k triangles) and landmark-far.glb (<= 2.5k), 35 m tall to the stack tops, pivot at the plinth's foot, front +Z
(Blender -y).
Run: bash scripts/blender/build.sh open-plots/furnace.
"""
import math
import os
import random
import sys

import bmesh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece  # noqa: E402
from landmarklib import atlas_image, export, far_copy, finish, triangles  # noqa: E402

HEIGHT = 35.0
SEED = 17
# sRGB swatches, lightest first (judged against art/grid/round-62-open-plot-palettes/17-ember-forge.jpg)
SWATCHES = {
    'basalt': ['#4a4e58', '#3a3d46', '#2c2e36', '#202228'],
    'stone': ['#5a5e6a', '#4a4e5a', '#3a3d48', '#2c2e38'],
    'iron': ['#5a5f6a', '#464a54', '#363940', '#272a30'],
    'lava': ['#ffb04a', '#ff8a2a', '#f06a1a', '#d84e10'],
    'blue': ['#a8e4ff', '#7cd2ff', '#58bcf4', '#3aa2e0'],
    'soot': ['#2a2420', '#221d1a', '#1a1614', '#13100e'],
}
HALL = (-13.0, -9.0, 13.0, 9.0)  # x0, y0, x1, y1 of the hall body
BASE, EAVE = 2.4, 13.0  # the plinth's top and the hall's eave


def cbox(p, lo, hi, slot, r=0.12):
    """A box with every edge chamfered (one bevel segment): the kit's crisp hard-surface edge."""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x, v.co.y, v.co.z = x0 + (v.co.x + 0.5) * (x1 - x0), y0 + (v.co.y + 0.5) * (y1 - y0), z0 + (v.co.z + 0.5) * (z1 - z0)
    r = min(r, 0.3 * min(x1 - x0, y1 - y0, z1 - z0))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=r, segments=1, affect='EDGES', profile=0.5)
    for f in bm.faces:
        p.face([tuple(v.co) for v in f.verts], slot)
    bm.free()


def block(p, lo, hi, slot, open_side):
    """A wall block proud of its wall: five faces (`open_side` 'y-', 'y+', 'x-' or 'x+' is the wall's, left out)."""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    faces = {'z+': [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
             'z-': [(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)],
             'y-': [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
             'x+': [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],
             'y+': [(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)],
             'x-': [(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)]}
    for side, points in faces.items():
        if side != open_side:
            p.face(points, slot)


def coursing(p, rng, along, fixed, side, a0, a1, z0, z1, skip=()):
    """Running-bond courses of proud blocks over one wall: `along` 'x' or 'y' between a0 and a1, the wall's plane at
    `fixed`, facing `side` (-1 or +1); `skip` the (a0, a1, z0, z1) openings the courses leave clear."""
    course, proud, z, row = 0.9, 0.09, z0, 0
    while z + course <= z1 + 1e-6:
        a = a0 + (0.0 if row % 2 == 0 else -0.6)
        while a < a1 - 0.2:
            length = rng.uniform(1.3, 2.3)
            s0, s1 = max(a, a0) + 0.05, min(a + length, a1) - 0.05
            mid = (s0 + s1) / 2
            if s1 - s0 > 0.3 and not any(o0 < mid < o1 and q0 < z + course / 2 < q1 for o0, o1, q0, q1 in skip):
                lift = rng.uniform(0.0, 0.05)
                n0, n1 = (fixed, fixed + side * (proud + lift)) if side > 0 else (fixed + side * (proud + lift), fixed)
                if along == 'x':
                    block(p, (s0, n0, z + 0.05), (s1, n1, z + course - 0.05), 'Kit.stone', 'y-' if side > 0 else 'y+')
                else:
                    block(p, (n0, s0, z + 0.05), (n1, s1, z + course - 0.05), 'Kit.stone', 'x-' if side > 0 else 'x+')
            a += length
        z += course
        row += 1


def plinth(p, rng):
    """A two-step plinth of chamfered basalt, its front step coursed, and the lava troughs along its front."""
    cbox(p, (-17.0, -13.0, 0.0), (17.0, 12.5, 1.2), 'Kit.basalt', 0.2)
    cbox(p, (-15.5, -11.0, 1.2), (15.5, 11.0, BASE), 'Kit.basalt', 0.15)
    for s in (-1, 1):  # the troughs: an iron rim round a recessed lava run either side of the steps
        x0, x1 = sorted((s * 6.2, s * 15.8))
        cbox(p, (x0, -12.95, 1.2), (x1, -11.6, 1.45), 'Kit.iron', 0.06)
        p.face([(x0 + 0.25, -12.7, 1.47), (x1 - 0.25, -12.7, 1.47), (x1 - 0.25, -11.85, 1.47), (x0 + 0.25, -11.85, 1.47)], 'Kit.lava')
        for k in range(5):  # spill lips down the plinth's face
            x = x0 + (k + 0.5) * (x1 - x0) / 5
            p.face([(x - 0.35, -13.02, 0.25), (x + 0.35, -13.02, 0.25), (x + 0.35, -13.02, 1.15), (x - 0.35, -13.02, 1.15)], 'Kit.lava')


def hall(p, rng):
    """The hall body, its coursed walls, corner pilasters, the clerestory step with its lit slits and the ribbed roof."""
    x0, y0, x1, y1 = HALL
    p.box((x0, y0, BASE), (x1, y1, EAVE), 'Kit.basalt')
    door = (-6.4, 6.4, BASE, 12.4)
    coursing(p, rng, 'x', y0, -1, x0 + 1.0, x1 - 1.0, BASE, EAVE - 0.6, skip=[door])
    coursing(p, rng, 'x', y1, 1, x0 + 1.0, x1 - 1.0, BASE, EAVE - 0.6)
    coursing(p, rng, 'y', x0, -1, y0 + 1.0, y1 - 1.0, BASE, EAVE - 0.6, skip=[(-6.0, 6.0, 4.0, 7.5)])
    coursing(p, rng, 'y', x1, 1, y0 + 1.0, y1 - 1.0, BASE, EAVE - 0.6, skip=[(-6.0, 6.0, 4.0, 7.5)])
    for x in (x0, x1):  # the corner pilasters and the cornice
        for y in (y0, y1):
            cbox(p, (x - 1.1, y - 1.1, BASE), (x + 1.1, y + 1.1, EAVE + 0.8), 'Kit.basalt', 0.18)
    cbox(p, (x0 - 0.5, y0 - 0.5, EAVE - 0.5), (x1 + 0.5, y1 + 0.5, EAVE + 0.2), 'Kit.iron', 0.1)
    cbox(p, (-11.0, -7.5, EAVE + 0.2), (11.0, 7.5, 15.6), 'Kit.basalt', 0.15)  # the clerestory step
    for y, s in ((-7.5, -1), (7.5, 1)):
        for k in range(8):
            x = -9.6 + k * 2.74
            p.face([(x - 0.35, y + s * 0.02, EAVE + 0.8), (x + 0.35, y + s * 0.02, EAVE + 0.8), (x + 0.35, y + s * 0.02, 15.0),
                    (x - 0.35, y + s * 0.02, 15.0)][::(1 if s < 0 else -1)], 'Kit.lava')
    ridge = 21.0
    for s in (-1, 1):  # the roof: two iron slabs, ribs down each, a ridge cap
        yl, ye = 0.0, s * 9.8
        corners = [(-12.2, ye, 15.4), (12.2, ye, 15.4), (12.2, yl, ridge), (-12.2, yl, ridge)]
        p.slab(corners if s < 0 else list(reversed(corners)), 0.35, 'Kit.iron')
        for k in range(17):
            x = -11.6 + k * 1.45
            for t0, t1 in ((0.0, 0.5), (0.5, 1.0)):
                ya, yb = ye + (yl - ye) * t0, ye + (yl - ye) * t1
                za, zb = 15.4 + (ridge - 15.4) * t0 + 0.12, 15.4 + (ridge - 15.4) * t1 + 0.12
                lo_y, hi_y = sorted((ya, yb))
                p.face([(x - 0.12, ya, za), (x + 0.12, ya, za), (x + 0.12, yb, zb), (x - 0.12, yb, zb)][::(1 if s < 0 else -1)], 'Kit.soot')
    cbox(p, (-12.6, -0.45, ridge - 0.2), (12.6, 0.45, ridge + 0.45), 'Kit.iron', 0.1)
    for x, s in ((-12.2, -1), (12.2, 1)):  # the gable ends, coursed basalt triangles
        tri = [(x, -9.8, 15.4), (x, 0.0, ridge), (x, 9.8, 15.4)]
        p.face(tri if s > 0 else list(reversed(tri)), 'Kit.basalt')


def front(p, rng):
    """The gabled front: a pediment over the door with the iron diamond emblem, the stepped arch, its glow and steps."""
    y = HALL[1]
    # the pediment, standing proud of the roof's front slope
    cbox(p, (-8.2, y - 1.4, EAVE - 0.6), (8.2, y + 0.6, EAVE + 1.0), 'Kit.basalt', 0.15)
    tri = [(-8.0, y - 1.2, EAVE + 1.0), (8.0, y - 1.2, EAVE + 1.0), (0.0, y - 1.2, EAVE + 6.4)]
    p.face(tri, 'Kit.basalt')
    p.face([(-8.0, y - 1.2, EAVE + 1.0), (0.0, y - 1.2, EAVE + 6.4), (0.0, y + 2.0, EAVE + 6.4), (-8.0, y + 2.0, EAVE + 1.0)], 'Kit.iron')
    p.face([(0.0, y - 1.2, EAVE + 6.4), (8.0, y - 1.2, EAVE + 1.0), (8.0, y + 2.0, EAVE + 1.0), (0.0, y + 2.0, EAVE + 6.4)], 'Kit.iron')
    # the emblem: an iron diamond with a lit diamond inset
    for r, slot, d in ((2.0, 'Kit.iron', 1.45), (1.1, 'Kit.lava', 1.62)):
        c = EAVE + 3.0
        dia = [(0.0, y - d, c - r), (r, y - d, c), (0.0, y - d, c + r), (-r, y - d, c)]
        p.face(dia[::-1], slot)
        if slot == 'Kit.iron':
            for i in range(4):
                a, b = dia[i], dia[(i + 1) % 4]
                p.face([a, b, (b[0], y - 1.2, b[2]), (a[0], y - 1.2, a[2])], slot)
    # the stepped arch: three concentric frames, each proud of the last, over the glowing opening
    w, spring, steps = 4.2, 8.0, 12
    for k, (grow, depth, slot) in enumerate(((2.0, 1.5, 'Kit.basalt'), (1.2, 1.1, 'Kit.stone'), (0.5, 0.7, 'Kit.iron'))):
        outer, inner = w + grow, w + grow - 0.7
        dy = y - depth
        arc = lambda r: [(r * math.cos(math.pi * i / steps), spring + r * 0.75 * math.sin(math.pi * i / steps)) for i in range(steps + 1)]
        o, n = arc(outer), arc(inner)
        for i in range(steps):
            q = [(n[i][0], dy, n[i][1]), (o[i][0], dy, o[i][1]), (o[i + 1][0], dy, o[i + 1][1]), (n[i + 1][0], dy, n[i + 1][1])]
            p.face(q[::-1], slot)
            p.face([(o[i][0], dy, o[i][1]), (o[i + 1][0], dy, o[i + 1][1]), (o[i + 1][0], y, o[i + 1][1]), (o[i][0], y, o[i][1])][::-1], slot)
        for s in (-1, 1):  # the jambs
            xa, xb = sorted((s * inner, s * outer))
            cbox(p, (xa, dy, BASE), (xb, y, spring), slot, 0.08)
    cbox(p, (-0.9, y - 1.9, spring + (w + 2.0) * 0.75 - 0.6), (0.9, y - 1.3, spring + (w + 2.0) * 0.75 + 1.4), 'Kit.lava', 0.06)
    glow = [(-w, y - 0.15, BASE)] + [(w * math.cos(math.pi * (steps - i) / steps), y - 0.15, spring + w * 0.75 * math.sin(math.pi * (steps - i) / steps))
                                     for i in range(steps + 1)] + [(w, y - 0.15, BASE)]
    p.face(glow[::-1], 'Kit.lava')
    for k in range(4):  # the iron grate bars across the glow
        x = -w + (k + 1) * 2 * w / 5
        cbox(p, (x - 0.12, y - 0.45, BASE), (x + 0.12, y - 0.15, spring + w * 0.75 * math.sqrt(max(0.0, 1 - (x / w) ** 2)) - 0.2), 'Kit.iron', 0.03)
    for k in range(4):  # the steps up to the door
        cbox(p, (-w - 2.4 + k * 0.5, -13.0 + k * 0.6, 0.0), (w + 2.4 - k * 0.5, y - 1.5, 0.6 * (k + 1)), 'Kit.basalt', 0.08)
    for s in (-1, 1):  # blue lamps flanking the door on iron brackets
        x = s * (w + 3.0)
        cbox(p, (x - 0.15, y - 2.2, 7.0), (x + 0.15, y - 1.5, 7.3), 'Kit.iron', 0.04)
        cbox(p, (x - 0.35, y - 2.55, 5.9), (x + 0.35, y - 1.85, 7.0), 'Kit.blue', 0.06)
        p.prism(x, y - 2.2, 0.5, 0.08, 7.0, 7.5, 4, 'Kit.iron', spin=0.785398)


def buttresses(p):
    """Stepped chamfered buttresses down the long sides, each capped in iron with a cold blue lamp on its face."""
    for x in (-7.0, 0.0, 7.0):
        for y, s in ((HALL[1], -1), (HALL[3], 1)):
            if s < 0 and x == 0.0:
                continue  # the door
            for lo, hi, top in ((2.6, 0.0, 8.0), (1.6, 0.0, 11.4)):
                ya, yb = sorted((y + s * hi, y + s * lo))
                cbox(p, (x - 1.0, ya, BASE), (x + 1.0, yb, top), 'Kit.basalt', 0.14)
            ya, yb = sorted((y, y + s * 1.8))
            cbox(p, (x - 1.15, ya, 11.4), (x + 1.15, yb, 11.8), 'Kit.iron', 0.06)
            ly = y + s * 2.65
            cbox(p, (x - 0.32, ly - 0.2, 6.4), (x + 0.32, ly + 0.2, 7.4), 'Kit.blue', 0.05)
            p.prism(x, ly, 0.45, 0.06, 7.4, 7.85, 4, 'Kit.iron', spin=0.785398)


def stacks(p):
    """Four round furnace stacks along the ridge: a flared foot, iron-banded shaft, a crown and a recessed glowing mouth."""
    for x, top in ((-8.0, 33.0), (-2.7, 35.0), (2.7, 34.0), (8.0, 32.0)):
        r = 1.55
        profile = [(r + 0.5, 15.0), (r + 0.5, 17.0), (r, 18.0)]
        z = 18.0
        while z < top - 3.2:
            profile += [(r, z + 2.2), (r + 0.18, z + 2.2), (r + 0.18, z + 2.6), (r, z + 2.6)]
            z += 2.6
        profile += [(r, top - 2.4), (r + 0.4, top - 1.6), (r + 0.4, top), (r - 0.25, top), (r - 0.25, top - 0.6)]
        slots = ['Kit.basalt'] * (len(profile) - 6) + ['Kit.iron', 'Kit.soot', 'Kit.soot', 'Kit.soot', 'Kit.lava']
        p.lathe(x, 0.0, profile, 20, slots, cap_top=True)
        for s in (-1, 1):  # a glowing vent either side
            p.face([(x - 0.4, s * (r + 0.02), top - 4.6), (x + 0.4, s * (r + 0.02), top - 4.6), (x + 0.4, s * (r + 0.02), top - 3.6),
                    (x - 0.4, s * (r + 0.02), top - 3.6)][::(-1 if s > 0 else 1)], 'Kit.lava')


def annexes(p, rng):
    """Low annex wings either side: coursed walls, a lean-to iron roof, two lit windows each, a squat stack."""
    for s in (-1, 1):
        x0, x1 = sorted((s * 13.0, s * 17.5))
        p.box((x0, -6.5, BASE), (x1, 6.5, 8.5), 'Kit.basalt')
        far = x1 if s > 0 else x0
        coursing(p, rng, 'y', far, s, -6.0, 6.0, BASE, 8.0, skip=[(-4.4, -1.6, 4.0, 6.6), (1.6, 4.4, 4.0, 6.6)])
        coursing(p, rng, 'x', -6.5, -1, x0 + 0.3, x1 - 0.3, BASE, 8.0)
        for wy in (-3.0, 3.0):
            xf = far + s * 0.12
            pts = [(xf, wy - 1.2, 4.2), (xf, wy + 1.2, 4.2), (xf, wy + 1.2, 6.4), (xf, wy - 1.2, 6.4)]
            p.face(pts if s > 0 else pts[::-1], 'Kit.lava')
            cbox(p, (min(xf, xf + s * 0.3), wy - 1.4, 4.0), (max(xf, xf + s * 0.3), wy + 1.4, 4.25), 'Kit.iron', 0.04)
        near = x0 if s > 0 else x1
        corners = [(near, -7.2, 9.6), (far + s * 0.7, -7.2, 8.0), (far + s * 0.7, 7.2, 8.0), (near, 7.2, 9.6)]
        p.slab(corners if s > 0 else corners[::-1], 0.3, 'Kit.iron')
        cx = (x0 + x1) / 2
        p.lathe(cx, 4.0, [(0.9, 8.4), (0.9, 12.5), (1.1, 12.5), (1.1, 13.0), (0.7, 13.0), (0.7, 12.7)],
                10, ['Kit.basalt', 'Kit.iron', 'Kit.soot', 'Kit.soot', 'Kit.lava'])


def cranes(p):
    """A crane at each front corner: a lattice mast, its boom out over the trough, a chain and a glowing crucible."""
    for s in (-1, 1):
        mx, my = s * 15.8, -9.6
        for dx in (-0.4, 0.4):
            for dy in (-0.4, 0.4):
                cbox(p, (mx + dx - 0.12, my + dy - 0.12, BASE), (mx + dx + 0.12, my + dy + 0.12, 16.5), 'Kit.iron', 0.03)
        for k in range(7):  # cross-bracing
            z = BASE + 0.8 + k * 2.0
            cbox(p, (mx - 0.5, my - 0.5, z), (mx + 0.5, my + 0.5, z + 0.16), 'Kit.iron', 0.03)
        cbox(p, (mx - 0.7, my - 0.7, 16.5), (mx + 0.7, my + 0.7, 17.1), 'Kit.iron', 0.06)
        bx = mx - s * 0.0
        cbox(p, (bx - 0.22, my - 6.5, 16.6), (bx + 0.22, my + 1.8, 17.0), 'Kit.iron', 0.05)  # the boom, out to the front
        cbox(p, (bx - 0.35, my + 1.4, 15.8), (bx + 0.35, my + 2.2, 16.6), 'Kit.basalt', 0.06)  # its counterweight
        hy = my - 5.8
        for k in range(14):  # the chain: alternating links
            z = 16.5 - (k + 1) * 0.55
            if k % 2 == 0:
                cbox(p, (bx - 0.05, hy - 0.16, z), (bx + 0.05, hy + 0.16, z + 0.5), 'Kit.iron', 0.02)
            else:
                cbox(p, (bx - 0.16, hy - 0.05, z), (bx + 0.16, hy + 0.05, z + 0.5), 'Kit.iron', 0.02)
        cz = 16.5 - 15 * 0.55
        p.lathe(bx, hy, [(0.35, cz - 1.6), (0.85, cz - 1.3), (1.0, cz - 0.5), (1.05, cz), (0.85, cz), (0.85, cz - 0.15)],
                10, ['Kit.iron', 'Kit.iron', 'Kit.iron', 'Kit.iron', 'Kit.lava'], cap_bottom=True)


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(SEED)
    p = Piece()
    plinth(p, rng)
    hall(p, rng)
    front(p, rng)
    buttresses(p)
    stacks(p)
    annexes(p, rng)
    cranes(p)
    near = finish(p, 'furnace', random.Random(SEED + 1), SWATCHES)
    top = max(v.co.z for v in near.data.vertices)
    for v in near.data.vertices:
        v.co *= HEIGHT / top
    image = atlas_image(SWATCHES, 'furnace-atlas')
    print(f'furnace near: {triangles(near)} triangles')
    export(near, image, os.path.join(out, 'landmark.glb'))
    far = far_copy(near, 2400)
    print(f'furnace far: {triangles(far)} triangles')
    export(far, image, os.path.join(out, 'landmark-far.glb'))


if __name__ == '__main__':
    main()
