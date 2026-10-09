"""SF55 Blender Template source: a filled clay cell (G220, G276), a hall door and real stacked ground.

The cell: a set piece at each midpoint entry (north the ridge cut, bridge and watchtower; +x the market stoa; -x the
amphitheatre; south the aqueduct and cistern), a walled hub plaza around the hall with an obelisk, 12 m slate spokes
and a ring road at 114 m that links them. Everything is authored here, nothing is generated.

Look (G166 B): warm Blender clay in three values plus one textured hero surface, the hall door. Ground is mid clay,
structures a lighter stone clay, every walkable deck, ramp and road a cooler slate clay (the route reads at a glance),
and dark trim pieces (lintels, merlons, lamp heads, waystones, stalls, the obelisk cap) mark where to go.
Only the door has a texture: a weathered plank double door with iron straps and rings. Every mesh is a native trimesh
collider; flat tops are cut at the 62.5 m tile lattice and no two upward faces overlap at one height.
"""
import math
import os
import sys
import bpy
import numpy as np

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
out = sys.argv[sys.argv.index('--') + 1]
os.makedirs(out, exist_ok=True)


def material(name, colour, roughness=1.0):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    node = value.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*colour, 1)
    node.inputs['Roughness'].default_value = roughness
    return value


# Two clay materials only (a 125 m L1 tile may draw two): warm 'Clay' for ground and structures, cool 'Road clay' for
# every route surface. The values within 'Clay' (ground, stone, dark trim) and a soft occlusion toward the ground are
# linear vertex colours that multiply the material colour, so they cost no draw.
clay = material('Clay', (0.67, 0.64, 0.59))
road = material('Road clay', (0.25, 0.26, 0.28))
wood = material('Hall door', (1, 1, 1), roughness=0.85)
GROUND, STONE, TRIM = 0.78, 1.0, 0.5
stone = clay
tones = {}


def door_pixels(size=512):
    """The one textured surface: a plank double door, iron straps, rivets and two ring pulls (sRGB, row 0 = bottom)."""
    rng = np.random.default_rng(55)
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    u, v = x / size, y / size
    leaf = (u >= 0.5).astype(np.int32)
    lu = np.where(leaf == 1, u - 0.5, u) * 2  # 0–1 across each leaf
    plank = np.minimum((lu * 4).astype(np.int32), 3) + leaf * 4
    tone = rng.uniform(0.86, 1.1, 8).astype(np.float32)[plank]
    shift = rng.uniform(0, 40, 8).astype(np.float32)[plank]
    grain = (0.5 + 0.5 * np.sin(x * 0.55 + 3.0 * np.sin(y * 0.021 + shift) + shift)) ** 3
    streak = 0.5 + 0.5 * np.sin(x * 2.3 + np.sin(y * 0.07 + shift * 1.7) * 1.4)
    noise = rng.normal(0, 0.035, (size, size)).astype(np.float32)
    light = (0.82 + 0.16 * grain + 0.05 * streak + noise) * tone
    light *= 0.78 + 0.22 * np.clip(v * 3, 0, 1)  # grime toward the sill
    rgb = np.stack([0.50 * light, 0.31 * light, 0.17 * light], axis=-1)
    # knots
    for _ in range(9):
        cx, cy, r = rng.uniform(0.08, 0.92) * size, rng.uniform(0.1, 0.9) * size, rng.uniform(4, 9)
        d = np.hypot((x - cx) * 1.6, y - cy)
        k = np.clip(1 - d / (r * 2.2), 0, 1) ** 1.5
        rgb *= (1 - 0.45 * k)[..., None]
    # plank gaps and the centre seam
    edge = np.abs(lu * 4 - np.round(lu * 4)) * size / 8
    rgb *= np.where(edge < 1.6, 0.35, np.where(edge < 3.0, 0.75, 1.0))[..., None]
    seam = np.abs(u - 0.5) * size
    rgb *= np.where(seam < 3, 0.18, np.where(seam < 5, 0.6, 1.0))[..., None]
    iron = np.array([0.20, 0.19, 0.18], np.float32)

    def paint(mask, colour):
        rgb[mask] = colour

    # iron straps, highlight on their top edge, rivets along them
    for lo, hi in [(0.15, 0.22), (0.76, 0.83)]:
        band = (v >= lo) & (v < hi) & (seam >= 6)
        shade = 0.85 + 0.45 * ((v - lo) / (hi - lo)) ** 4
        rgb[band] = (iron[None, :] * shade[band][:, None])
        mid = (lo + hi) / 2 * size
        for cx in list(np.arange(26, size / 2 - 10, 38)) + list(np.arange(size / 2 + 26, size - 10, 38)):
            d = np.hypot(x - cx, y - mid)
            paint(d < 4.5, iron * 1.9)
            paint((d < 2.0) & (y > mid), iron * 2.8)
    # the iron frame
    border = (u < 0.025) | (u > 0.975) | (v < 0.025) | (v > 0.975)
    paint(border, iron * 0.85)
    # ring pulls on back plates either side of the seam
    for cx in [size / 2 - 34, size / 2 + 34]:
        cy = 0.47 * size
        plate = (np.abs(x - cx) < 13) & (np.abs(y - cy - 16) < 13)
        paint(plate, iron * 1.25)
        d = np.hypot(x - cx, y - cy)
        ring = (d < 24) & (d > 17)
        rgb[ring] = iron * (1.3 + 1.2 * np.clip((y[ring] - cy) / 24, 0, 1))[:, None]
        paint((d >= 24) & (d < 26.5) & (y < cy), iron * 0.6)  # its shadow
    rgb = np.clip(rgb, 0, 1)
    rgba = np.concatenate([rgb, np.ones((size, size, 1), np.float32)], axis=-1)
    return rgba.ravel()


