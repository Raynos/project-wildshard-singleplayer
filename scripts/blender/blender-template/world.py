"""SF55 Blender Template source: clay cell, five landmarks, a hall door and real stacked ground."""
import math
import os
import sys
import bpy

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
out = sys.argv[sys.argv.index('--') + 1]
os.makedirs(out, exist_ok=True)


def material(name, colour):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    node = value.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*colour, 1)
    node.inputs['Roughness'].default_value = 1
    return value


clay = material('Clay', (0.60, 0.60, 0.60))
road = material('Road clay', (0.43, 0.43, 0.43))
wood = material('Hall door', (1, 1, 1))
# The only textured surface: a packed ordinary PNG, encoded to KTX2 by the SDK.
image = bpy.data.images.new('Hall door grain', width=64, height=64)
image.pixels = [value for y in range(64) for x in range(64)
                for value in (0.42 + 0.06 * math.sin(x * 0.9 + math.sin(y * 0.17)),
                              0.23 + 0.03 * math.sin(x * 0.9), 0.12, 1)]
image.filepath_raw = os.path.join(out, 'door.png')
image.file_format = 'PNG'
image.save()
image.pack()
texture = wood.node_tree.nodes.new('ShaderNodeTexImage')
texture.image = image
wood.node_tree.links.new(texture.outputs['Color'], wood.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])


def box(name, at, size, surface=clay):
    x, y, z = at
    dx, dy, dz = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (dx, dz, dy)
    obj.data.materials.append(surface)
    return obj


def mesh(name, points, faces, surface=clay):
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
    return obj


def ramp(name, x0, x1, z0, z1, y0, y1):
    # Sloped top plus solid side walls; genuine native trimesh ground, no heightfield.
    points = [(x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1),
              (x0, -0.2, z0), (x1, -0.2, z0), (x1, -0.2, z1), (x0, -0.2, z1)]
    return mesh(name, points, [(0, 3, 2, 1), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])


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
box('North ridge bridge', (0, 18.6, 209), (14, 1.2, 10))
ramp('North bridge ascent', 90, 20, 176, 188, 0, 19.2)
box('North bridge approach', (13, 18.6, 194), (14, 1.2, 32))
box('North ridge beacon', (-20, 21, 209), (3, 6, 3))

# EAST: a colonnade on both sides of the road, an overhang clear of the driving lane.
for x in [185, 205, 225]:
    for z in [-10, 10]:
        box('East column', (x, 3, z), (2, 6, 2))
box('East canopy', (205, 6.3, 0), (45, 0.6, 24))

# WEST: a small stepped court beside the road, reachable by the ordinary player.
for step in range(6):
    box('West court step', (-210, (step + 1) * 0.15, -16 - step * 2), (26, (step + 1) * 0.3, 2))
for x in [-224, -196]:
    box('West court pillar', (x, 2, -26), (2, 4, 2))

# SOUTH: a split arch and an elevated balcony, drivable underneath.
for x in [-10, 10]:
    box('South arch post', (x, 4, -211), (3, 8, 3))
box('South arch lintel', (0, 8.4, -211), (24, 0.8, 6))
ramp('South balcony ascent', 62, 12, -219, -211, 0, 8.8)

# CENTRE: a real enterable hall with one stable independently controlled door.
box('Hall west wall', (-7.4, 2.5, 28), (0.8, 5, 24))
box('Hall east wall', (7.4, 2.5, 28), (0.8, 5, 24))
box('Hall back wall', (0, 2.5, 40.4), (15.6, 5, 0.8))
for x in [-4.5, 4.5]:
    box('Hall front pier', (x, 2.5, 15.6), (6, 5, 0.8))
box('Hall door header', (0, 4, 15.6), (3, 2, 0.8))
box('HallDoor', (0, 1.5, 15.6), (3, 3, 0.25), wood)
box('Hall roof bridge', (0, 5.3, 28), (15.6, 0.6, 25.6))
ramp('Hall roof ascent', 27, 7.8, 24, 32, 0, 5.6)
# Centre markers frame the crossroads without blocking any road.
for x, z in [(-12, -12), (12, -12), (-12, 12), (12, 12)]:
    box('Hub marker', (x, 1.5, z), (2, 3, 2))

bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'world.glb'), export_format='GLB',
                          export_yup=True, export_apply=True, export_materials='EXPORT',
                          export_animations=False, export_cameras=False, export_lights=False,
                          export_extras=False, export_image_format='AUTO')
print('[blender-template] exported five-landmark clay world')
