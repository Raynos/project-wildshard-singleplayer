"""Independent pinned GLB accessor + mapping reconstruction; no exporter execution."""
import json, struct, hashlib, argparse
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--host',type=Path,required=True)
parser.add_argument('--native',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
N=args.native
H=args.host
glb=next(H.glob('selected-source-*.glb')).read_bytes()
assert hashlib.sha256(glb).hexdigest()=='21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a'
assert struct.unpack_from('<III',glb)==(0x46546c67,2,len(glb))
n,t=struct.unpack_from('<II',glb,12); assert t==0x4e4f534a
doc=json.loads(glb[20:20+n]); size,t=struct.unpack_from('<II',glb,20+n); assert t==0x004e4942
binary=glb[28+n:28+n+size]
def accessor(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];assert not a.get('sparse'); assert not a.get('normalized')
 w={'SCALAR':1,'VEC3':3}[a['type']];fmt={5123:'H',5125:'I',5126:'f'}[a['componentType']];step=struct.calcsize(fmt)*w; stride=v.get('byteStride',step);off=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*w,binary,off+j*stride) for j in range(a['count'])]
native=json.loads((N/'conch-character-pass-native.json').read_bytes());mapping=json.loads((N/'mesh-map.json').read_bytes())
parts={p['name']:p for p in native['parts']};offset={};count=0
for p in native['parts']:offset[p['name']]=count;count+=len(p['positions'])//3
normals=[None]*(count*3);positions=[None]*(count*3);groups=[];visited=set()
f32=lambda x:struct.unpack('<f',struct.pack('<f',x))[0]
for row in mapping:
 node=doc['nodes'][row['node']];assert node['name']==row['name'];assert not any(k in node for k in ['matrix','rotation','scale','children']);translation=node.get('translation',[0,0,0]);prims=doc['meshes'][node['mesh']]['primitives'];assert len(prims)==len(row['primitives']);visited.add(row['node'])
 for m in row['primitives']:
  p=prims[m['primitive']];assert p['material']==m['material'];assert p.get('mode',4)==4;assert set(p['attributes'])=={'POSITION','NORMAL'}
  ids=[v[0] for v in accessor(p['indices'])];pos=accessor(p['attributes']['POSITION']);norm=accessor(p['attributes']['NORMAL']);assert len(ids)==m['vertexCount'];assert doc['materials'][m['material']]['doubleSided']==m['doubleSided']
  start=offset[row['joint']]+m['vertexStart'];groups.append({'start':start,'count':len(ids),'materialIndex':m['material'],'node':row['node'],'primitive':m['primitive']})
  for j,v in enumerate(ids):
   k=(start+j)*3;assert normals[k] is None
   normals[k:k+3]=norm[v];positions[k:k+3]=[f32(x+y) for x,y in zip(pos[v],translation)]
assert visited==set(doc['scenes'][doc.get('scene',0)]['nodes']);assert count==6570 and len(groups)==95 and len(doc['materials'])==14
expected=[f32(v) for p in native['parts'] for v in p['positions']];assert positions==expected
assert normals==[f32(v) for p in native['parts'] for v in p['normals']]
groups.sort(key=lambda g:g['start']);assert [i for g in groups for i in range(g['start'],g['start']+g['count'])]==list(range(count))
result={'sourceSha256':hashlib.sha256(glb).hexdigest(),'mappingSha256':hashlib.sha256((N/'mesh-map.json').read_bytes()).hexdigest(),'positions':positions,'normals':normals,'groups':groups,'materials':doc['materials'],'skinIndex':[v for p in native['parts'] for v in p['skinIndices']],'skinWeight':[f32(v) for p in native['parts'] for v in p['skinWeights']],'bones':native['bones']}
args.output.write_text(json.dumps(result,separators=(',',':'))+'\n')
print(json.dumps({'vertices':count,'groups':len(groups),'exactNormals':len(normals),'exactPositions':len(positions),'materials':len(doc['materials']),'sourceSha256':result['sourceSha256'],'mappingSha256':result['mappingSha256']}))