# The only textured surface: a packed ordinary PNG, encoded to KTX2 by the SDK.
image = bpy.data.images.new('Hall door grain', width=512, height=512)
image.pixels.foreach_set(door_pixels(512))
image.filepath_raw = os.path.join(out, 'door.png')
image.file_format = 'PNG'
image.save()
image.pack()
texture = wood.node_tree.nodes.new('ShaderNodeTexImage')
texture.image = image
wood.node_tree.links.new(texture.outputs['Color'], wood.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])


def box(name, at, size, surface=stone, top=None, tone=STONE, top_cuts=()):
    """A box; `top` gives its upward face its own material (a walkable deck reads as route, its sides as structure)."""
    x, y, z = at
    dx, dy, dz = size
    if top_cuts:
        return cut_top_box(name, at, size, surface, top, tone, top_cuts)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (dx, dz, dy)
    obj.data.materials.append(surface)
    if top is not None:
        obj.data.materials.append(top)
        for face in obj.data.polygons:
            if face.normal.z > 0.9:
                face.material_index = 1
    tones[obj.name] = tone
    return obj


def door_uvs(obj):
    """Both broad faces show the whole door; the edges take a sliver of the iron frame."""
    data = obj.data
    uv = data.uv_layers.active
    for face in data.polygons:
        for loop in face.loop_indices:
            co = data.vertices[data.loops[loop].vertex_index].co
            if abs(face.normal.y) > 0.9:
                s = co.x + 0.5 if face.normal.y > 0 else 0.5 - co.x
                uv.data[loop].uv = (s, co.z + 0.5)
            else:
                uv.data[loop].uv = (0.005, co.z + 0.5)


def mesh(name, points, faces, surface=clay, top=None, tone=GROUND):
    data = bpy.data.meshes.new(name)
    data.from_pydata([(x, -z, y) for x, y, z in points], [], faces)
    data.update()
    uv = data.uv_layers.new(name='UVMap')
    for face in data.polygons:
        for loop in face.loop_indices:
            point = data.vertices[data.loops[loop].vertex_index].co
            uv.data[loop].uv = (point.x / 500 + 0.5, point.y / 500 + 0.5)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(surface)
    if top is not None:
        obj.data.materials.append(top)
        data.polygons[0].material_index = 1
    tones[obj.name] = tone
    return obj


def ramp(name, x0, x1, z0, z1, y0, y1):
    # Sloped top plus solid side walls; genuine native trimesh ground, no heightfield.
    # The slope (face 0) is route-coloured, the walls stone.
    points = [(x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1),
              (x0, -0.2, z0), (x1, -0.2, z0), (x1, -0.2, z1), (x0, -0.2, z1)]
    return mesh(name, points, [(0, 3, 2, 1), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], stone, road, STONE)


