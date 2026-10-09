"""SF55 Blender Template source: clay cell, five landmarks, a hall door and real stacked ground.

Look (G166 B): warm Blender clay in three values plus one textured hero surface, the hall door. Ground is mid clay,
structures a lighter stone clay, every walkable deck, ramp and road a cooler slate clay (the route reads at a glance),
and a few dark trim pieces (the hall lintel, the ridge beacon, the hub markers, the court pillars) mark where to go.
Only the door has a texture: a weathered plank double door with iron straps and rings. The look pass changes
materials, UVs and vertex colours only: every mesh, name, position and face count is the same, so the native trimesh
colliders and walk routes are unchanged.
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


def box(name, at, size, surface=stone, top=None, tone=STONE):
    """A box; `top` gives its upward face its own material (a walkable deck reads as route, its sides as structure)."""
    x, y, z = at
    dx, dy, dz = size
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


# One sampled ground authority. Roads are separate coplanar inlays with ground omitted beneath them.
# A 12 m-wide cross leaves every 8 x 15 m native midpoint entry clear, flat and dry.
# The north road goes around the enterable hall; its back wall never blocks the route to the hub.
# Bound flat faces to the SDK's collision lattice so no long diagonal becomes a thin clipped seam.
lattice = [-250 + tile * 62.5 for tile in range(9)]
xs, zs = sorted(set(lattice + [-24, -12, -6, 6])), sorted(set(lattice + [-6, 6, 48, 60]))
for ix, (x0, x1) in enumerate(zip(xs, xs[1:])):
    for iz, (z0, z1) in enumerate(zip(zs, zs[1:])):
        x, z = (x0 + x1) / 2, (z0 + z1) / 2
        driveway = abs(x) < 6 or abs(z) < 6 or (-24 < x < -12 and -6 < z < 60) or (-24 < x < 6 and 48 < z < 60)
        face_size = 6 if driveway else max(6, min(x1 - x0, z1 - z0) * 1.5)
        nx, nz = math.ceil((x1 - x0) / face_size), math.ceil((z1 - z0) / face_size)
        points = [(x0 + (x1 - x0) * dx / nx, 0, z0 + (z1 - z0) * dz / nz)
                  for dz in range(nz + 1) for dx in range(nx + 1)]
        faces = [(dz * (nx + 1) + dx, (dz + 1) * (nx + 1) + dx,
                  (dz + 1) * (nx + 1) + dx + 1, dz * (nx + 1) + dx + 1)
                 for dz in range(nz) for dx in range(nx)]
        mesh(f'ws_terrain_ground_{ix}_{iz}', points, faces, road if driveway else clay)

# NORTH: a drive-through cut in a 19.2 m rise, with a traversable bridge overhead.
for x in [-36, 36]:
    box('North rise bank', (x, 9.6, 209), (60, 19.2, 38))
box('North ridge bridge', (0, 18.6, 209), (14, 1.2, 10), stone, road)
ramp('North bridge ascent', 90, 20, 176, 188, 0, 19.2)
box('North bridge approach', (13, 18.6, 194), (14, 1.2, 32), stone, road)
box('North ridge beacon', (-20, 21, 209), (3, 6, 3), tone=TRIM)

# EAST: a colonnade on both sides of the road, an overhang clear of the driving lane.
for x in [185, 205, 225]:
    for z in [-10, 10]:
        box('East column', (x, 3, z), (2, 6, 2))
box('East canopy', (205, 6.3, 0), (45, 0.6, 24))

# WEST: a small stepped court beside the road, reachable by the ordinary player.
for step in range(6):
    box('West court step', (-210, (step + 1) * 0.15, -16 - step * 2), (26, (step + 1) * 0.3, 2), stone, road)
for x in [-224, -196]:
    box('West court pillar', (x, 2, -26), (2, 4, 2), tone=TRIM)

# SOUTH: a split arch and an elevated balcony, drivable underneath.
for x in [-10, 10]:
    box('South arch post', (x, 4, -211), (3, 8, 3))
box('South arch lintel', (0, 8.4, -211), (24, 0.8, 6), stone, road)
ramp('South balcony ascent', 62, 12, -219, -211, 0, 8.8)

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
print('[blender-template] exported five-landmark clay world')
