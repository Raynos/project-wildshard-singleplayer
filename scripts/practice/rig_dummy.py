"""Orient and skin one TRELLIS training dummy while preserving its baked PBR material.

blender -b -P scripts/practice/rig_dummy.py -- <source.glb> <rigged.glb>

The source is an upright one metre TRELLIS figure facing +X. The game needs a
2.65 m figure facing +Z, with its stand at ground level. The five spatially
weighted bones give a readable hit reaction without rebaking the source UVs.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector


source, target = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if len(meshes) != 1:
    raise RuntimeError(f"Expected one textured TRELLIS mesh, got {len(meshes)}")
mesh = meshes[0]
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Blender axes: source front +X, up +Z. Rotate the geometry to front -Y;
# glTF maps Blender -Y to Three.js +Z. Transform the actual vertices so the
# armature and exported bounds share a simple local frame.
rot = Matrix.Rotation(-math.pi / 2, 4, "Z")
height = 2.65
for vertex in mesh.data.vertices:
    p = rot @ vertex.co
    vertex.co = Vector((p.x * height, p.y * height, (p.z + 0.5) * height))
mesh.name = "Training dummy · textured figure"

arm_data = bpy.data.armatures.new("Training dummy armature")
arm = bpy.data.objects.new("Training dummy rig", arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")


def bone(name, head, tail, parent=None):
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent is not None:
        b.parent = arm_data.edit_bones[parent]
    return b


bone("Root", (0, 0, 0.04), (0, 0, 1.32))
bone("Torso", (0, 0, 1.32), (0, 0, 2.13), "Root")
bone("Head", (0, 0, 2.13), (0, 0, 2.57), "Torso")
bone("LeftArm", (-0.43, 0, 1.99), (-0.66, 0, 1.22), "Torso")
bone("RightArm", (0.43, 0, 1.99), (0.66, 0, 1.22), "Torso")
bpy.ops.object.mode_set(mode="OBJECT")

groups = {name: mesh.vertex_groups.new(name=name) for name in ("Root", "Torso", "Head", "LeftArm", "RightArm")}


def ramp(x, lo, hi):
    return max(0.0, min(1.0, (x - lo) / (hi - lo)))


for vertex in mesh.data.vertices:
    x, _y, z = vertex.co
    torso = ramp(z, 1.17, 1.42)
    head = torso * ramp(z, 2.06, 2.23) * (1.0 - ramp(abs(x), 0.29, 0.47))
    arm_weight = torso * (1.0 - ramp(z, 2.19, 2.35)) * ramp(abs(x), 0.31, 0.48)
    left = arm_weight if x < 0 else 0.0
    right = arm_weight if x >= 0 else 0.0
    body = torso * (1.0 - head) * (1.0 - arm_weight)
    weights = {"Root": 1.0 - torso, "Torso": body, "Head": head, "LeftArm": left, "RightArm": right}
    total = sum(weights.values())
    if total <= 0:
        raise RuntimeError("Zero weight at vertex")
    for name, weight in weights.items():
        if weight > 0.001:
            groups[name].add([vertex.index], weight / total, "REPLACE")

mesh.parent = arm
mod = mesh.modifiers.new("Five-bone hit reaction", "ARMATURE")
mod.object = arm
arm.display_type = "WIRE"
os.makedirs(os.path.dirname(target), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=target, export_format="GLB", export_apply=False, export_animations=False, export_yup=True)
print(f"Rigged {source} -> {target}; {len(mesh.data.vertices)} vertices; {len(mesh.data.polygons)} faces")
