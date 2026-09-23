"""
build_island.py — the Blender island, spawn cove first (DRIFTWOOD-REMASTER X2, E52). Run by scripts/blender/run.sh:

    blender -b --factory-startup -P scripts/blender/build_island.py -- <cache dir> <out dir> [--quick]

Input (<cache>, written by scripts/blender/export-scene.mjs from the game's own code): the area grid (height, the game's
ground colour, slope, trail distance), the whole chunk's coarse heights, the layout specs and the kept structures.

What it builds, all from code (scripts/blender/assets.py):
- the terrain of the area on a grid twice as fine as the game's, on exactly the heights the player walks, with a
  planar lightmap UV;
- prototypes: 8 palms, faceted rocks (icosphere + noise + plane cuts), ferns, hibiscus, bushes, flowers, grass tufts,
  beach grass, shells, starfish, pebbles, driftwood logs;
- the placements: the game's own palms and shore boulders in the area (same spots, the Blender models), extra palms along
  the back beach, rock outcrops over the crag faces, and the ground-cover scatter by height / slope / path rules.

Then GLOBAL ILLUMINATION + AO in Cycles (Metal GPU):
- terrain: an AO lightmap (sky visibility, 5 m) and a sun-bounce lightmap (indirect diffuse only, the sun at the
  midday reference, strength 1) over the whole scene — palms, rocks, scatter, the pier and the hut all occlude and bounce;
- prototypes: self + ground-contact AO into the vertex colour's alpha.
In the game the AO multiplies the (day/night-driven) hemisphere fill, the bounce is added scaled by the live sun, and the
direct sun stays dynamic (toon ramp + CSM shadows) — see src/world/BlenderIsland.ts.

Output (<out>): island.glb (terrain tiles + prototypes, no materials), placements.bin, island.json, lm-ao.png,
lm-bounce.png (run.sh converts / compresses them into public/assets/models/driftwood-blender/).
"""
import bpy
import bmesh
import json
import math
import os
import random
import struct
import sys
import time

import numpy as np
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import assets as A  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
CACHE, OUT = argv[0], argv[1]
QUICK = '--quick' in argv
os.makedirs(OUT, exist_ok=True)
T0 = time.time()


def log(*a):
    print(f'[island {time.time() - T0:6.1f}s]', *a, flush=True)


# game (x, y up, z) → Blender (x, −z, y)
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
Ci = C.inverted()

# ── input ────────────────────────────────────────────────────────────────────────────────────────────────────────────
S = json.load(open(f'{CACHE}/scene.json'))
AR = S['area']
NX, NZ, ST = AR['nx'], AR['nz'], AR['step']
X0, Z0, X1, Z1 = AR['x0'], AR['z0'], AR['x1'], AR['z1']
SEA = S['sea']
grid = np.fromfile(f'{CACHE}/area.bin', dtype=np.float32).reshape(NZ, NX, 6)
GH, GCOL, GSL, GTD = grid[..., 0], grid[..., 1:4], grid[..., 4], grid[..., 5]
CRES = S['chunk']['res']; CSIZE = S['chunk']['size']
ctx = np.fromfile(f'{CACHE}/context.bin', dtype=np.float32).reshape(CRES, CRES)


def bilinear(arr, x, z):
    """sample an area-grid array at world (x, z) (arrays or scalars)"""
    u = np.clip((np.asarray(x) - X0) / ST, 0, NX - 1.0001); v = np.clip((np.asarray(z) - Z0) / ST, 0, NZ - 1.0001)
    i = np.floor(u).astype(int); j = np.floor(v).astype(int); fu = u - i; fv = v - j
    a = arr[j, i] * (1 - fu) + arr[j, i + 1] * fu
    b = arr[j + 1, i] * (1 - fu) + arr[j + 1, i + 1] * fu
    return a * (1 - fv) + b * fv


def height(x, z):
    return float(bilinear(GH, x, z))


def normal(x, z, e=0.6):
    hl, hr, hd, hu = height(x - e, z), height(x + e, z), height(x, z - e), height(x, z + e)
    n = Vector((hl - hr, 2 * e, hd - hu)).normalized()
    return n  # game space


def in_area(x, z, m=0.0):
    return X0 + m < x < X1 - m and Z0 + m < z < Z1 - m


