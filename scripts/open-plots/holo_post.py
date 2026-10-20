"""Hologram post: generated GLB -> untextured, decimated, normalised GLB.

    blender -b --python-exit-code 1 -P holo_post.py -- --in raw.glb --out holo.glb
        --tris 8000 --height 12 --yaw 0 [--min-island 0.002]

Same normalisation as localai blender_post.py (metres, +Y up, pivot at the base
centre on Y=0, front +Z after --yaw), but no UVs, no material and no bake: the
hologram shader ignores colour. Islands smaller than --min-island of the total
area (crust flakes, floaters) are dropped before the decimate.
"""
import sys, os, json, math, argparse

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--in", dest="inp", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--tris", type=int, default=8000)
ap.add_argument("--height", type=float, default=12.0)
ap.add_argument("--yaw", type=float, default=0.0)
ap.add_argument("--min-island", type=float, default=0.002)
ap.add_argument("--remesh", type=int, default=0, help="voxel remesh at max_dim/N first (0 = off)")
ap.add_argument("--weld", type=float, default=0.0, help="merge-by-distance as a fraction of height (0 = 1e-5)")
a = ap.parse_args(argv)

import bpy, bmesh
from mathutils import Matrix

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.inp)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in bpy.context.scene.objects:
    o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
mw = ob.matrix_world.copy()
ob.parent = None
ob.data.transform(mw)
ob.matrix_world = Matrix.Identity(4)
for o in list(bpy.context.scene.objects):
    if o != ob:
        bpy.data.objects.remove(o)

def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)

src = tris(ob)
bm = bmesh.new(); bm.from_mesh(ob.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=(a.weld or 1e-5) * max(ob.dimensions))
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6 * max(ob.dimensions))
# drop small islands
bm.faces.ensure_lookup_table()
total = sum(f.calc_area() for f in bm.faces)
seen = set(); islands = []
for f in bm.faces:
    if f.index in seen:
        continue
    stack = [f]; isl = []; seen.add(f.index)
    while stack:
        g = stack.pop(); isl.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen:
                    seen.add(h.index); stack.append(h)
    islands.append(isl)
drop = [isl for isl in islands if sum(g.calc_area() for g in isl) < a.min_island * total]
dropped_faces = sum(len(i) for i in drop)
bmesh.ops.delete(bm, geom=[g for isl in drop for g in isl], context="FACES")
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context="VERTS")
bm.to_mesh(ob.data); bm.free()
clean = tris(ob)

if a.remesh > 0:
    # TRELLIS's crust is open and non-manifold, so collapse decimation stalls
    # (388k -> 194k asked 20k). A voxel remesh closes it first; the hologram
    # has no texture to lose.
    rm = ob.modifiers.new("remesh", "REMESH")
    rm.mode = "VOXEL"; rm.voxel_size = max(ob.dimensions) / a.remesh
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier="remesh")
    clean = tris(ob)
    print(f"[holo] remesh {a.remesh}: {clean} tris")

if clean > a.tris:
    m = ob.modifiers.new("dec", "DECIMATE")
    m.decimate_type = "COLLAPSE"; m.ratio = a.tris / clean; m.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier="dec")
ob.data.transform(Matrix.Rotation(math.radians(a.yaw), 4, "Z"))
co = [v.co for v in ob.data.vertices]
zmin = min(c.z for c in co); zmax = max(c.z for c in co)
s = a.height / max(zmax - zmin, 1e-6)
cx = (min(c.x for c in co) + max(c.x for c in co)) / 2
cy = (min(c.y for c in co) + max(c.y for c in co)) / 2
ob.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -zmin)))
ob.data.update()

for o in bpy.context.scene.objects:
    o.select_set(o == ob)
bpy.context.view_layer.objects.active = ob
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
while ob.data.uv_layers:
    ob.data.uv_layers.remove(ob.data.uv_layers[0])
for attr in list(ob.data.color_attributes):
    ob.data.color_attributes.remove(attr)
ob.data.materials.clear()
ob.name = ob.data.name = os.path.splitext(os.path.basename(a.out))[0]
bpy.ops.export_scene.gltf(filepath=a.out, export_format="GLB", use_selection=True,
                          export_yup=True, export_apply=True, export_materials="NONE",
                          export_normals=True, export_texcoords=False)
d = ob.dimensions
rep = {"src_tris": src, "islands": len(islands), "islands_dropped": len(drop),
       "faces_dropped": dropped_faces, "clean_tris": clean, "tris": tris(ob),
       "size_m": [round(d.x, 2), round(d.z, 2), round(d.y, 2)], "bytes": os.path.getsize(a.out)}
json.dump(rep, open(a.out + ".json", "w"), indent=1)
print("[holo]", a.out, json.dumps(rep))
