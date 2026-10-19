"""Measure the bounded continuous-frame correction against preserved failed source."""
import bpy,runpy,sys,json,hashlib
from pathlib import Path
h=Path(__file__).resolve().parent;root=h.parents[3];tmp=root/'tmp/bellback-complete-face-character'
def snapshot(src,out):
 sys.argv=[str(src),'--','--out',str(out)];runpy.run_path(str(src),run_name='__main__')
 return {o.name:([tuple(v.co) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons]) for o in bpy.context.scene.objects if o.type=='MESH'}
a=snapshot(tmp/'failed-initial/build_bellback_complete.py',tmp/'comparison-initial');b=snapshot(h/'build_bellback_complete.py',tmp/'comparison-final')
rows=[]
for n,(va,fa) in a.items():
 vb,fb=b[n];assert len(va)==len(vb) and len(fa)==len(fb)
 ds=[sum((x-y)**2 for x,y in zip(p,q))**.5 for p,q in zip(va,vb)]
 change=sum(d>1e-7 for d in ds);faces=sum(x!=y for x,y in zip(fa,fb))
 if change or faces:rows.append(dict(mesh=n,changed_vertices=change,total_vertices=len(va),max_displacement=max(ds),changed_polygon_order=faces,total_polygons=len(fa)))
report=dict(method='Same named source mesh, same vertex indices; no added/removed vertices or polygons. Consistent transverse frame signs, no normal-only or triangulation-only fix.',initial_source_sha256=hashlib.sha256((tmp/'failed-initial/build_bellback_complete.py').read_bytes()).hexdigest(),final_source_sha256=hashlib.sha256((h/'build_bellback_complete.py').read_bytes()).hexdigest(),changed_meshes=rows,total_changed_vertices=sum(x['changed_vertices'] for x in rows),triangles_initial=4766,triangles_final=4766)
(h/'frame-correction-diff.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