# ── scene reset + render setup ───────────────────────────────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == 'METAL'
scene.cycles.device = 'GPU'
scene.cycles.samples = 24 if QUICK else 192
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 4
scene.cycles.diffuse_bounces = 3
scene.cycles.glossy_bounces = 0
scene.cycles.transmission_bounces = 0
scene.cycles.transparent_max_bounces = 2
world = bpy.data.worlds.new('World'); scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)


def col_material(name, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 1.0
    bsdf.inputs['Specular IOR Level'].default_value = 0.0
    attr = nt.nodes.new('ShaderNodeAttribute'); attr.attribute_name = 'Col'
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    if image is not None:
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = image; tex.name = 'BAKE'
        nt.nodes.active = tex
    return m


MAT_COL = col_material('col')


def make_mesh(name, verts, tris, cols=None, uv=None, mat=MAT_COL, link=True):
    """verts (N,3) Blender space, tris (M,3) int, cols (N,3|4) linear, uv (N,2)"""
    me = bpy.data.meshes.new(name)
    n, m = len(verts), len(tris)
    me.vertices.add(n); me.vertices.foreach_set('co', np.ascontiguousarray(verts, dtype=np.float32).ravel())
    me.loops.add(m * 3); me.loops.foreach_set('vertex_index', np.ascontiguousarray(tris, dtype=np.int32).ravel())
    me.polygons.add(m); me.polygons.foreach_set('loop_start', np.arange(0, m * 3, 3, dtype=np.int32))
    me.update(calc_edges=True)
    if cols is not None:
        c4 = np.ones((n, 4), np.float32); c4[:, :cols.shape[1]] = cols
        a = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); a.data.foreach_set('color', c4.ravel())
        me.color_attributes.active_color = a; me.color_attributes.render_color_index = 0
    if uv is not None:
        u = me.uv_layers.new(name='LM'); u.data.foreach_set('uv', np.ascontiguousarray(uv[np.asarray(tris).ravel()], dtype=np.float32).ravel())
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    if link:
        scene.collection.objects.link(ob)
    return ob


def part_arrays(part):
    v = np.array([tuple(p) for p in part.verts], np.float32)
    c = np.array(part.cols, np.float32)
    t = np.array(part.tris, np.int32)
    return v, c, t


# ── 1. terrain ───────────────────────────────────────────────────────────────────────────────────────────────────────
log(f'terrain {NX}x{NZ} @ {ST:.3f} m')
rng = np.random.default_rng(0x5ea1)
ix, iz = np.meshgrid(np.arange(NX), np.arange(NZ))
gx = X0 + ix * ST; gz = Z0 + iz * ST
# interior vertices jitter (natural facets, not a grid); edge vertices stay on the procedural grid's lines
jit = rng.uniform(-0.3, 0.3, (NZ, NX, 2)) * ST
edge = (ix == 0) | (iz == 0) | (ix == NX - 1) | (iz == NZ - 1)
jit[edge] = 0
tx = gx + jit[..., 0]; tz = gz + jit[..., 1]
ty = bilinear(GH, tx, tz)
tcol = np.stack([bilinear(GCOL[..., k], tx, tz) for k in range(3)], -1)
th = ty - SEA
tsl = bilinear(GSL, tx, tz)
# Blender-side paint over the game's palette: broad tone patches, a warmer dry-sand crest, darker grass in folds
def fbm_np(x, z, f, seed):
    from mathutils import noise
    out = np.empty(x.shape, np.float32)
    fx = (x * f + seed).ravel(); fz = (z * f - seed).ravel(); o = out.ravel()
    for k in range(o.size):
        o[k] = noise.fractal(Vector((fx[k], fz[k], 0.5)), 1.0, 2.0, 3)
    return out
patch = fbm_np(tx, tz, 0.035, 11.3)
fine = fbm_np(tx, tz, 0.21, 3.7)
sand = (th > 0.5) & (th < 3.0) & (tsl < 0.3)
grassm = (th > 3.2) & (tsl < 0.3)
k = 1 + 0.05 * patch + 0.025 * fine
k[grassm] = 1 + 0.12 * patch[grassm] + 0.05 * fine[grassm]
tcol = tcol * k[..., None]
tcol[sand] = tcol[sand] * np.array([1.0, 0.985, 0.95]) ** (np.clip(patch[sand], -1, 1)[:, None] * 2)
verts_b = np.stack([tx, -tz, ty], -1).reshape(-1, 3)
uv = np.stack([(tx - X0) / (X1 - X0), (tz - Z0) / (Z1 - Z0)], -1).reshape(-1, 2)
TILES = (2, 2)
terrain_obs = []
lm_ao = bpy.data.images.new('lm_ao', 2048, 2048, alpha=False, float_buffer=True); lm_ao.colorspace_settings.name = 'Non-Color'
lm_bounce = bpy.data.images.new('lm_bounce', 1024, 1024, alpha=False, float_buffer=True); lm_bounce.colorspace_settings.name = 'Non-Color'
MAT_TERRAIN = col_material('terrain', lm_ao)


