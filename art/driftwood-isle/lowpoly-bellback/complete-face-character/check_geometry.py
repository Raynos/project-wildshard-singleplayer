"""Source construction checks before capture; no visual or motion acceptance."""
import bpy,bmesh,runpy,sys,json,hashlib
from pathlib import Path
here=Path(__file__).resolve().parent
out=here.parents[3]/'tmp/bellback-complete-face-character/source'
src=here/'build_bellback_complete.py'
sys.argv=[str(src),'--','--out',str(out)]
runpy.run_path(str(src),run_name='__main__')
rows=[]
for obj in bpy.context.scene.objects:
 if obj.type!='MESH':continue
 bm=bmesh.new();bm.from_mesh(obj.data)
 bad_edges=sum(not e.is_manifold for e in bm.edges)
 normal_edges=sum(e.is_manifold and not e.is_contiguous for e in bm.edges)
 bmesh.ops.triangulate(bm,faces=list(bm.faces))
 zero=sum(f.calc_area()<1e-10 for f in bm.faces)
 volume=bm.calc_volume(signed=True)
 rows.append(dict(name=obj.name,nonmanifold_edges=bad_edges,inconsistent_edges=normal_edges,zero_area_triangles=zero,signed_volume=volume))
 bm.free()
failed=[r for r in rows if r['nonmanifold_edges'] or r['inconsistent_edges'] or r['zero_area_triangles'] or r['signed_volume']<=0]
report=dict(status='PASS' if not failed else 'FAIL',source_sha256=hashlib.sha256(src.read_bytes()).hexdigest(),meshes=len(rows),failures=failed,components=rows,limitations='No intersection/animation/likeness acceptance; purposeful overlapping closed components')
(here/'geometry-checks.json').write_text(json.dumps(report,indent=2)+'\n')
assert not failed,failed
print('GEOMETRY PASS',len(rows))
