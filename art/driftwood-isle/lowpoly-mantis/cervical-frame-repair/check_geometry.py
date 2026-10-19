"""Independent stdlib geometry delta / GLB triangle audit, without adapter imports."""
import ast
from collections import Counter
import hashlib
import importlib.util
import json
import math
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
spec=importlib.util.spec_from_file_location('independent',ROOT/'docs/reviews/mantis-curved-normal-diagnosis/diagnose.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
NAME='Rising prothorax curved cervical arch'
def read(p):return json.loads(p.read_text())
def profile(path):
 tree=ast.parse(path.read_text())
 return next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='neck' for t in n.targets))
def triangles(path,parts):
 doc,buf=g.glb_read(path);out=[]
 for node in doc['nodes']:
  if 'mesh' not in node:continue
  src=parts[node['name']];points=list(map(g.game,src['vertices']))
  for primitive in doc['meshes'][node['mesh']]['primitives']:
   pos=g.accessor(doc,buf,primitive['attributes']['POSITION']);ids=[i[0] for i in g.accessor(doc,buf,primitive['indices'])]
   for k in range(0,len(ids),3):
    ps=[pos[i] for i in ids[k:k+3]];vs=[points.index(p) for p in ps]
    out.append(dict(name=node['name'],ids=vs,points=ps))
 return out
# Inclusive non-coplanar segment/triangle test. Shared-topology pairs excluded below.
def segment(a,b,t):
 e1=g.sub(t[1],t[0]);e2=g.sub(t[2],t[0]);d=g.sub(b,a);h=g.cross(d,e2);det=g.dot(e1,h)
 if abs(det)<1e-12:return False
 s=g.sub(a,t[0]);u=g.dot(s,h)/det;q=g.cross(s,e1);v=g.dot(d,q)/det;f=g.dot(e2,q)/det
 return -1e-9<=u and -1e-9<=v and u+v<=1+1e-9 and -1e-9<=f<=1+1e-9