def cell_tris(i0, i1, j0, j1):
    t = []
    for j in range(j0, j1):
        for i in range(i0, i1):
            a = j * NX + i; b = a + 1; c = a + NX; d = c + 1
            # alternate the diagonal; winding up in Blender (−z → +Y flips it)
            if (i + j) & 1:
                t += [(a, d, c), (a, b, d)]
            else:
                t += [(a, b, c), (b, d, c)]
    return np.array(t, np.int32)


for ty_ in range(TILES[1]):
    for tx_ in range(TILES[0]):
        i0 = (NX - 1) * tx_ // TILES[0]; i1 = (NX - 1) * (tx_ + 1) // TILES[0]
        j0 = (NZ - 1) * ty_ // TILES[1]; j1 = (NZ - 1) * (ty_ + 1) // TILES[1]
        tris = cell_tris(i0, i1, j0, j1)
        used = np.unique(tris)
        remap = -np.ones(NX * NZ, np.int64); remap[used] = np.arange(len(used))
        ob = make_mesh(f'terrain_{tx_}_{ty_}', verts_b[used], remap[tris], tcol.reshape(-1, 3)[used], uv[used], MAT_TERRAIN)
        terrain_obs.append(ob)
# check the winding once: the first face must look up
me0 = terrain_obs[0].data
if me0.polygons[0].normal.z < 0:
    for ob in terrain_obs:
        ob.data.flip_normals()
log('terrain tris', sum(len(o.data.polygons) for o in terrain_obs))

# the rest of the chunk, coarse, for the bake only (occludes the sky near the area's edges, bounces light in)
cd = CSIZE / (CRES - 1)
cx, cz = np.meshgrid(np.arange(CRES), np.arange(CRES))
cverts = np.stack([-CSIZE / 2 + cx * cd, -(-CSIZE / 2 + cz * cd), ctx], -1).reshape(-1, 3)
ch = ctx.reshape(-1) - SEA
ccol = np.where(ch[:, None] < 0, A.srgb('#15a0b4'), np.where(ch[:, None] < 3.0, A.srgb('#ffd98c'), A.srgb('#6cae47'))).astype(np.float32)
ctris = []
for j in range(CRES - 1):
    for i in range(CRES - 1):
        if 71 <= i < 184 and 18 <= j < 117:
            continue  # the area's own cells
        a = j * CRES + i
        ctris += [(a, a + 1, a + CRES), (a + 1, a + CRES + 1, a + CRES)]
ctx_ob = make_mesh('context', cverts, np.array(ctris), ccol)
if ctx_ob.data.polygons[0].normal.z < 0:
    ctx_ob.data.flip_normals()

# the kept structures (pier, hut, trailside): occluders + bounce
raw = np.fromfile(f'{CACHE}/structures.bin', dtype=np.float32)
ntri = int(raw[:1].view(np.uint32)[0])
sp = raw[1:1 + ntri * 9].reshape(-1, 3); sc = raw[1 + ntri * 9:1 + ntri * 18].reshape(-1, 3)
make_mesh('structures', np.stack([sp[:, 0], -sp[:, 2], sp[:, 1]], -1), np.arange(ntri * 3).reshape(-1, 3), sc)

# ── 2. prototypes ────────────────────────────────────────────────────────────────────────────────────────────────────
log('prototypes')
R = random.Random(0xB1E4D)
PROTOS = []  # (name, Part, kind)


def proto(name, part, kind):
    PROTOS.append((name, part, kind))
    return len(PROTOS) - 1


PALM_V = []
for i, (h, lean) in enumerate([(6.0, 0.1), (7.0, 0.25), (8.0, 0.15), (9.0, 0.3), (6.5, 0.35), (7.5, 0.05), (8.5, 0.22), (9.5, 0.12)]):
    PALM_V.append((proto(f'palm{i}', A.palm(R, h, lean, fronds=R.randint(11, 14), young=R.randint(6, 8)), 'palm'), h, lean))
