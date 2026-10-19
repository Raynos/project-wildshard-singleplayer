"""Read-only proper triangle-crossing check of the exported unified shell.
Excludes shared-vertex pairs and coplanar contact; not a collision/runtime test.
"""
import argparse,json,struct
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('glb');p.add_argument('--out',required=True);a=p.parse_args()
b=Path(a.glb).read_bytes();length,kind=struct.unpack_from('<II',b,12);g=json.loads(b[20:20+length]);offset=20+length;bl,typ=struct.unpack_from('<II',b,offset);data=b[offset+8:offset+8+bl]
def accessor(index):
 ac=g['accessors'][index];v=g['bufferViews'][ac['bufferView']];formats={5126:'f',5125:'I',5123:'H',5121:'B'};fmt=formats[ac['componentType']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[ac['type']];size=struct.calcsize(fmt)*n;stride=v.get('byteStride',size);start=v.get('byteOffset',0)+ac.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*n,data,start+i*stride) for i in range(ac['count'])]
results=[]
for mesh in g['meshes']:
 if mesh['name']!='Unified angular whorls lip and recessed throat':continue
 points=[];lookup={};triangles=[]
 for prim in mesh['primitives']:
  ps=accessor(prim['attributes']['POSITION']);indices=[v[0] for v in accessor(prim['indices'])];weld=[]
  for pt in ps:
   key=tuple(round(v,6) for v in pt)
   if key not in lookup:lookup[key]=len(points);points.append(pt)
   weld.append(lookup[key])
  triangles.extend(tuple(weld[indices[j+k]] for k in range(3)) for j in range(0,len(indices),3))
 ids=np.array(triangles);tri=np.array(points)[ids];e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0];hits=set()
 for i,vertices in enumerate(ids):
  valid=(np.arange(len(ids))!=i)&~np.isin(ids,vertices).any(axis=1)
  for start,end in [(0,1),(1,2),(2,0)]:
   origin=tri[i,start];direction=tri[i,end]-origin
   h=np.cross(np.broadcast_to(direction,e2.shape),e2);det=np.einsum('ij,ij->i',e1,h)
   mask=valid&(np.abs(det)>1e-10);inv=np.zeros_like(det);inv[mask]=1/det[mask]
   q0=origin-tri[:,0];u=inv*np.einsum('ij,ij->i',q0,h);q=np.cross(q0,e1);v=inv*(q@direction);t=inv*np.einsum('ij,ij->i',e2,q)
   mask&=(u>1e-7)&(v>1e-7)&(u+v<1-1e-7)&(t>1e-7)&(t<1-1e-7)
   for j in np.where(mask)[0]:hits.add(tuple(sorted((i,int(j)))))
 results.append({'mesh':mesh['name'],'triangles':len(triangles),'properNonadjacentCrossings':len(hits),'trianglePairs':sorted(hits)})
if not results:raise SystemExit('Unified shell mesh absent; no valid check performed.')
report={'file':Path(a.glb).name,'meshes':results,'limits':'Bidirectional segment/triangle check of actual GLB. Shared-vertex pairs and coplanar contacts excluded. No rig, motion, runtime or likeness acceptance implied.'}
Path(a.out).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
