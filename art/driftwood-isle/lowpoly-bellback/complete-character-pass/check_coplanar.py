"""All within-component coplanar triangle overlap, including shared vertices/edges."""
import json,math
from pathlib import Path
H=Path(__file__).resolve().parent;R=H.parents[3]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def ori(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def overlap(a,b):
 normal=cross(sub(a[1],a[0]),sub(a[2],a[0]));length=math.sqrt(dot(normal,normal))
 if max(abs(dot(normal,sub(p,a[0]))) for p in b)>length*1e-8:return 0
 drop=max(range(3),key=lambda k:abs(normal[k]));project=lambda p:[x for k,x in enumerate(p) if k!=drop]
 subject=list(map(project,a));clip=list(map(project,b));sign=1 if ori(*clip)>0 else -1
 for v,w in zip(clip,clip[1:]+clip[:1]):
  old=subject;subject=[]
  if not old:break
  for p,q in zip(old,old[1:]+old[:1]):
   dp=sign*ori(v,w,p);dq=sign*ori(v,w,q)
   if dp>=0:subject.append(p)
   if (dp<0)!=(dq<0):subject.append([p[k]+(q[k]-p[k])*dp/(dp-dq) for k in range(2)])
 return abs(sum(p[0]*q[1]-p[1]*q[0] for p,q in zip(subject,subject[1:]+subject[:1])))/2 if subject else 0
# Native triangulation saved by Blender intersection auditor, not a replacement triangulator.
result={}
for role in ['baseline','candidate']:
 meshes=json.loads((R/f'tmp/bellback-complete-character-pass/{role}-exact-mesh.json').read_text());hits=[]
 for obj in meshes:
  ts=[[obj['vertices'][k] for k in tri] for tri in obj['triangles']]
  for i,a in enumerate(ts):
   for j,b in enumerate(ts[:i]):
    if any(max(p[k] for p in a)<min(p[k] for p in b)-1e-9 or max(p[k] for p in b)<min(p[k] for p in a)-1e-9 for k in range(3)):continue
    area=overlap(a,b)
    if area>1e-9:hits.append(dict(name=obj['name'],triangles=[i,j],projected_overlap_area=area))
 result[role]=dict(coplanar_positive_area_overlaps=hits)
result['status']='PASS' if not result['candidate']['coplanar_positive_area_overlaps'] else 'FAIL'
(H/'coplanar-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(result['status'],{k:len(result[k]['coplanar_positive_area_overlaps']) for k in ['baseline','candidate']})
