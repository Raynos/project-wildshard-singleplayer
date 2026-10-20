"""Exact source-native triangle winding and semantic groups through real glTF import."""
import bpy, json, hashlib
from pathlib import Path
from collections import Counter
from mathutils import Vector
H=Path(__file__).resolve().parent;R=H.parents[3]
P=H/'bellback-complete-wreck-anatomy.glb'
N=R/'tmp/bellback-complete-wreck-anatomy/candidate-exact-mesh.json'
expected={r['name']:r for r in json.loads(N.read_text())}
source={r['name']:r for r in json.loads((H/'native-geometry.json').read_text())}
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(P));bpy.context.view_layer.update()
def oriented(t):
 return min(tuple(t[i:]+t[:i]) for i in range(3))
rows=[];failures=[]
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 e=expected[o.name];s=source[o.name];original=[Vector(v) for v in e['vertices']]
 mapping=[];err=0
 for v in o.data.vertices:
  p=o.matrix_world@v.co
  distances=[(p-q).length for q in original];idx=min(range(len(distances)),key=distances.__getitem__)
  err=max(err,distances[idx]);mapping.append(idx)
 o.data.calc_loop_triangles()
 actual=Counter(oriented([mapping[i] for i in t.vertices]) for t in o.data.loop_triangles)
 native=Counter(oriented(list(t)) for t in e['triangles'])
 # Exact topology may have coincident distinct source indices: these sources
 # are manifold and audited, but retain the diagnostic rather than discarding it.
 parent=o.parent.name if o.parent else None
 matnames=[m.name for m in o.data.materials]
 row=dict(name=o.name,source_triangles=sum(native.values()),imported_triangles=sum(actual.values()),missing_triangles=sum((native-actual).values()),extra_triangles=sum((actual-native).values()),max_vertex_error=err,parent_matches=parent==s['parent'],material_names_match=set(matnames)==set(s['materials']))
 rows.append(row)
 if actual!=native or err>1e-5 or not row['parent_matches'] or not row['material_names_match']:failures.append(row)
assert set(expected)=={r['name'] for r in rows}
report=dict(status='PASS' if not failures else 'FAIL',glb_sha256=hashlib.sha256(P.read_bytes()).hexdigest(),native_triangles_sha256=hashlib.sha256(N.read_bytes()).hexdigest(),meshes=len(rows),triangles=sum(r['source_triangles'] for r in rows),max_vertex_error=max(r['max_vertex_error'] for r in rows),failures=failures,components=rows,scope='Actual Blender glTF importer, mapped to source-native vertices; exact oriented triangle multisets, semantic parent and material-name sets. Static geometry only, no game or physics claim.')
(H/'exact-topology-parity.json').write_text(json.dumps(report,indent=2)+'\n');print(report['status'],report['meshes'],report['triangles'],report['max_vertex_error']);assert not failures,failures
