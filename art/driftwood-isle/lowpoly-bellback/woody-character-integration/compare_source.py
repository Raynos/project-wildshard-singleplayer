"""Exact indexed source points and normals; repair separated from art revision."""
import bpy,runpy,sys,json,hashlib
from pathlib import Path
h=Path(__file__).resolve().parent;root=h.parents[3];tmp=root/'tmp/bellback-woody-character-integration'
def snapshot(src,label):
 sys.argv=[str(src),'--','--out',str(tmp/('diff-'+label))];runpy.run_path(str(src),run_name='__main__')
 return {o.name:{'vertices':[list(v.co) for v in o.data.vertices],'vertex_normals':[list(v.normal) for v in o.data.vertices],'polygons':[list(p.vertices) for p in o.data.polygons],'polygon_normals':[list(p.normal) for p in o.data.polygons],'parent':o.parent.name} for o in bpy.context.scene.objects if o.type=='MESH'}
def difference(a,b):
 rows=[]
 for name in sorted(a.keys()&b.keys()):
  row={'mesh':name};changed=False
  for field in ['vertices','vertex_normals','polygons','polygon_normals']:
   av,bv=a[name][field],b[name][field]
   if av!=bv:
    changed=True
    if len(av)==len(bv):row[field]=[{'index':i,'before':x,'after':y} for i,(x,y) in enumerate(zip(av,bv)) if x!=y]
    else:row[field]={'before':av,'after':bv}
  if changed:rows.append(row)
 return {'changed_meshes':rows,'removed_meshes':sorted(a.keys()-b.keys()),'added_meshes':{n:b[n] for n in sorted(b.keys()-a.keys())},'unchanged_meshes':sorted(n for n in a.keys()&b.keys() if a[n]==b[n]),'parent_changes':[n for n in a.keys()&b.keys() if a[n]['parent']!=b[n]['parent']]}
paths=[h.parent/'complete-pass3/build_bellback_complete.py',h/'frame_only_pass3.py',h/'build_bellback_complete.py']
a,b,c=[snapshot(p,label) for p,label in zip(paths,['retained','frame','final'])]
r={'method':'Exact same-index Blender local coordinates and vertex/polygon normals, before and after. No tolerance or normal-only concealment. Frame stage retains polygon indices and counts. Art stage explicitly lists mesh topology replacements.','source_hashes':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},'frame_repair':difference(a,b),'art_revision':difference(b,c)}
assert not r['frame_repair']['removed_meshes'] and not r['frame_repair']['added_meshes']
assert all('polygons' not in x for x in r['frame_repair']['changed_meshes'])
assert not r['art_revision']['parent_changes']
(h/'exact-source-diff.json').write_text(json.dumps(r,indent=2)+'\n')
print('SOURCE DIFF',len(r['frame_repair']['changed_meshes']),len(r['art_revision']['changed_meshes']))
