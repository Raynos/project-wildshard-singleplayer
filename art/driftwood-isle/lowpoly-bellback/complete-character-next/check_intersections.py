"""Exact native triangles: proper crossings including shared vertices, plus inclusive nonadjacent tests."""
import bpy,runpy,sys,json,hashlib,importlib.util
from pathlib import Path
from collections import Counter
import numpy as np
H=Path(__file__).resolve().parent;R=H.parents[3];T=R/'tmp/bellback-complete-character-next'
def module(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
x=module('inclusive',R/'art/driftwood-isle/lowpoly-mantis/cervical-frame-repair/check_geometry.py')
p=module('proper',R/'art/driftwood-isle/puffer-complete-remaster/local-surface-repair/intersections.py')
results={}
for role,src in [('baseline',H.parent/'complete-character-pass/build_bellback_complete.py'),('candidate',H/'build_bellback_complete.py')]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 sys.argv=[str(src),'--','--out',str(T/'audit'/role)];runpy.run_path(str(src),run_name='__main__');bpy.context.view_layer.update();ts=[];meshes=[]
 for obj in bpy.context.scene.objects:
  if obj.type!='MESH':continue
  obj.data.calc_loop_triangles();verts=[list(obj.matrix_world@v.co) for v in obj.data.vertices]
  meshes.append(dict(name=obj.name,vertices=verts,triangles=[list(t.vertices) for t in obj.data.loop_triangles],polygons=[list(f.vertices) for f in obj.data.polygons],polygon_normals=[list(f.normal) for f in obj.data.polygons]))
  for tri in obj.data.loop_triangles:
   pts=[verts[i] for i in tri.vertices];ts.append(dict(name=obj.name,ids=list(tri.vertices),points=pts,lo=[min(v[k] for v in pts) for k in range(3)],hi=[max(v[k] for v in pts) for k in range(3)]))
 (T/f'{role}-exact-mesh.json').write_text(json.dumps(meshes,separators=(',',':')))
 ts.sort(key=lambda t:t['lo'][0]);active=[];cross=Counter();selfhits=[];proper=[];tested=0
 for a in ts:
  active=[b for b in active if b['hi'][0]>=a['lo'][0]-1e-9]
  for b in active:
   if any(a['hi'][k]<b['lo'][k]-1e-9 or b['hi'][k]<a['lo'][k]-1e-9 for k in [1,2]):continue
   tested+=1
   if a['name']==b['name']:
    q=p.crossing(np.array(a['points']),np.array(b['points']))
    if q:proper.append(dict(name=a['name'],a=a['ids'],b=b['ids'],**q))
    if set(a['ids'])&set(b['ids']):continue
    if x.intersects(a['points'],b['points']):selfhits.append(dict(name=a['name'],a=a['ids'],b=b['ids']))
   elif x.intersects(a['points'],b['points']):cross[' | '.join(sorted([a['name'],b['name']]))]+=1
  active.append(a)
 results[role]=dict(source_sha256=hashlib.sha256(src.read_bytes()).hexdigest(),tested=tested,nonadjacent_self_intersections=selfhits,proper_self_crossings_including_adjacent=proper,cross_object_triangle_pairs=sum(cross.values()),cross_object_pairs=dict(sorted(cross.items())))
results['limitations']='Actual native triangulation tested, including coplanar nonadjacent contacts and proper shared-vertex crossings. Component overlaps inventoried, not contact/physics approval. Adjacent coplanar positive-area overlap is checked separately by check_coplanar.py.'
results['status']='PASS_SELF' if not results['candidate']['nonadjacent_self_intersections'] and not results['candidate']['proper_self_crossings_including_adjacent'] else 'FAIL_SELF'
(H/'intersection-audit.json').write_text(json.dumps(results,indent=2)+'\n');print(results['status'],{k:(len(results[k]['nonadjacent_self_intersections']),len(results[k]['proper_self_crossings_including_adjacent']),results[k]['cross_object_triangle_pairs']) for k in ['baseline','candidate']})
