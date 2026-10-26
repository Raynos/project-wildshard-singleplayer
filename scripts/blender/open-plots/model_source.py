"""model_source.py <generated.glb> <out.glb> <faces>: reduce an image-to-3D take (TRELLIS.2 / Hunyuan3D-2, textured) to a
committed kit source: about `faces` flat triangles, each corner coloured with its face's texture colour (COLOR_0), no
texture, in game axes. kit.py reads it, decimates it to the kit's budget and sorts its faces into palette slots by
colour. Run: blender -b --factory-startup --python-exit-code 1 -P scripts/blender/open-plots/model_source.py -- a b c
"""
import os
import sys

import bmesh
import bpy
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
from glb import write_glb  # noqa: E402

src, out, faces = sys.argv[sys.argv.index('--') + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh = obj.data
ratio = min(1.0, int(faces) / max(1, len(mesh.polygons)))
mod = obj.modifiers.new('decimate', 'DECIMATE')
mod.ratio = ratio
bpy.ops.object.modifier_apply(modifier=mod.name)
bm = bmesh.new()
bm.from_mesh(obj.data)
bmesh.ops.triangulate(bm, faces=bm.faces[:])
bm.to_mesh(obj.data)
bm.free()
mesh = obj.data
# each face's colour: its material's base colour texture at the face's UV centroid (or its base colour factor)
images = []
for material in mesh.materials:
    tex = None
    if material is not None and material.use_nodes:
        for node in material.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image is not None:
                tex = node.image
                break
    if tex is not None:
        w, h = tex.size
        images.append((np.array(tex.pixels[:], dtype=np.float32).reshape(h, w, 4), None))
    else:
        factor = material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value if material else (0.5, 0.5, 0.5, 1)
        images.append((None, tuple(factor)[:3]))
uv = mesh.uv_layers.active.data if mesh.uv_layers.active else None
pos, nor, col = [], [], []
for poly in mesh.polygons:
    pixels, factor = images[poly.material_index] if images else (None, (0.5, 0.5, 0.5))
    if pixels is not None and uv is not None:
        u = sum(uv[i].uv[0] for i in poly.loop_indices) / 3
        v = sum(uv[i].uv[1] for i in poly.loop_indices) / 3
        h, w = pixels.shape[:2]
        rgb = pixels[min(h - 1, max(0, int((v % 1) * h))), min(w - 1, max(0, int((u % 1) * w)))][:3]
    else:
        rgb = factor
    n = poly.normal
    for loop in poly.loop_indices:
        c = mesh.vertices[mesh.loops[loop].vertex_index].co
        pos.append((c.x, c.z, -c.y))
        nor.append((n.x, n.z, -n.y))
        col.append(tuple(float(x) for x in rgb))
write_glb(out, [('source', {'POSITION': np.array(pos, dtype=np.float32), 'NORMAL': np.array(nor, dtype=np.float32),
                            'COLOR_0': np.array(col, dtype=np.float32), 'indices': np.arange(len(pos), dtype=np.uint32),
                            'material': 0})], materials=['source'])
print(f'model source {out}: {len(pos) // 3} triangles from {src}')