ROCK_V = [proto(f'rock{i}', A.rock(R, 1.0, squash=R.uniform(0.55, 0.85), cuts=R.randint(5, 8), moss=0.0), 'rock') for i in range(6)]
# crag plates: wide flat faceted slabs laid onto the cliff face (tilted fully to its normal), overlapping like strata
CLIFF_V = [proto(f'cliff{i}', A.rock(R, 1.0, squash=R.uniform(0.3, 0.42), cuts=R.randint(5, 7), moss=0.0), 'rock') for i in range(6)]
KIND = {
    'shell': [proto(f'shell{i}', A.shell(R), 'small') for i in range(4)],
    'star': [proto(f'star{i}', A.starfish(R), 'small') for i in range(3)],
    'pebble': [proto(f'pebble{i}', A.pebbles(R), 'small') for i in range(4)],
    'drift': [proto(f'drift{i}', A.driftwood(R, L), 'prop') for i, L in enumerate((2.2, 2.8, 3.4, 4.0))],
    'beachgrass': [proto(f'beachgrass{i}', A.beach_grass(R), 'plant') for i in range(3)],
    'tuft': [proto(f'tuft{i}', A.grass_tuft(R, n=7), 'plant') for i in range(4)],
    'fern': [proto(f'fern{i}', A.fern(R, R.uniform(0.7, 0.95), fronds=6, seg=4), 'plant') for i in range(3)],
    'hibiscus': [proto(f'hibiscus{i}', A.hibiscus_clump(R), 'plant') for i in range(3)],
    'yellow': [proto(f'yellow{i}', A.flower_clump(R, 'yellow'), 'plant') for i in range(2)],
    'white': [proto(f'white{i}', A.flower_clump(R, 'white'), 'plant') for i in range(2)],
    'bush': [proto(f'bush{i}', A.bush(R, R.uniform(0.7, 1.0), flowers=0), 'plant') for i in range(3)],
    'flowerbush': [proto(f'flowerbush{i}', A.bush(R, R.uniform(0.7, 0.9), flowers=R.randint(5, 8)), 'plant') for i in range(2)],
    'smallrock': [proto(f'smallrock{i}', A.small_rock(R), 'prop') for i in range(3)],
}
log('protos', len(PROTOS), 'tris', sum(len(p.tris) for _, p, _ in PROTOS))

# ── 3. placements (game space) ───────────────────────────────────────────────────────────────────────────────────────
PL = []  # (proto, x, y, z, quat(x,y,z,w) game, scale, tint, rank)
COLLIDERS = []


def place(pi, x, z, yaw=None, s=1.0, tilt=None, y=None, sink=0.0, tint=None, rank=None, rng=R):
    yaw = rng.uniform(0, math.tau) if yaw is None else yaw
    q = Quaternion((0, 1, 0), yaw)
    if tilt is not None:  # align the up axis toward a (game-space) normal by `tilt`
        n = Vector(tilt[0]); amt = tilt[1]
        up = Vector((0, 1, 0)).lerp(n, amt).normalized()
        q = Vector((0, 1, 0)).rotation_difference(up) @ q
    y = height(x, z) - sink if y is None else y
    PL.append((pi, x, y, z, q, s, 1 - 0.1 + rng.random() * 0.2 if tint is None else tint, rng.random() if rank is None else rank))


# avoid zones: the hut, the signposts, the pier deck, fences, steps
TS = S['trailside']
FENCES = [f['path'] for f in (TS['fences'] or [])]
STEPS = TS['steps'] or []
SIGNS = TS['signs'] or []
HUT = S['hut']


def seg_dist(px, pz, a, b):
    ax, az = a; bx, bz = b
    dx, dz = bx - ax, bz - az
    L = dx * dx + dz * dz
    t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / L))
    return math.hypot(px - ax - t * dx, pz - az - t * dz)


def blocked(x, z, r=0.0):
    if math.hypot(x - HUT['x'], z - HUT['z']) < 11 + r:
        return True
    if abs(x) < 3.4 + r and z < -146:  # under / beside the pier and its landing
        return True
    for s in SIGNS:
        if math.hypot(x - s['x'], z - s['z']) < 1.0 + r:
            return True
    for st in STEPS:
        if seg_dist(x, z, st['from'], st['to']) < (st.get('width') or 2.4) / 2 + 0.8 + r:
            return True
    for f in FENCES:
        for a, b in zip(f, f[1:]):
            if seg_dist(x, z, a, b) < 0.7 + r:
                return True
    return False


