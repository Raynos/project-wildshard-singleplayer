"""Read-only geometric closure audit of an actual exported Conch GLB."""
import argparse,collections,json,math,struct
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('glb');p.add_argument('--out',required=True);a=p.parse_args()
b=Path(a.glb).read_bytes();length,kind=struct.unpack_from('<II',b,12);g=json.loads(b[20:20+length]);offset=20+length;bl,typ=struct.unpack_from('<II',b,offset);data=b[offset+8:offset+8+bl]
def accessor(index):
 ac=g['accessors'][index];v=g['bufferViews'][ac['bufferView']];formats={5126:'f',5125:'I',5123:'H',5121:'B'};fmt=formats[ac['componentType']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[ac['type']];size=struct.calcsize(fmt)*n;stride=v.get('byteStride',size);start=v.get('byteOffset',0)+ac.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*n,data,start+i*stride) for i in range(ac['count'])]
results=[]
for mesh in g['meshes']:
 edges=collections.Counter();verts={};tris=0;degen=0
 for prim in mesh['primitives']:
  ps=accessor(prim['attributes']['POSITION']);ids=[v[0] for v in accessor(prim['indices'])];weld=[]
  for pt in ps:
   key=tuple(round(v,6) for v in pt)
   if key not in verts:verts[key]=len(verts)
   weld.append(verts[key])
  for j in range(0,len(ids),3):
   tri=[weld[ids[j+k]] for k in range(3)];tris+=1
   if len(set(tri))<3:degen+=1
   for u,v in zip(tri,tri[1:]+tri[:1]):edges[tuple(sorted((u,v)))]+=1
 results.append({'mesh':mesh['name'],'triangles':tris,'weldedVertices':len(verts),'boundaryEdges':sum(v==1 for v in edges.values()),'nonManifoldEdges':sum(v>2 for v in edges.values()),'degenerateTriangles':degen})
report={'file':Path(a.glb).name,'bytes':len(b),'triangles':sum(r['triangles'] for r in results),'meshes':results,'note':'Per named mesh coordinate-welded topology; layered eye surfaces intentionally have component boundaries. No rig or runtime motion is implied.'}
Path(a.out).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
