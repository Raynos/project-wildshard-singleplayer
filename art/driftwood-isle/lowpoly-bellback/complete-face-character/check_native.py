"""Validate exported triangle area and normals directly from GLB accessors."""
import json,math,struct,hashlib
from pathlib import Path
h=Path(__file__).resolve().parent;p=h/'bellback-complete-face-character.glb';r=p.read_bytes();n=struct.unpack_from('<I',r,12)[0];d=json.loads(r[20:20+n]);b=r[28+n:]
def values(i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];fmt='<'+{5126:'f',5123:'H',5125:'I'}[a['componentType']]*{'VEC3':3,'SCALAR':1}[a['type']];width=struct.calcsize(fmt);start=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from(fmt,b,start+j*v.get('byteStride',width)) for j in range(a['count'])]
count=0;bad=[];minarea=float('inf');mindot=float('inf')
for m in d['meshes']:
 for p in m['primitives']:
  pos=values(p['attributes']['POSITION']);norm=values(p['attributes']['NORMAL']);ix=[x[0] for x in values(p['indices'])]
  for k in range(0,len(ix),3):
   a,c,e=[pos[ix[k+j]] for j in range(3)];u=[c[j]-a[j] for j in range(3)];v=[e[j]-a[j] for j in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];area=math.sqrt(sum(x*x for x in cross))/2;minarea=min(minarea,area)
   dots=[sum(cross[j]*norm[ix[k+i]][j] for j in range(3)) for i in range(3)];mindot=min(mindot,*dots)
   if area<=1e-10 or min(dots)<=0:bad.append([m['name'],k//3,area,dots])
   count+=1
report=dict(status='PASS' if not bad else 'FAIL',glb_sha256=hashlib.sha256(r).hexdigest(),triangles=count,min_triangle_area=minarea,min_geometric_normal_dot=mindot,failures=bad)
(h/'native-geometry-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(report);assert not bad
