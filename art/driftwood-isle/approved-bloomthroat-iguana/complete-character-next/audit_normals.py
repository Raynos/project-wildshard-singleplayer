"""Check real exported normals against oriented GLB triangles, without repairs."""
import json, math, struct, sys
from pathlib import Path
p=Path(sys.argv[1]);raw=next(p.glob('*.glb')).read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);blob=raw[28+n:]
def attr(index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);kind={5126:'f',5123:'H',5121:'B',5125:'I'}[a['componentType']];width={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];stride=v.get('byteStride',struct.calcsize(kind)*width)
 return [struct.unpack_from('<'+kind*width,blob,offset+i*stride) for i in range(a['count'])]
worst=1.;max_len_error=0.;count=0
for mesh in g['meshes']:
 for prim in mesh['primitives']:
  a=prim['attributes'];ps=attr(a['POSITION']);ns=attr(a['NORMAL']);ids=[i[0] for i in attr(prim['indices'])]
  for k in range(0,len(ids),3):
   tri=ids[k:k+3];p0,p1,p2=[ps[i] for i in tri];u=[b-a for a,b in zip(p0,p1)];v=[b-a for a,b in zip(p0,p2)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=math.sqrt(sum(x*x for x in cross));assert length>1e-10
   for i in tri:
    norm=ns[i];assert all(math.isfinite(x) for x in norm);nl=math.sqrt(sum(x*x for x in norm));max_len_error=max(max_len_error,abs(nl-1));dot=sum(x*y for x,y in zip(cross,norm))/length;worst=min(worst,dot);assert dot>.9999 and abs(nl-1)<1e-5,(mesh['name'],dot,nl);count+=1
print(json.dumps({'actualGlbNormalCorners':count,'minimumOrientedFaceAgreement':worst,'maximumUnitLengthError':max_len_error,'repairs':0,'passed':True},indent=2))