def orient(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def inside(p,t):
 o=[orient(a,b,p) for a,b in zip(t,t[1:]+t[:1])]
 return min(o)>=-1e-10 or max(o)<=1e-10

def intersects(a,b):
 if any(max(p[k] for p in a)<min(p[k] for p in b)-1e-9 or max(p[k] for p in b)<min(p[k] for p in a)-1e-9 for k in range(3)):return False
 n=g.unit(g.facet(a))
 if max(abs(g.dot(n,g.sub(p,a[0]))) for p in b)<1e-9:
  drop=max(range(3),key=lambda k:abs(n[k]));a=[[v for k,v in enumerate(p) if k!=drop] for p in a];b=[[v for k,v in enumerate(p) if k!=drop] for p in b]
  if any(inside(p,b) for p in a) or any(inside(p,a) for p in b):return True
  return any(orient(p,q,r)*orient(p,q,s)<-1e-20 and orient(r,s,p)*orient(r,s,q)<-1e-20 for p,q in zip(a,a[1:]+a[:1]) for r,s in zip(b,b[1:]+b[:1]))
 return any(segment(p,q,b) for p,q in zip(a,a[1:]+a[:1])) or any(segment(p,q,a) for p,q in zip(b,b[1:]+b[:1]))

def main():
 olddir=HERE.parent/'complete-pass2'
 old=read(olddir/'mantis-mesh-complete-pass2.json');new=read(HERE/'mantis-mesh-cervical-frame-repair.json');oldp={p['name']:p for p in old['parts']};newp={p['name']:p for p in new['parts']}
 changes=[]
 assert old.keys()==new.keys() and old['coordinateFrame']==new['coordinateFrame']
 for a,b in zip(old['parts'],new['parts']):
  assert a.keys()==b.keys()
  for key in a:
   if key!='vertices':assert a[key]==b[key],(a['name'],key)
  for i,(p,q) in enumerate(zip(a['vertices'],b['vertices'])):
   if p!=q:changes.append(dict(object=a['name'],vertex=i,before=p,after=q,displacement=g.norm(g.sub(p,q))))
 assert [(r['object'],r['vertex']) for r in changes]==[(NAME,i) for i in range(42,49)]
 prof=profile(HERE/'build_mantis_complete.py');assert prof==profile(olddir/'build_mantis_complete.py')
 assert read(HERE/'metrics-cervical-frame-repair.json')==read(olddir/'metrics-complete-pass2.json')
 # Separate test_frame_blender.py executes the actual candidate loft AST.
 # Algebraic reference independently verifies generated terminal vertices and all radii.
 frames=[]
 for j,(p,w,d) in enumerate(prof):
  t=g.unit(g.sub(prof[min(j+1,6)][0],prof[max(j-1,0)][0]));u=g.cross(t,[0,1,0])
  if g.norm(u)<.01:u=g.cross(t,[0,0,1])
  if frames:
   if g.norm(g.cross(t,[0,1,0]))<.01:u=g.sub(frames[-1]['u'],[v*g.dot(frames[-1]['u'],t) for v in t])
   if g.dot(u,frames[-1]['u'])<0:u=[-v for v in u]
  u=g.unit(u);v=g.unit(g.cross(t,u));frames.append(dict(station=j,t=t,u=u,v=v,center=p,width=w,depth=d))
  for i in range(7):
   expect=[p[k]+u[k]*w*math.cos(math.tau*i/7)+v[k]*d*math.sin(math.tau*i/7) for k in range(3)]
   assert g.norm(g.sub(expect,newp[NAME]['vertices'][7*j+i]))<3e-7
 assert all(g.dot(a['u'],b['u'])>.999 for a,b in zip(frames,frames[1:]))
 tris=triangles(HERE/'mantis-study-cervical-frame-repair.glb',newp);neck=[t for t in tris if t['name']==NAME]
 areas=[g.norm(g.facet(t['points']))/2 for t in tris];assert min(areas)>1e-10
 edges=Counter((a,b) for t in neck for a,b in zip(t['ids'],t['ids'][1:]+t['ids'][:1]));assert all(v==1 and edges[(b,a)]==1 for (a,b),v in edges.items())
 self_hits=[(i,j) for i,a in enumerate(neck) for j,b in enumerate(neck[:i]) if not set(a['ids'])&set(b['ids']) and intersects(a['points'],b['points'])];assert not self_hits,self_hits
 affected=[i for i,f in enumerate(newp[NAME]['faces']) if set(f)&set(range(42,49))]
 diagonal=[]
 for fi in affected:
  f=newp[NAME]['faces'][fi]
  if len(f)!=4:continue
  ps=[newp[NAME]['vertices'][i] for i in f];pn=g.newell(ps)
  for diag in [[(0,1,2),(0,2,3)],[(0,1,3),(1,2,3)]]:
   ns=[g.unit(g.facet([ps[i] for i in t])) for t in diag];diagonal.append(dict(polygon=fi,minimumCosine=min(g.dot(pn,n) for n in ns),mutualCosine=g.dot(*ns)))
 assert min(d['minimumCosine'] for d in diagonal)>.999
 outward=[]
 for tri in neck:
  stations=[i//7 for i in tri['ids']];ps=tri['points'];fn=g.unit(g.facet(ps))
  if min(stations)==max(stations):
   j=stations[0];direction=g.game(frames[j]['t']);direction=[x*(1 if j==6 else -1) for x in direction]
  else:
   center=[sum(g.game(prof[j][0])[k] for j in stations)/3 for k in range(3)]
   centroid=[sum(p[k] for p in ps)/3 for k in range(3)];direction=g.unit(g.sub(centroid,center))
  outward.append(g.dot(fn,direction))
 assert min(outward)>0
 volume=sum(g.dot(t['points'][0],g.cross(t['points'][1],t['points'][2]))/6 for t in neck);assert volume>0
 # All object/object intersections incident to changed span: report, never pretend layered anatomy is disjoint.
 cross_results={}
 for label,ts in [('before',triangles(olddir/'mantis-study-complete-pass2.glb',oldp)),('after',tris)]:
  changed=[t for t in ts if t['name']==NAME and set(t['ids'])&set(range(42,49))]
  hits=Counter(b['name'] for a in changed for b in ts if b['name']!=NAME and intersects(a['points'],b['points']))
  cross_results[label]=dict(hits)
 result=dict(status='PASS_LOCAL_REPAIR',changedVertices=changes,maxDisplacement=max(r['displacement'] for r in changes),affectedPolygons=affected,frames=frames,minimumTriangleArea=min(areas),neckTriangleCount=len(neck),neckSignedVolume=volume,minimumNeckOutwardCosine=min(outward),nonAdjacentNeckSelfIntersections=self_hits,terminalQuadBothDiagonals=diagonal,minimumCrossSectionSupportThickness=min(2*min(w,d)*math.cos(math.pi/7) for _,w,d in prof),crossObjectIncidentTriangleIntersections=cross_results,limits='Cross-object layered anatomical overlap is reported, not accepted as contact/articulation. No visual or motion approval. Shared-vertex triangle pairs excluded from self-intersection scan; exact frame/radius and both-diagonal tests cover terminal adjacent panels.')
 (HERE/'geometry-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['changedVertices','frames','terminalQuadBothDiagonals']},indent=2))
if __name__=='__main__':main()