def cut_top_box(name, at, size, surface, top, tone, cuts):
    """Keep the box walls, omitting upper faces already owned by another deck at the same height."""
    x, y, z = at
    dx, dy, dz = size
    x0, x1, z0, z1 = x - dx / 2, x + dx / 2, z - dz / 2, z + dz / 2
    lo, hi = y - dy / 2, y + dy / 2
    points = [(x0, hi, z0), (x1, hi, z0), (x1, hi, z1), (x0, hi, z1),
              (x0, lo, z0), (x1, lo, z0), (x1, lo, z1), (x0, lo, z1)]
    faces = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)]
    xs = sorted({x0, x1, *(max(x0, min(x1, value)) for cut in cuts for value in cut[:2])})
    zs = sorted({z0, z1, *(max(z0, min(z1, value)) for cut in cuts for value in cut[2:])})
    for a, b in zip(xs, xs[1:]):
        for c, d in zip(zs, zs[1:]):
            if any(left <= (a + b) / 2 <= right and near <= (c + d) / 2 <= far
                   for left, right, near, far in cuts):
                continue
            first = len(points)
            points.extend([(a, hi, c), (b, hi, c), (b, hi, d), (a, hi, d)])
            faces.append((first, first + 3, first + 2, first + 1))
    obj = mesh(name, points, faces, surface, tone=tone)
    if top is not None:
        obj.data.materials.append(top)
        for face in obj.data.polygons:
            if face.normal.z > 0.9:
                face.material_index = 1
    return obj


class Shell:
    """Hand-placed faces in game coordinates (x east-west, y up, z north), each wound to face `outward`.

    One object per kind of piece keeps the node count low; a face flagged `route` takes the slate 'Road clay'."""

    def __init__(self, name, tone=STONE):
        self.name, self.tone, self.points, self.faces, self.routes = name, tone, [], [], []

    def face(self, pts, outward, route=False):
        a, b, c = (np.array(p, np.float64) for p in pts[:3])
        if np.dot(np.cross(b - a, c - a), outward) < 0:
            pts = pts[::-1]
        first = len(self.points)
        self.points.extend(pts)
        self.faces.append(tuple(range(first, first + len(pts))))
        self.routes.append(route)

    def box(self, x0, x1, y0, y1, z0, z1, route=False):
        """A solid block without its hidden underside; `route` makes its top a slate path. A long top is cut at the
        tile lattice so no long thin triangle is clipped into a seam."""
        xs = sorted({x0, x1, *(v for v in lattice if x0 < v < x1)})
        zs = sorted({z0, z1, *(v for v in lattice if z0 < v < z1)})
        for a, b in zip(xs, xs[1:]):
            for c, d in zip(zs, zs[1:]):
                self.face([(a, y1, c), (a, y1, d), (b, y1, d), (b, y1, c)], (0, 1, 0), route)
        for a, b in zip(xs, xs[1:]):
            self.face([(a, y0, z0), (b, y0, z0), (b, y1, z0), (a, y1, z0)], (0, 0, -1))
            self.face([(a, y0, z1), (b, y0, z1), (b, y1, z1), (a, y1, z1)], (0, 0, 1))
        for c, d in zip(zs, zs[1:]):
            self.face([(x0, y0, c), (x0, y0, d), (x0, y1, d), (x0, y1, c)], (-1, 0, 0))
            self.face([(x1, y0, c), (x1, y0, d), (x1, y1, d), (x1, y1, c)], (1, 0, 0))

    def stairs(self, along, start, sign, across, count, base, width=3.0, rise=0.3, run=0.5):
        """`count` treads of `rise` x `run`, climbing from `start` in direction `sign` along x or z; slate treads."""
        for k in range(count):
            s0, s1 = sorted((start + sign * run * k, start + sign * run * (k + 1)))
            if along == 'x':
                self.box(s0, s1, base, base + rise * (k + 1), across - width / 2, across + width / 2, True)
            else:
                self.box(across - width / 2, across + width / 2, base, base + rise * (k + 1), s0, s1, True)

    def done(self):
        obj = mesh(self.name, self.points, self.faces, clay, tone=self.tone)
        obj.data.materials.append(road)
        for face, route in zip(obj.data.polygons, self.routes):
            face.material_index = 1 if route else 0
        return obj


