"""Read-only GLB structural/topological checks; no likeness or runtime claims."""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct

p=argparse.ArgumentParser()
p.add_argument('glb')
p.add_argument('--out',required=True)
a=p.parse_args()
raw=Path(a.glb).read_bytes()
assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw))
size,kind=struct.unpack_from('<I4s',raw,12)
assert kind==b'JSON'
doc=json.loads(raw[20:20+size])
offset=20+size
size,kind=struct.unpack_from('<I4s',raw,offset)
assert kind==b'BIN\0'
binary=raw[offset+8:offset+8+size]
assert len(doc['buffers'])==1 and 'uri' not in doc['buffers'][0]
assert not doc.get('images')
formats={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def values(index):
    ac=doc['accessors'][index]
    bv=doc['bufferViews'][ac['bufferView']]
    fmt='<'+formats[ac['componentType']]*components[ac['type']]
    width=struct.calcsize(fmt)
    start=bv.get('byteOffset',0)+ac.get('byteOffset',0)
    stride=bv.get('byteStride',width)
    assert start+max(0,ac['count']-1)*stride+width<=bv.get('byteOffset',0)+bv['byteLength']<=len(binary)
    result=[struct.unpack_from(fmt,binary,start+i*stride) for i in range(ac['count'])]
    assert all(math.isfinite(v) for row in result for v in row)
    return result

def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def dot(a,b):return sum(x*y for x,y in zip(a,b))
records=[]
primitives=0
for mi,mesh in enumerate(doc['meshes']):
    mesh=dict(mesh,name=next(n['name'] for n in doc['nodes'] if n.get('mesh')==mi))
    edges=Counter()
    direction=Counter()
    tris=0
    degenerate=0
    volume=0.0
    triangles=[]
    normalOpposed=0
    normalDeviations=0
    normalMinimumCosine=1.0
    for primitive in mesh['primitives']:
        primitives+=1
        assert primitive.get('mode',4)==4
        positions=values(primitive['attributes']['POSITION'])
        normals=values(primitive['attributes']['NORMAL'])
        indices=[row[0] for row in values(primitive['indices'])]
        assert len(indices)%3==0
        assert min(indices)>=0 and max(indices)<len(positions)
        for accessor in primitive['attributes'].values():values(accessor)
        for i in range(0,len(indices),3):
            v=[positions[indices[i+j]] for j in range(3)]
            keys=[tuple(round(c,6) for c in point) for point in v]
            for j in range(3):
                u,w=keys[j],keys[(j+1)%3]
                edge=tuple(sorted((u,w)))
                edges[edge]+=1
                direction[edge]+=1 if u<w else -1
            area=cross(sub(v[1],v[0]),sub(v[2],v[0]))
            if dot(area,area)<1e-16:degenerate+=1
            triangles.append((keys,v))
            length=math.sqrt(dot(area,area))
            if length>1e-12:
                for j in range(3):
                    n=normals[indices[i+j]];nl=math.sqrt(dot(n,n))
                    assert abs(nl-1)<1e-5
                    cosine=dot(area,n)/(length*nl)
                    normalMinimumCosine=min(normalMinimumCosine,cosine)
                    normalOpposed+=cosine<=0
                    normalDeviations+=cosine<.99999
            volume+=dot(v[0],cross(v[1],v[2]))/6
            tris+=1
    # Connected components via quantized welded vertex adjacency, not aggregate volume.
    vertex_faces={}
    for i,(keys,_) in enumerate(triangles):
        for key in keys:vertex_faces.setdefault(key,[]).append(i)
    unseen=set(range(len(triangles)));volumes=[]
    while unseen:
        stack=[unseen.pop()];members=[]
        while stack:
            i=stack.pop();members.append(i)
            for key in triangles[i][0]:
                for j in vertex_faces[key]:
                    if j in unseen:unseen.remove(j);stack.append(j)
        volumes.append(sum(dot(triangles[i][1][0],cross(triangles[i][1][1],triangles[i][1][2]))/6 for i in members))
    records.append({'name':mesh.get('name'),'triangles':tris,'weldedBoundaryEdges':sum(n==1 for n in edges.values()),'weldedNonmanifoldEdges':sum(n>2 for n in edges.values()),'windingConflicts':sum(edges[e]==2 and direction[e]!=0 for e in edges),'zeroAreaTriangles':degenerate,'signedVolume':volume,'connectedComponentVolumes':volumes,'normalOpposedVertices':normalOpposed,'normalDeviatingVertices':normalDeviations,'minimumNormalCosine':normalMinimumCosine})
report={'status':'static export audit; not a likeness, rig, intersection or performance gate','sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'finiteAttributes':True,'indexBoundsValid':True,'externalDependencies':0,'meshes':len(records),'materialPrimitives':primitives,'triangles':sum(r['triangles'] for r in records),'animations':len(doc.get('animations',[])),'skins':len(doc.get('skins',[])),'weldTolerance':1e-6,'boundaryEdges':sum(r['weldedBoundaryEdges'] for r in records),'nonmanifoldEdges':sum(r['weldedNonmanifoldEdges'] for r in records),'windingConflicts':sum(r['windingConflicts'] for r in records),'zeroAreaTriangles':sum(r['zeroAreaTriangles'] for r in records),'nonpositiveMeshVolumes':sum(r['signedVolume']<=0 for r in records),'nonpositiveComponentVolumes':sum(v<=0 for r in records for v in r['connectedComponentVolumes']),'normalOpposedVertices':sum(r['normalOpposedVertices'] for r in records),'normalDeviatingVertices':sum(r['normalDeviatingVertices'] for r in records),'minimumNormalCosine':min(r['minimumNormalCosine'] for r in records),'meshResults':records}
Path(a.out).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='meshResults'},indent=2))
assert not any(report[k] for k in ('boundaryEdges','nonmanifoldEdges','windingConflicts','zeroAreaTriangles','nonpositiveMeshVolumes','nonpositiveComponentVolumes','normalOpposedVertices','normalDeviatingVertices'))