def field(x, z):
    h = height(x, z) - SEA
    return h, float(bilinear(GSL, x, z)), float(bilinear(GTD, x, z))


# (a) the game's palms in the area → the Blender palms, same spot / height / lean
palms_here = [p for p in S['palms'] if in_area(p['x'], p['z'], 1.0)]
extra_palms = []
tries = 0
prng = random.Random(0x9a1e)
while len(extra_palms) < 24 and tries < 20000:
    tries += 1
    x = prng.uniform(X0 + 4, X1 - 4); z = prng.uniform(Z0 + 4, Z1 - 4)
    h, sl, td = field(x, z)
    if h < 1.5 or sl > 0.12 or td < 4.5 or blocked(x, z, 2.5):
        continue
    backbeach = 1.5 < h < 4.2
    if not backbeach and prng.random() > 0.25:
        continue
    if any(math.hypot(p['x'] - x, p['z'] - z) < 4.2 for p in palms_here + extra_palms):
        continue
    extra_palms.append({'x': x, 'z': z, 'h': prng.uniform(5.5, 9.5), 'lean': prng.uniform(0.05, 0.35), 'leanDir': prng.uniform(0, math.tau), 'rot': prng.uniform(0, math.tau), 'extra': True})
PALM_PLACES = []
for p in palms_here + extra_palms:
    v = min(PALM_V, key=lambda t: abs(t[1] - p['h']) / 4 + abs(t[2] - p['lean']))
    s = p['h'] / v[1]
    base = height(p['x'], p['z']) - 0.2
    # the prototype leans along +X (Blender) = +x (game); the game's lean is toward (cos leanDir, sin leanDir) in xz
    place(v[0], p['x'], p['z'], yaw=-p['leanDir'], s=s, y=base, tint=1.0, rank=0)
    PALM_PLACES.append((p['x'], p['z']))
    if p.get('extra'):
        COLLIDERS.append({'x': p['x'], 'z': p['z'], 'hw': 0.3, 'hd': 0.3, 'rot': 0, 'yTop': base + p['h'], 'yBottom': base - 1})
log(f'palms: {len(palms_here)} game + {len(extra_palms)} extra')

# (b) the game's shore boulders in the area → Blender rocks (the game keeps their colliders)
for b in S['rocks']:
    if not in_area(b['x'], b['z'], 1.0):
        continue
    n = normal(b['x'], b['z'], 1.5)
    place(R.choice(ROCK_V), b['x'], b['z'], yaw=b['rot'], s=b['r'] * 1.2, tilt=(n, 0.5), tint=1.0, rank=0)

# (c) rock outcrops over the crag faces, a grass / bush lip on their rims
steep = GSL > 0.34
near_cliff = steep.copy()
for _ in range(4):  # dilate ~4 cells (≈ 4 m)
    near_cliff[1:, :] |= near_cliff[:-1, :]; near_cliff[:-1, :] |= near_cliff[1:, :]
    near_cliff[:, 1:] |= near_cliff[:, :-1]; near_cliff[:, :-1] |= near_cliff[:, 1:]
crng = random.Random(0xC11F)
cliff_n = 0
for j in range(0, NZ, 2):
    for i in range(0, NX, 2):
        if not steep[j, i]:
            continue
        x = X0 + i * ST + crng.uniform(-0.9, 0.9); z = Z0 + j * ST + crng.uniform(-0.9, 0.9)
        h, sl, td = field(x, z)
        if h < 0.6 or td < 4.0 or blocked(x, z, 1.5) or crng.random() > 0.45:
            continue
        n = normal(x, z, 1.2)
        size = crng.uniform(2.8, 4.8)
        place(crng.choice(CLIFF_V), x, z, s=size, tilt=(n, 1.0), sink=size * 0.12, tint=1.0, rank=0, rng=crng)
        cliff_n += 1
        if sl < 0.75:  # reachable: a collider (an oriented box a little inside the rock)
            COLLIDERS.append({'x': x, 'z': z, 'hw': size * 0.35, 'hd': size * 0.35, 'rot': 0, 'yTop': height(x, z) + size * 0.3, 'yBottom': height(x, z) - 3})
log('cliff rocks', cliff_n)