def arch(shell, x0, x1, z0, z1, crown, top, segments=6):
    """The spandrel over one round arch between two piers: front, back and the curved soffit."""
    r, cx = (x1 - x0) / 2, (x0 + x1) / 2
    spring = crown - r
    arc = [(cx - r * math.cos(math.pi * i / segments), spring + r * math.sin(math.pi * i / segments))
           for i in range(segments + 1)]
    for (ax, ay), (bx, by) in zip(arc, arc[1:]):
        shell.face([(ax, ay, z0), (bx, by, z0), (bx, top, z0), (ax, top, z0)], (0, 0, -1))
        shell.face([(ax, ay, z1), (bx, by, z1), (bx, top, z1), (ax, top, z1)], (0, 0, 1))
        mx, my = (ax + bx) / 2 - cx, (ay + by) / 2 - spring
        shell.face([(ax, ay, z0), (bx, by, z0), (bx, by, z1), (ax, ay, z1)], (-mx, -my, 0))


# One sampled ground authority. Roads are separate coplanar inlays with ground omitted beneath them.
# G220/G276: the four entry spokes run 12 m wide into a walled hub plaza, and a ring road at 114 m links the spokes
# halfway out. Every 8 x 15 m native midpoint entry stays clear, flat and dry.
# The north road goes around the enterable hall; its back wall never blocks the route to the hub.
# Bound flat faces to the SDK's collision lattice so no long diagonal becomes a thin clipped seam.
lattice = [-250 + tile * 62.5 for tile in range(9)]
RING = 114
xs = sorted(set(lattice + [-RING - 6, -RING + 6, -36, -24, -12, -6, 6, 36, RING - 6, RING + 6]))
zs = sorted(set(lattice + [-RING - 6, -RING + 6, -36, -6, 6, 48, 60, RING - 6, RING + 6]))


def paved(x, z):
    spoke = abs(x) < 6 or abs(z) < 6
    detour = (-24 < x < -12 and -6 < z < 60) or (-24 < x < 6 and 48 < z < 60)
    ring = (abs(abs(x) - RING) < 6 and abs(z) < RING + 6) or (abs(abs(z) - RING) < 6 and abs(x) < RING + 6)
    return spoke or detour or ring


for ix, (x0, x1) in enumerate(zip(xs, xs[1:])):
    for iz, (z0, z1) in enumerate(zip(zs, zs[1:])):
        x, z = (x0 + x1) / 2, (z0 + z1) / 2
        driveway = paved(x, z)
        face_size = 6 if driveway else max(6, min(x1 - x0, z1 - z0) * 1.5)
        nx, nz = math.ceil((x1 - x0) / face_size), math.ceil((z1 - z0) / face_size)
        points = [(x0 + (x1 - x0) * dx / nx, 0, z0 + (z1 - z0) * dz / nz)
                  for dz in range(nz + 1) for dx in range(nx + 1)]
        faces = [(dz * (nx + 1) + dx, (dz + 1) * (nx + 1) + dx,
                  (dz + 1) * (nx + 1) + dx + 1, dz * (nx + 1) + dx + 1)
                 for dz in range(nz) for dx in range(nx)]
        mesh(f'ws_terrain_ground_{ix}_{iz}', points, faces, road if driveway else clay)

# NORTH (+z) · THE RIDGE CUT: a drive-through cut in a 19.2 m rise, a traversable bridge overhead, and a watchtower on
# the east bank reached over the bridge and up a stair.
for x in [-36, 36]:
    box('North rise bank', (x, 9.6, 209), (60, 19.2, 38),
        top_cuts=((-7, 7, 204, 214), (6, 20, 178, 210)))
box('North ridge bridge', (0, 18.6, 209), (14, 1.2, 10), stone, road)
ramp('North bridge ascent', 90, 20, 176, 188, 0, 19.2)
box('North bridge approach', (13, 18.6, 194), (14, 1.2, 32), stone, road,
    top_cuts=((-7, 7, 204, 214),))
box('North ridge beacon', (-20, 21, 209), (3, 6, 3), tone=TRIM)
north = Shell('North watchtower')
for z0, z1 in [(190, 203.5), (214.5, 228)]:
    north.box(-7, -6, 19.2, 20.2, z0, z1)  # parapets along the cut rims
north.box(6, 7, 19.2, 20.2, 214.5, 228)
north.box(-48, -40, 19.2, 28.2, 201, 209, True)
north.stairs('x', -25, -1, 204.5, 30, 19.2)
north.done()
crown = Shell('North watchtower merlons', TRIM)
for x, z in [(-48, 201), (-41.4, 201), (-48, 207.6), (-41.4, 207.6)]:
    crown.box(x, x + 1.4, 28.2, 29.4, z, z + 1.4)
crown.done()

