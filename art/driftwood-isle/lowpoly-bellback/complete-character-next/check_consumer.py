"""Actual Blender glTF consumer round-trip; static export, never runtime acceptance."""
import bpy,json,hashlib,sys
from pathlib import Path
H=Path(__file__).resolve().parent
p=H/'bellback-complete-character-next.glb'
source=json.loads((H/'native-geometry.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(p))
bpy.context.view_layer.update()
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
from mathutils import Matrix,Vector
expected={o['name']:o for o in source};fail=[];rows=[]
for o in objects:
 o.data.calc_loop_triangles();s=expected[o.name];m=Matrix(s['matrix_world'])
 original=[m@Vector(v) for v in s['vertices']];actual=[o.matrix_world@v.co for v in o.data.vertices]
 # Export splits sharp corners, so compare nearest actual positions in both directions.
 error=max(max(min((a-b).length for b in actual) for a in original),max(min((a-b).length for b in original) for a in actual))
 row=dict(name=o.name,triangles=len(o.data.loop_triangles),max_position_error=error,materials=len(o.data.materials));rows.append(row)
 if error>1e-5:fail.append(row)
assert set(expected)=={o.name for o in objects}
report=dict(status='PASS' if not fail else 'FAIL',consumer='Blender 4.3.2 actual glTF importer',glb_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),meshes=len(objects),triangles=sum(r['triangles'] for r in rows),max_position_error=max(r['max_position_error'] for r in rows),armatures=sum(o.type=='ARMATURE' for o in bpy.context.scene.objects),failures=fail,components=rows,limits='Actual importer preserves static source positions and full model. No game, motion, skin or physics acceptance.')
(H/'consumer-checks.json').write_text(json.dumps(report,indent=2)+'\n')
assert not fail
print('CONSUMER PASS',report['meshes'],report['triangles'],report['max_position_error'])