# (d) ground cover by rules, vectorised: density per m² from (h over the sea, slope, trail distance, near a cliff,
# distance to a palm); candidates are one jittered point per 1 m cell per kind
from mathutils.kdtree import KDTree
kd = KDTree(max(1, len(PALM_PLACES)))
for k_, (px, pz) in enumerate(PALM_PLACES):
    kd.insert((px, pz, 0), k_)
kd.balance()
W = lambda c, a, b: ((c > a) & (c < b)).astype(np.float32)
RULES = [
    # kind, density(h, sl, td, cliff, palm_d), scale range, tilt toward the ground normal, sink (× scale)
    ('shell', lambda h, sl, td, c, pd: 0.05 * W(h, 0.05, 2.6) * (sl < 0.3), (0.9, 1.4), 0.9, 0.0),
    ('star', lambda h, sl, td, c, pd: 0.018 * W(h, 0.1, 2.4) * (sl < 0.3), (0.9, 1.3), 0.9, 0.0),
    ('pebble', lambda h, sl, td, c, pd: (0.03 * W(h, 0.0, 2.8) * (sl < 0.35) + 0.012 * (h > 3) * (sl < 0.3)), (0.8, 1.5), 0.8, 0.02),
    ('drift', lambda h, sl, td, c, pd: 0.02 * W(h, 1.4, 2.9) * (sl < 0.2) * (td > 3), (0.85, 1.15), 0.9, 0.05),
    ('beachgrass', lambda h, sl, td, c, pd: (0.09 * W(h, 2.0, 3.3) + 0.025 * W(h, 1.3, 2.0)) * (sl < 0.3), (0.8, 1.3), 0.3, 0.02),
    ('tuft', lambda h, sl, td, c, pd: 0.32 * (h > 3.0) * (sl < 0.3), (0.8, 1.4), 0.5, 0.02),
    ('fern', lambda h, sl, td, c, pd: (0.12 * W(h, 2.7, 4.2) + 0.03 * (h > 4.2) + 0.2 * c * (h > 3) + 0.25 * (pd < 2.8) * (h > 1.8)) * (sl < 0.34), (0.8, 1.4), 0.3, 0.02),
    ('hibiscus', lambda h, sl, td, c, pd: (0.06 * W(h, 2.7, 4.2) + 0.008 * (h > 4.2) + 0.08 * (pd < 2.8) * (h > 1.8)) * (sl < 0.3), (0.9, 1.4), 0.2, 0.02),
    ('yellow', lambda h, sl, td, c, pd: (0.06 * W(h, 2.8, 4.5) + 0.025 * (h > 4.5)) * (sl < 0.3), (0.9, 1.3), 0.3, 0.0),
    ('white', lambda h, sl, td, c, pd: 0.03 * (h > 3.4) * (sl < 0.3), (0.9, 1.3), 0.3, 0.0),
    ('bush', lambda h, sl, td, c, pd: (0.035 * W(h, 2.8, 4.5) + 0.012 * (h > 4.5) + 0.12 * c * (h > 3)) * (sl < 0.36), (0.8, 1.4), 0.25, 0.1),
    ('flowerbush', lambda h, sl, td, c, pd: (0.02 * W(h, 2.8, 4.5) + 0.004 * (h > 4.5) + 0.04 * c * (h > 3)) * (sl < 0.34), (0.8, 1.3), 0.25, 0.1),
    ('smallrock', lambda h, sl, td, c, pd: 0.006 * (h > 0.2) + 0.05 * c * (h > 0.5), (0.7, 1.6), 0.6, 0.1),
]
srng = random.Random(0x5CA7)
nrng = np.random.default_rng(0x5CA7)
counts = {}
ci, cj = np.meshgrid(np.arange(int(X1 - X0)), np.arange(int(Z1 - Z0)))
ci = ci.ravel(); cj = cj.ravel()
for kname, dens, (s0, s1), tilt, sink in RULES:
    n0 = len(PL)
    x = X0 + ci + nrng.random(ci.size); z = Z0 + cj + nrng.random(ci.size)
    ok = (x > X0 + 0.8) & (x < X1 - 0.8) & (z > Z0 + 0.8) & (z < Z1 - 0.8)
    x, z = x[ok], z[ok]
    h = bilinear(GH, x, z) - SEA; sl = bilinear(GSL, x, z); td = bilinear(GTD, x, z)
    c = near_cliff[np.clip(np.round((z - Z0) / ST).astype(int), 0, NZ - 1), np.clip(np.round((x - X0) / ST).astype(int), 0, NX - 1)].astype(np.float32)
    pd = np.array([kd.find((a, b, 0))[2] if hh > 1.5 and PALM_PLACES else 99.0 for a, b, hh in zip(x, z, h)], np.float32)
    d = dens(h, sl, td, c, pd)
    keep = (nrng.random(x.size) < d) & (td >= (1.6 if kname in ('shell', 'star', 'pebble') else 2.4))
    for a, b in zip(x[keep], z[keep]):
        a, b = float(a), float(b)
        if blocked(a, b, 0.3):
            continue
        s = srng.uniform(s0, s1)
        place(srng.choice(KIND[kname]), a, b, s=s, tilt=(normal(a, b), tilt), sink=sink * s, rng=srng)
    counts[kname] = len(PL) - n0