# WEST (+x; the map's west) · THE MARKET STOA: two roofed colonnades either side of the road, stalls under them,
# a stair onto the walkable roofs and two footbridges across the road.
stoa = Shell('West stoa')
for x in range(152, 223, 10):
    for z in [-23, -9, 9, 23]:
        stoa.box(x - 0.7, x + 0.7, 0, 6.6, z - 0.7, z + 0.7)
for z0, z1 in [(7, 25), (-25, -7)]:
    stoa.box(148, 226, 6.6, 7.5, z0, z1, True)
for x in [157, 207]:
    stoa.box(x - 1.5, x + 1.5, 6.9, 7.5, -7, 7, True)
stoa.stairs('z', 37.5, -1, 169.5, 25, 0)
stoa.done()
stalls = Shell('West stoa stalls', TRIM)
for x in [157, 177, 197, 217]:
    for z in [-16, 16]:
        stalls.box(x - 2.5, x + 2.5, 0, 1.1, z - 0.8, z + 0.8)
stalls.done()

# EAST (-x; the map's east) · THE AMPHITHEATRE: eight seat tiers in a half bowl facing the road, three slate aisles of
# half steps up them, and a stage with a three-door backdrop toward the road.
CX, CZ, R0, DEPTH, TIERS, RISE = -200, -40, 12.0, 2.4, 8, 0.6
bowl = Shell('East amphitheatre')
AISLES = [math.radians(a) for a in (225, 270, 315)]
HALF = math.radians(4.5)
edges = [math.pi]
for centre in AISLES + [2 * math.pi + HALF]:
    start = edges[-1]
    edges += [start + (centre - HALF - start) * i / 4 for i in range(1, 5)]
    if centre < 2 * math.pi:
        edges.append(centre + HALF)

def at(r, a, y):
    return (CX + r * math.cos(a), y, CZ + r * math.sin(a))


for a0, a1 in zip(edges, edges[1:]):
    mid = (a0 + a1) / 2
    aisle = any(abs(mid - centre) < HALF for centre in AISLES)
    treads = []
    for t in range(TIERS):
        r0, r1, h = R0 + DEPTH * t, R0 + DEPTH * (t + 1), RISE * (t + 1)
        treads += [(r0, r0 + DEPTH / 2, h - RISE / 2), (r0 + DEPTH / 2, r1, h)] if aisle else [(r0, r1, h)]
    radial = (math.cos(mid), 0, math.sin(mid))
    below = 0.0
    for r0, r1, h in treads:
        bowl.face([at(r0, a0, h), at(r1, a0, h), at(r1, a1, h), at(r0, a1, h)], (0, 1, 0), aisle)
        bowl.face([at(r0, a0, below), at(r0, a1, below), at(r0, a1, h), at(r0, a0, h)], (-radial[0], 0, -radial[2]))
        below = h
    rmax = treads[-1][1]
    bowl.face([at(rmax, a0, 0), at(rmax, a1, 0), at(rmax, a1, below), at(rmax, a0, below)], radial)
    for a, side in [(a0, -1), (a1, 1)]:
        tangent = (-math.sin(a) * side, 0, math.cos(a) * side)
        if aisle:  # the seat ends either side of an aisle face into it above its half steps
            for t in range(TIERS):
                r0, h = R0 + DEPTH * t, RISE * (t + 1)
                bowl.face([at(r0, a, h - RISE / 2), at(r0 + DEPTH / 2, a, h - RISE / 2), at(r0 + DEPTH / 2, a, h),
                           at(r0, a, h)], (-tangent[0], 0, -tangent[2]))
        elif a in (math.pi, 2 * math.pi) or abs(a - 2 * math.pi) < 1e-9:  # the two ends of the bowl face the road
            for r0, r1, h in treads:
                bowl.face([at(r0, a, 0), at(r1, a, 0), at(r1, a, h), at(r0, a, h)], tangent)
bowl.box(-212, -188, 0, 1.2, -30, -21)  # the stage
bowl.stairs('z', -31.5, 1, -200, 3, 0, width=6)
for x0, x1 in [(-212, -205), (-203, -201), (-199, -197), (-195, -188)]:
    bowl.box(x0, x1, 1.2, 8, -22, -21)
for x0, x1 in [(-205, -203), (-201, -199), (-197, -195)]:
    bowl.box(x0, x1, 4.4, 8, -22, -21)
