"""Independent GLB manifold/winding/material and nine-view culling audit."""
import json,struct,collections,sys,math
from pathlib import Path
import numpy as np
p=Path(sys.argv[1]);raw=next(p.glob('*.glb')).read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);blob=raw[28+n:]
def attr(index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);kind={5126:'f',5123:'H',5121:'B',5125:'I'}[a['componentType']];width={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];stride=v.get('byteStride',struct.calcsize(kind)*width);return [struct.unpack_from('<'+kind*width,blob,offset+i*stride) for i in range(a['count'])]
assert all(not m.get('doubleSided',False) for m in g['materials'])
alltris=[];reports=[]
for node in g['nodes']:
 if 'mesh' not in node:continue
 edges=collections.Counter();oriented=collections.Counter();volume=0;small=1e9;tris=[]
 for prim in g['meshes'][node['mesh']]['primitives']:
  vs=attr(prim['attributes']['POSITION']);ids=[i[0] for i in attr(prim['indices'])]
  for i in range(0,len(ids),3):
   tri=[tuple(round(x,6) for x in vs[j]) for j in ids[i:i+3]];a,b,c=map(np.array,tri);normal=np.cross(b-a,c-a);small=min(small,float(np.linalg.norm(normal)*.5));volume+=float(a.dot(np.cross(b,c))/6);tris.append((a,b,c))
   for k in range(3):edge=(tri[k],tri[(k+1)%3]);edges[tuple(sorted(edge))]+=1;oriented[edge]+=1
 assert all(v==2 for v in edges.values()),node['name']
 assert all(oriented[(b,a)]==v for (a,b),v in oriented.items()),node['name']
 assert volume>0 and small>1e-10,(node['name'],volume,small)
 reports.append({'mesh':node['name'],'triangles':len(tris),'signedVolume':volume,'minimumArea':small,'closedManifold':True,'oppositeDirectedEdges':True});alltris+=tris
views={}
for name,az,el in [('front',0,0),('left',-90,0),('right',90,0),('back',180,0),('top',0,90),('elevated-front',0,39),('elevated-left',-90,39),('elevated-right',90,39),('elevated-back',180,39)]:
 az=math.radians(az);el=math.radians(el);eye=np.array([math.sin(az)*math.cos(el),math.sin(el),math.cos(az)*math.cos(el)]);views[name]=sum(np.dot(np.cross(b-a,c-a),eye)>1e-10 for a,b,c in alltris)
print(json.dumps({'proof':'independent actual GLB mesh topology and single-sided culling; not likeness','singleSidedMaterials':True,'closedOutwardComponents':len(reports),'triangles':len(alltris),'viewFrontFacingTriangles':{k:int(v) for k,v in views.items()},'components':reports,'runtimeAcceptance':False},indent=2))