log('scatter', counts, 'total placements', len(PL))

# ── 4. realise everything into the bake scene ────────────────────────────────────────────────────────────────────────
proto_arr = [part_arrays(p) for _, p, _ in PROTOS]


def game_matrix(x, y, z, q, s):
    return Matrix.Translation((x, y, z)) @ q.to_matrix().to_4x4() @ Matrix.Scale(s, 4)


# prototypes are authored in Blender space; a game-space instance matrix M acts on the glTF (game-space) copy, so in
# Blender the same instance is C · M · C⁻¹ acting on the Blender-space prototype
allv, allc, allt, off = [], [], [], 0
for pi, x, y, z, q, s, tint, rank in PL:
    v, c, t = proto_arr[pi]
    M = np.array(C @ game_matrix(x, y, z, q, s) @ Ci, np.float32)
    allv.append(v @ M[:3, :3].T + M[:3, 3]); allc.append(c * tint); allt.append(t + off); off += len(v)
props_ob = make_mesh('props_bake', np.concatenate(allv), np.concatenate(allt), np.concatenate(allc))
log('props realised: tris', sum(len(t) for t in allt))

# ── 5. bake the terrain lightmaps ────────────────────────────────────────────────────────────────────────────────────
def select(obs, active):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active


bk = scene.render.bake
bk.margin = 8; bk.margin_type = 'EXTEND'; bk.use_clear = True; bk.target = 'IMAGE_TEXTURES'
# AO: sky visibility within 5 m, every object occludes
world.light_settings.distance = 5.0
select(terrain_obs, terrain_obs[0])
log('bake AO …')
bpy.ops.object.bake(type='AO')
lm_ao.filepath_raw = f'{OUT}/lm-ao.png'; lm_ao.file_format = 'PNG'
# the sun bounce: indirect diffuse only (no albedo), the sun at the midday reference with irradiance 1, black sky
REF = S.get('refSun') or [0.0, 0.883, -0.469]  # game space, toward the sun (DayNight: 62° up, due south at noon)
sun_dir_b = (C @ Vector((*REF, 0))).to_3d().normalized()
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 1.0; sun.angle = math.radians(1.5)
sun_ob = bpy.data.objects.new('sun', sun); scene.collection.objects.link(sun_ob)
sun_ob.rotation_mode = 'QUATERNION'; sun_ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(sun_dir_b)
for o in terrain_obs:
    o.data.materials[0].node_tree.nodes['BAKE'].image = lm_bounce
log('bake bounce …')
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'INDIRECT'})


def save_linear(img, path, gain=1.0):
    px = np.empty(img.size[0] * img.size[1] * 4, np.float32); img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    px[:, :3] = np.clip(px[:, :3] * gain, 0, 1)
    out = bpy.data.images.new(os.path.basename(path), img.size[0], img.size[1], alpha=False)
    out.colorspace_settings.name = 'Non-Color'
    out.pixels.foreach_set(px.ravel())
    out.filepath_raw = path; out.file_format = 'PNG'; out.save()
    return px


BOUNCE_GAIN = 2.0
ao_px = save_linear(lm_ao, f'{OUT}/lm-ao.png')
bo_px = save_linear(lm_bounce, f'{OUT}/lm-bounce.png', BOUNCE_GAIN)
log(f'AO mean {ao_px[:, 0].mean():.3f}; bounce mean {bo_px[:, :3].mean() / BOUNCE_GAIN:.3f} max {bo_px[:, :3].max() / BOUNCE_GAIN:.3f}')

