"""landmarklib.py: the open plots' scripted landmarks' shared Blender helpers (OB2 cypress.py, OB3 peak.py).

A landmark is one faceted mesh whose faces sample a swatch atlas (one 16 px column a slot, four shades down it): the
plot generator's landmark path (src/shards/open-plots/generators/tiledPlotCore.mjs) reads a textured model. Each face's
shade comes from its facing (the kit's flat, faceted light), with a seeded jitter.
"""
import math

import bpy


def atlas_image(swatches, name):
    """The swatch atlas of `swatches` ({slot: four sRGB hexes, lightest first}), its columns in their order."""
    slots = list(swatches)
    cell, rows = 16, 4
    width, height = cell * len(slots), cell * rows
    img = bpy.data.images.new(name, width, height)
    px = [0.0] * (width * height * 4)
    for col, slot in enumerate(slots):
        for row, hexc in enumerate(swatches[slot]):
            rgb = [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]
            for y in range(row * cell, (row + 1) * cell):
                for x in range(col * cell, (col + 1) * cell):
                    at = ((height - 1 - y) * width + x) * 4
                    px[at:at + 4] = [*rgb, 1.0]
    img.pixels = px
    return img


def finish(p, name, rng, swatches, slot_of=None):
    """The piece as one object: flat faces, each face's UV at its slot's swatch, its shade from its facing.
    `slot_of(slot, poly)` may move a face to another slot (a peak's snow on up-facing rock)."""
    slots = list(swatches)
    mesh = bpy.data.meshes.new(name)
    p.bm.to_mesh(mesh)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    uv = mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        slot = p.slots[poly.material_index].split('.')[1]
        if slot_of is not None:
            slot = slot_of(slot, poly)
        n, c = poly.normal, poly.center
        radial = math.hypot(c.x, c.y) or 1.0
        light = 0.55 * n.z + 0.35 * (n.x * c.x + n.y * c.y) / radial + 0.25 * (-n.y) + rng.uniform(-0.25, 0.25)
        shade = 0 if light > 0.45 else 1 if light > 0.05 else 2 if light > -0.35 else 3
        u, v = (slots.index(slot) + 0.5) / len(slots), 1.0 - (shade + 0.5) / 4
        for li in poly.loop_indices:
            uv.data[li].uv = (u, v)
    return obj


def export(obj, image, path):
    """`obj` alone as a GLB on one Landmark material reading `image` (nearest texels), +Y up."""
    mat = bpy.data.materials.new('Landmark')
    mat.use_nodes = True
    nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image, tex.interpolation = image, 'Closest'
    nt.links.new(tex.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for other in bpy.context.scene.objects:
        other.select_set(other == obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_normals=True,
                              export_image_format='WEBP', export_apply=True, export_yup=True)


def triangles(obj):
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


def far_copy(near, budget):
    """`near` copied and collapsed to about `budget` triangles (its faces keep their swatch UVs)."""
    far = near.copy()
    far.data = near.data.copy()
    bpy.context.scene.collection.objects.link(far)
    dec = far.modifiers.new('far', 'DECIMATE')
    dec.ratio = min(1.0, budget / max(1, triangles(far)))
    bpy.context.view_layer.objects.active = far
    bpy.ops.object.modifier_apply(modifier='far')
    return far