bowl.done()
dark = Shell('East amphitheatre trim', TRIM)
dark.box(-212.5, -187.5, 8, 8.6, -22.3, -20.7)
for x in [CX - 33, CX + 33]:
    dark.box(x - 1, x + 1, 0, 8, CZ - 1, CZ + 1)
dark.done()

# SOUTH (-z) · THE AQUEDUCT: an arcade of round arches carrying a slate deck 8.8 m up across the road, climbed by the
# balcony ramp and ending at a cistern tower with a stair to its roof.
for x in [-10, 10]:
    box('South arch post', (x, 4, -211), (3, 8, 3))
ramp('South balcony ascent', 62, 12, -219, -211, 0, 8.8)
aqueduct = Shell('South aqueduct')
aqueduct.box(-96, 12, 8.0, 8.8, -214, -208, True)
piers = [-90 + 12 * i for i in range(7)]
for x in piers:
    aqueduct.box(x - 1.2, x + 1.2, 0, 8.0, -214, -208)
faces = [-96] + [v for x in piers for v in (x - 1.2, x + 1.2)] + [-11.5]
for x0, x1 in zip(faces[0::2], faces[1::2]):
    arch(aqueduct, x0, x1, -214, -208, 6.9, 8.0)
aqueduct.box(-108, -96, 0, 14.2, -217, -205, True)
aqueduct.stairs('x', -87, -1, -209.5, 18, 8.8)
aqueduct.done()
cistern = Shell('South cistern merlons', TRIM)
for x, z in [(-108, -217), (-97.4, -217), (-108, -206.4), (-97.4, -206.4)]:
    cistern.box(x, x + 1.4, 14.2, 15.4, z, z + 1.4)
cistern.done()

# CENTRE: a real enterable hall with one stable independently controlled door.
box('Hall west wall', (-7.4, 2.5, 28), (0.8, 5, 24))
box('Hall east wall', (7.4, 2.5, 28), (0.8, 5, 24))
box('Hall back wall', (0, 2.5, 40.4), (15.6, 5, 0.8))
for x in [-4.5, 4.5]:
    box('Hall front pier', (x, 2.5, 15.6), (6, 5, 0.8))
box('Hall door header', (0, 4, 15.6), (3, 2, 0.8), tone=TRIM)
door_uvs(box('HallDoor', (0, 1.5, 15.6), (3, 3, 0.25), wood))
box('Hall roof bridge', (0, 5.3, 28), (15.6, 0.6, 25.6), stone, road)
ramp('Hall roof ascent', 27, 7.8, 24, 32, 0, 5.6)
# Centre markers frame the crossroads without blocking any road.
for x, z in [(-12, -12), (12, -12), (-12, 12), (12, 12)]:
    box('Hub marker', (x, 1.5, z), (2, 3, 2), tone=TRIM)

# THE HUB: a walled plaza around the hall, a gate over each road, corner pylons, and a stepped obelisk south of the
# crossroads that every entry can see.
hub = Shell('Hub plaza')
for x in [-36.8, 36]:
    hub.box(x, x + 0.8, 0, 0.9, -36.8, -6)
    hub.box(x, x + 0.8, 0, 0.9, 6, 60.8)
for z in [-36.8, 60]:
    hub.box(-36, -6, 0, 0.9, z, z + 0.8)
    hub.box(6, 36, 0, 0.9, z, z + 0.8)
for gx, gz, along in [(0, 60.4, 'x'), (0, -36.4, 'x'), (36.4, 0, 'z'), (-36.4, 0, 'z')]:
    for side in [-7.5, 7.5]:
        px, pz = (gx + side, gz) if along == 'x' else (gx, gz + side)
        hub.box(px - 1, px + 1, 0, 7, pz - 1, pz + 1)
for x, z in [(-36.4, -36.4), (36.4, -36.4), (-36.4, 60.4), (36.4, 60.4)]:
    hub.box(x - 1.5, x + 1.5, 0, 9, z - 1.5, z + 1.5)
for size, y0 in [(12, 0), (9, 0.3), (6, 0.6)]:
    hub.box(-size / 2, size / 2, y0, y0 + 0.3, -18 - size / 2, -18 + size / 2, True)