# ── 6. prototype AO → vertex alpha (each on a ground plane, alone) ───────────────────────────────────────────────────
bpy.data.objects.remove(props_ob)
sun_ob.hide_render = True
proto_obs = []
for k, ((name, part, kind), (v, c, t)) in enumerate(zip(PROTOS, proto_arr)):
    ob = make_mesh(f'proto_{name}', v, t, c)
    ob.location = ((k % 8) * 16 + 2000, (k // 8) * 16 + 2000, 0)
    ob.data.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
    ob.data.color_attributes.active_color = ob.data.color_attributes['AO']
    proto_obs.append(ob)
ground = make_mesh('ground', np.array([[1900, 1900, 0], [2300, 1900, 0], [2300, 2300, 0], [1900, 2300, 0]], np.float32), np.array([[0, 1, 2], [0, 2, 3]]), None)
world.light_settings.distance = 1.2
select(proto_obs, proto_obs[0])
bk.target = 'VERTEX_COLORS'
log('bake prototype AO …')
bpy.ops.object.bake(type='AO')
for ob in proto_obs:
    me = ob.data
    n = len(me.vertices)
    ao = np.empty(n * 4, np.float32); me.color_attributes['AO'].data.foreach_get('color', ao)
    col = np.empty(n * 4, np.float32); me.color_attributes['Col'].data.foreach_get('color', col)
    col = col.reshape(-1, 4); col[:, 3] = np.clip(ao.reshape(-1, 4)[:, 0], 0, 1)
    me.color_attributes['Col'].data.foreach_set('color', col.ravel())
    me.color_attributes.remove(me.color_attributes['AO'])
    me.color_attributes.active_color = me.color_attributes['Col']
    ob.location = (0, 0, 0)

# ── 7. export ────────────────────────────────────────────────────────────────────────────────────────────────────────
bpy.data.objects.remove(ground)
select(terrain_obs + proto_obs, terrain_obs[0])
for ob in terrain_obs + proto_obs:
    ob.data.materials.clear()
bpy.ops.export_scene.gltf(
    filepath=f'{OUT}/island.glb', export_format='GLB', use_selection=True,
    export_normals=False, export_texcoords=True, export_materials='NONE', export_vertex_color='ACTIVE',
    export_all_vertex_colors=False, export_yup=True, export_apply=False, export_extras=False,
)
# placements: f32 × 10 per instance — proto, x, y, z, qx, qy, qz, qw (game space), scale, tint; ordered big → small, then
# by rank inside a kind so a tier can draw a prefix
order = sorted(range(len(PL)), key=lambda i: (PROTOS[PL[i][0]][2] not in ('palm', 'rock', 'prop'), PL[i][7]))
buf = np.zeros((len(PL), 10), np.float32)
for r, i in enumerate(order):
    pi, x, y, z, q, s, tint, rank = PL[i]
    buf[r] = (pi, x, y, z, q.x, q.y, q.z, q.w, s, tint)
buf.tofile(f'{OUT}/placements.bin')
meta = {
    'version': 1, 'area': {'x0': X0, 'z0': Z0, 'x1': X1, 'z1': Z1}, 'sea': SEA,
    'protos': [{'name': n, 'kind': k, 'tris': len(p.tris)} for n, p, k in PROTOS],
    'terrain': [o.name for o in terrain_obs], 'terrainTris': sum(len(o.data.polygons) for o in terrain_obs),
    'placements': len(PL), 'mustDraw': sum(1 for i in order if PROTOS[PL[i][0]][2] in ('palm', 'rock', 'prop')),
    'counts': counts, 'palms': {'game': len(palms_here), 'extra': len(extra_palms)},
    'colliders': COLLIDERS,
    'extraPalms': [{'x': p['x'], 'z': p['z'], 'h': p['h'], 'lean': p['lean'], 'leanDir': p['leanDir'], 'rot': p['rot'], 'fronds': 12} for p in extra_palms],
    'bake': {'aoDistance': 5.0, 'bounceGain': BOUNCE_GAIN, 'refSun': REF, 'samples': scene.cycles.samples, 'quick': QUICK,
             'aoMean': float(ao_px[:, 0].mean()), 'bounceMean': float(bo_px[:, :3].mean() / BOUNCE_GAIN)},
    'builtIn': round(time.time() - T0, 1),
}
json.dump(meta, open(f'{OUT}/island.json', 'w'), indent=1)
log('done', OUT)
