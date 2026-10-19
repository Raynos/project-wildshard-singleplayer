"""Read-only exact packed/source audit; prints receipt, changes no inputs."""
import json,struct,zlib,hashlib,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
def read(p): return json.loads((ROOT/p).read_bytes())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def glb(p):
 b=(ROOT/p).read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);return d,b[28+n:]
def accessor(d,b,i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];fmt={5126:'f',5123:'H',5125:'I'}[a['componentType']];w={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];size=struct.calcsize(fmt)*w;at=v.get('byteOffset',0)+a.get('byteOffset',0);return [struct.unpack_from('<'+fmt*w,b,at+j*v.get('byteStride',size)) for j in range(a['count'])]
def f32(v):return struct.unpack('<f',struct.pack('<f',v))[0]
result={}
for label,folder,native,source in [
 ('selectedConch','art/driftwood-isle/approved-conch/selected-native-normals/native','conch-character-pass-native.json','art/driftwood-isle/approved-conch/selected-geometry-admission/conch-study.glb'),
 ('selectedMantis','art/driftwood-isle/lowpoly-mantis/complete-integrated-next','mantis-native.json','art/driftwood-isle/lowpoly-mantis/complete-integrated-next/mantis-study-complete-integrated-next.glb')]:
 m=read(folder+'/metadata.json');data=read(folder+'/'+native);mapping=read(folder+'/mesh-map.json');raw=zlib.decompress((ROOT/(folder+'/payload.bin')).read_bytes());d,b=glb(source);count=0;mindot=1;dev=0;opposed=0;emiss=[]
 for p,meta in zip(data['parts'],m['bodies'][0]['hard'],strict=True):
  for (name,typ,width,norm),offset,key in zip(meta['row']['attrs'],meta['offsets'],['positions','normals','colorsLinear','skinIndices','skinWeights','furLen'],strict=True):
   n=meta['row']['count']*width;fmt='H' if typ=='u16' else 'f';values=struct.unpack_from('<'+fmt*n,raw,offset);assert list(values)==[v if typ=='u16' else f32(v) for v in p[key]],(label,p['name'],name)
 for row in mapping:
  part=next(p for p in data['parts'] if p['name']==row['joint']);node=d['nodes'][row['node']];assert node.get('rotation',[0,0,0,1])==[0,0,0,1] and node.get('scale',[1,1,1])==[1,1,1] and 'matrix' not in node
  for pm in row['primitives']:
   prim=d['meshes'][node['mesh']]['primitives'][pm['primitive']];idx=[v[0] for v in accessor(d,b,prim['indices'])];ns=accessor(d,b,prim['attributes']['NORMAL']);ps=accessor(d,b,prim['attributes']['POSITION']);mat=d['materials'][prim['material']];color=mat['pbrMetallicRoughness']['baseColorFactor'][:3];start=pm['vertexStart'];trans=node.get('translation',[0,0,0])
   for j,i in enumerate(idx):
    at=(start+j)*3
    assert part['normals'][at:at+3]==list(ns[i]),(label,row['name'],'normal')
    assert [f32(x) for x in part['positions'][at:at+3]]==[f32(x+y) for x,y in zip(ps[i],trans)],(label,row['name'],'position')
    assert [f32(x) for x in part['colorsLinear'][at:at+3]]==[f32(x) for x in color],(label,row['name'],'color')
   count+=len(idx)
   for j in range(start,start+len(idx),3):
    a,c,e=[part['positions'][i*3:i*3+3] for i in range(j,j+3)];u=[y-x for x,y in zip(a,c)];v=[y-x for x,y in zip(a,e)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=math.sqrt(sum(x*x for x in cross));assert length>1e-10
    dots=[sum(x*y for x,y in zip(cross,part['normals'][i*3:i*3+3]))/length for i in range(j,j+3)];mindot=min(mindot,*dots);dev+=min(dots)<.999;opposed+=min(dots)<0
 for i,mat in enumerate(d['materials']):
  if any(mat.get('emissiveFactor',[0,0,0])):emiss.append({'material':i,'emissiveFactor':mat['emissiveFactor'],'extensions':mat.get('extensions')})
 result[label]={'pins':{p:sha(p) for p in [source,folder+'/'+native,folder+'/metadata.json',folder+'/payload.bin',folder+'/mesh-map.json']},'vertices':count,'triangles':count//3,'exactGLBPositionNormalLinearColorAndPackedChannels':True,'minimumFacetNormalCosine':mindot,'trianglesBelow0999':dev,'opposedTriangles':opposed,'emissiveMaterials':emiss,'doubleSidedMaterials':sum(m.get('doubleSided',False) for m in d['materials']),'materials':len(d['materials'])}
folder='tmp/conch-readable-preview/motion4-build2/pack';m=read(folder+'/metadata.json');result['publicConch4']={'pins':{p:sha(p) for p in [folder+'/metadata.json',folder+'/payload.bin']},'file':m['file'],'attributes':m['bodies'][0]['hard'][0]['row']['attrs'],'vertices':sum(p['row']['count'] for p in m['bodies'][0]['hard']),'parts':len(m['bodies'][0]['hard'])}
result['runtimePins']={p:sha(p) for p in ['src/game/plugin/geometry.ts','src/practiceContent.ts','src/engine/entities/AnimalFactory.ts','src/engine/entities/lowpoly.ts','src/practicePresentation.ts','src/practiceLevel.ts']}
print(json.dumps(result,indent=2))