base, tip, y0, y1 = 1.2, 0.7, 0.9, 20.9
for (ax, az), (bx, bz), normal in [((-1, -1), (1, -1), (0, 0, -1)), ((1, -1), (1, 1), (1, 0, 0)),
                                   ((1, 1), (-1, 1), (0, 0, 1)), ((-1, 1), (-1, -1), (-1, 0, 0))]:
    hub.face([(ax * base, y0, -18 + az * base), (bx * base, y0, -18 + bz * base),
              (bx * tip, y1, -18 + bz * tip), (ax * tip, y1, -18 + az * tip)], normal)
hub.done()
hubtrim = Shell('Hub trim', TRIM)
for gx, gz, along in [(0, 60.4, 'x'), (0, -36.4, 'x'), (36.4, 0, 'z'), (-36.4, 0, 'z')]:
    if along == 'x':
        hubtrim.box(-8.5, 8.5, 7, 8, gz - 1, gz + 1)
    else:
        hubtrim.box(gx - 1, gx + 1, 7, 8, -8.5, 8.5)
for x, z in [(-36.4, -36.4), (36.4, -36.4), (-36.4, 60.4), (36.4, 60.4)]:
    hubtrim.box(x - 1.8, x + 1.8, 9, 10.5, z - 1.8, z + 1.8)
for (ax, az), (bx, bz), normal in [((-1, -1), (1, -1), (0, 0, -1)), ((1, -1), (1, 1), (1, 0, 0)),
                                   ((1, 1), (-1, 1), (0, 0, 1)), ((-1, 1), (-1, -1), (-1, 0, 0))]:
    hubtrim.face([(ax * tip, 20.9, -18 + az * tip), (bx * tip, 20.9, -18 + bz * tip), (0, 23, -18)],
                 (normal[0], 0.4, normal[2]))
hubtrim.done()

# THE ROADS: lamp posts pace every spoke, waystones mark where the ring road crosses a spoke, cairns its corners.
lamps, heads = Shell('Road lamps'), Shell('Road lamp heads', TRIM)
reach = {(0, 1): [80, 140, 176], (0, -1): [80, 140, 190], (1, 0): [80, 140], (-1, 0): [80, 140, 190]}
for (dx, dz), stations in reach.items():
    for s in stations:
        for side in [-7.5, 7.5]:
            x, z = dx * s + (side if dx == 0 else 0), dz * s + (side if dz == 0 else 0)
            lamps.box(x - 0.25, x + 0.25, 0, 4.6, z - 0.25, z + 0.25)
            heads.box(x - 0.55, x + 0.55, 4.6, 5.3, z - 0.55, z + 0.55)
for jx, jz in [(0, RING), (0, -RING), (RING, 0), (-RING, 0)]:
    for ox in [-8.5, 8.5]:
        for oz in [-8.5, 8.5]:
            heads.box(jx + ox - 0.6, jx + ox + 0.6, 0, 2.4, jz + oz - 0.6, jz + oz + 0.6)
for x, z in [(-RING, -RING), (RING, -RING), (-RING, RING), (RING, RING)]:
    cx, cz = x + math.copysign(9, x), z + math.copysign(9, z)
    lamps.box(cx - 2, cx + 2, 0, 4, cz - 2, cz + 2)
    heads.box(cx - 1.4, cx + 1.4, 4, 5.2, cz - 1.4, cz + 1.4)
lamps.done()
heads.done()

# Linear vertex colours on every mesh (a vertex-coloured surface without the attribute would draw black): the 'Clay'
# faces take their tone, route faces stay 1, and structures darken softly toward the ground like clay occlusion.
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    data, world = obj.data, obj.matrix_world
    colours = data.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    data.color_attributes.active_color = colours
    tone = tones.get(obj.name, 1.0)
    structure = not obj.name.startswith('ws_terrain_ground') and obj.name != 'HallDoor'
    for face in data.polygons:
        route = data.materials[face.material_index] is road
        for loop in face.loop_indices:
            height = (world @ data.vertices[data.loops[loop].vertex_index].co).z
            occlusion = 0.8 + 0.2 * min(1.0, max(0.0, height / 4)) if structure else 1.0
            value = (1.0 if route else tone) * occlusion
            colours.data[loop].color = (value, value, value, 1)

bpy.ops.export_scene.gltf(export_vertex_color='ACTIVE', filepath=os.path.join(out, 'world.glb'), export_format='GLB',
                          export_yup=True, export_apply=True, export_materials='EXPORT',
                          export_animations=False, export_cameras=False, export_lights=False,
                          export_extras=False, export_image_format='AUTO')
print('[blender-template] exported the filled clay cell')
