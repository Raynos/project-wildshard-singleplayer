"""Read-only geometric closure audit of an actual exported Conch GLB."""
import argparse,collections,json,math,struct
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('glb');p.add_argument('--out',required=True);a=p.parse_args()
b=Path(a.glb).read_bytes();length,kind=struct.unpack_from('<II',b,12);g=json.loads(b[20:20+length]);offset=20+length;bl,typ=struct.unpack_from('<II',b,offset);data=b[offset+8:offset+8+bl]
def accessor(index):
 ac=g['accessors'][index];v=g['bufferViews'][ac['bufferView']];formats={5126:'f',5125:'I',5123:'H',5121:'B'};fmt=formats[ac['componentType']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[ac['type']];size=struct.calcsize(fmt)*n;stride=v.get('byteStride',size);start=v.get('byteOffset',0)+ac.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*n,data,start+i*stride) for i in range(ac['count'])]

import hashlib
results=[];worst=1.;count=0
for mesh in g['meshes']:
 deviations=[];volume=0.;oriented=collections.Counter()
 for prim in mesh['primitives']:
  ps=accessor(prim['attributes']['POSITION']);ns=accessor(prim['attributes']['NORMAL']);ids=[v[0] for v in accessor(prim['indices'])]
  for j in range(0,len(ids),3):
   ix=ids[j:j+3];pts=[ps[k] for k in ix];aa,bb,cc=pts
   u=[bb[k]-aa[k] for k in range(3)];v=[cc[k]-aa[k] for k in range(3)]
   cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];mag=math.sqrt(sum(x*x for x in cross))
   dots=[sum(cross[k]*ns[q][k] for k in range(3))/mag for q in ix] if mag>1e-12 else [-1]*3
   worst=min(worst,*dots);count+=1
   if min(dots)<.999:deviations.append({'triangle':j//3,'cosines':dots})
   volume+=(aa[0]*(bb[1]*cc[2]-bb[2]*cc[1])+aa[1]*(bb[2]*cc[0]-bb[0]*cc[2])+aa[2]*(bb[0]*cc[1]-bb[1]*cc[0]))/6
   pts=[tuple(round(x,6) for x in pt) for pt in pts]
   for a1,b1 in zip(pts,pts[1:]+pts[:1]):oriented[(a1,b1)]+=1
 bad=sum(n!=oriented[(b1,a1)] for (a1,b1),n in oriented.items())
 results.append({'mesh':mesh['name'],'normalFacetDeviations':deviations,'inconsistentDirectedEdges':bad,'signedVolume':volume})
report={'glbSha256':hashlib.sha256(b).hexdigest(),'triangles':count,'minimumFacetNormalCosine':worst,'meshes':results,'passed':all(not m['normalFacetDeviations'] and m['inconsistentDirectedEdges']==0 and m['signedVolume']>0 for m in results),'limits':'Exported flat source triangles checked against stored normals; source sweep orientation and geometric crossing tests are separate. No likeness, rig or runtime acceptance.'}
Path(a.out).write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='meshes'},indent=2))
