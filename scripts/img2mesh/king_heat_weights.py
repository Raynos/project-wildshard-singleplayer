"""Bone-heat skin weights for the Antler King's own rig (E322 F-M1), called by scripts/king-rig-bake.mjs.

  blender -b --factory-startup --python-exit-code 1 -P scripts/img2mesh/king_heat_weights.py -- <in.json> <out.json>

<in.json>: {"positions": [x,y,z,…] (the hull welded: one vertex per surface point, glTF y-up metres), "tris": [a,b,c,…],
"bones": [{"name", "parent", "head": [x,y,z], "tail": [x,y,z]}, …]}. Builds the mesh and an armature of those bones
(heads at the joints, tails at the segment ends, connected where a tail is its child's head), parents the mesh with
automatic weights (Blender's bone heat: weights diffused through the surface from each bone, so a thick torso's belly
takes the spine and not the nearest thigh) and writes <out.json>: {"weights": [[[bone index, weight], …] per vertex],
"unweighted": n}. Nothing is exported or saved; the bake writes the GLB.
"""
import json
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]
d = json.load(open(src))

bpy.ops.wm.read_factory_settings(use_empty=True)
P = d["positions"]
# glTF y-up → Blender z-up: (x, y, z) → (x, −z, y)
verts = [(P[i], -P[i + 2], P[i + 1]) for i in range(0, len(P), 3)]
T = d["tris"]
faces = [(T[i], T[i + 1], T[i + 2]) for i in range(0, len(T), 3)]
me = bpy.data.meshes.new("hull")
me.from_pydata(verts, [], faces)
me.update()
ob = bpy.data.objects.new("hull", me)
bpy.context.scene.collection.objects.link(ob)

arm_data = bpy.data.armatures.new("rig")
arm = bpy.data.objects.new("rig", arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
conv = lambda p: Vector((p[0], -p[2], p[1]))
eb = {}
for b in d["bones"]:
    e = arm_data.edit_bones.new(b["name"])
    e.head = conv(b["head"])
    e.tail = conv(b["tail"])
    if (e.tail - e.head).length < 1e-3:
        e.tail = e.head + Vector((0, 0, 0.05))
    eb[b["name"]] = e
for b in d["bones"]:
    if b["parent"]:
        eb[b["name"]].parent = eb[b["parent"]]
bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

names = [b["name"] for b in d["bones"]]
gi = {g.index: names.index(g.name) for g in ob.vertex_groups if g.name in names}
weights, unweighted = [], 0
for v in me.vertices:
    w = [[gi[g.group], round(g.weight, 6)] for g in v.groups if g.group in gi and g.weight > 1e-5]
    if not w:
        unweighted += 1
    weights.append(w)
json.dump({"weights": weights, "unweighted": unweighted}, open(out, "w"))
print("KING_HEAT", len(weights), "vertices", unweighted, "unweighted")
