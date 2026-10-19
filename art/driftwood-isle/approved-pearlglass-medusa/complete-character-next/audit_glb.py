"""Exact triangle/paint/skin GLB-native equivalence with float32 position tolerance."""
import json,struct,collections,sys,math
from pathlib import Path
from scipy.spatial import cKDTree
p=Path(sys.argv[1]);raw=(p/'pearlglass-medusa-complete-character-next.glb').read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);blob=raw[28+n:];d=json.loads((p/'native-source.json').read_text())
def attr(index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);kind={5126:'f',5123:'H',5121:'B',5125:'I'}[a['componentType']];width={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];stride=v.get('byteStride',struct.calcsize(kind)*width);return [struct.unpack_from('<'+kind*width,blob,offset+i*stride) for i in range(a['count'])]
def key(c,ids,ws):return tuple(round(x,4) for x in c)+tuple(sorted((int(i),round(w,6)) for i,w in zip(ids,ws) if w>0))
def triangle(ids):return min(tuple(ids),tuple(ids[1:]+ids[:1]),tuple(ids[2:]+ids[:2]))
groups={};rows=[];source_colors={}
for part in d['parts']:
 for i in range(len(part['positions'])//3):
  k=key(part['colorsLinear'][i*3:i*3+3],part['skinIndices'][i*4:i*4+4],part['skinWeights'][i*4:i*4+4]);pos=tuple(part['positions'][i*3:i*3+3]);source_colors[k]=part['colorsLinear'][i*3:i*3+3];group=groups.setdefault(k,{})
  if pos not in group:group[pos]=len(rows);rows.append((k,pos))
search={k:(cKDTree(list(group)),list(group.values())) for k,group in groups.items()};native=collections.Counter();actual=collections.Counter();error=0;color_error=0
for part in d['parts']:
 ids=[]
 for i in range(len(part['positions'])//3):
  k=key(part['colorsLinear'][i*3:i*3+3],part['skinIndices'][i*4:i*4+4],part['skinWeights'][i*4:i*4+4]);ids.append(groups[k][tuple(part['positions'][i*3:i*3+3])])
 for i in range(0,len(ids),3):native[triangle(ids[i:i+3])]+=1
for node in g['nodes']:
 if 'mesh' in node:assert not any(k in node for k in ['matrix','translation','rotation','scale'])
for mesh in g['meshes']:
 for prim in mesh['primitives']:
  a=prim['attributes'];ps=attr(a['POSITION']);js=attr(a['JOINTS_0']);ws=attr(a['WEIGHTS_0']);color=g['materials'][prim['material']]['pbrMetallicRoughness']['baseColorFactor'][:3];mapped=[]
  for pos,ind,w in zip(ps,js,ws,strict=True):
   k=key(color,ind,w);difference=max(abs(x-y) for x,y in zip(color,source_colors[k],strict=True));assert difference<1e-6;color_error=max(color_error,difference);tree,indices=search[k];dist,idx=tree.query(pos);assert dist<1e-6;error=max(error,float(dist));mapped.append(indices[idx])
  indices=[i[0] for i in attr(prim['indices'])];normals=attr(a['NORMAL'])
  for j in range(0,len(indices),3):
   triangleIndices=indices[j:j+3];p0,p1,p2=[ps[i] for i in triangleIndices];u=[p1[k]-p0[k] for k in range(3)];v=[p2[k]-p0[k] for k in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=math.sqrt(sum(x*x for x in cross));assert length>1e-9
   for vi in triangleIndices:assert sum(cross[k]*normals[vi][k] for k in range(3))/length>.999
  order=[mapped[i] for i in indices]
  for i in range(0,len(order),3):actual[triangle(order[i:i+3])]+=1
assert native==actual
print(json.dumps({'triangles':sum(native.values()),'maxPositionError':error,'maxColorError':color_error,'paintTolerance':1e-6,'weightsTolerance':1e-6,'flatNormalsAgreeWithEveryTriangle':True,'windingPreserved':True,'skinAndMaterialEquivalence':True,'runtimeAcceptance':False},indent=2))
