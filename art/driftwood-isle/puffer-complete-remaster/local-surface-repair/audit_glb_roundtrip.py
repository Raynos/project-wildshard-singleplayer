"""Verify actual GLB attributes and hierarchy against the complete native source."""
import hashlib,json,struct
from pathlib import Path
import numpy as np
H=Path(__file__).resolve().parent;raw=(H/'local-repair-study.glb').read_bytes();n=json.loads((H/'local-repair-native.json').read_text())
magic,version,size=struct.unpack_from('<4sII',raw);jl,jtype=struct.unpack_from('<I4s',raw,12);g=json.loads(raw[20:20+jl]);bl,btype=struct.unpack_from('<I4s',raw,20+jl);blob=raw[28+jl:]
assert magic==b'glTF' and version==2 and size==len(raw) and jtype==b'JSON' and btype==b'BIN\0' and bl==len(blob)
def array(ai):
 a=g['accessors'][ai];v=g['bufferViews'][a['bufferView']];width={'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];return np.frombuffer(blob,dtype='<f4' if a['componentType']==5126 else '<u2',count=a['count']*width,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width)
checks={}
for p,m in zip(n['parts'],g['meshes']):
 a=m['primitives'][0]['attributes']
 for key,field,width,dtype in [('POSITION','positions',3,'<f4'),('COLOR_0','colorsLinear',3,'<f4'),('JOINTS_0','skinIndices',4,'<u2'),('WEIGHTS_0','skinWeights',4,'<f4')]:
  checks[p['name']+' '+key]=bool(np.array_equal(array(a[key]),np.array(p[field],dtype=dtype).reshape(-1,width)))
names={b['name']:i for i,b in enumerate(n['bones'])};world=[]
for i,b in enumerate(n['bones']):
 w=np.array(g['nodes'][i]['translation']);w=w+world[names[b['parent']]] if b['parent'] else w;world.append(w)
 checks[b['name']+' absolute pivot']=bool(np.array_equal(w,np.array(b['pos'])))
 inv=array(g['skins'][0]['inverseBindMatrices'])[i].reshape(4,4).T
 checks[b['name']+' inverse bind']=bool(np.allclose(inv[:3,3],-w,atol=1e-7,rtol=0))
checks['singleSidedMaterial']=not g['materials'][0]['doubleSided'];checks['rawAssetSizeUnderMillion']=len(raw)<1000000
r={'checks':checks,'passed':sum(checks.values()),'total':len(checks),'glbSha256':hashlib.sha256(raw).hexdigest(),'nativeSha256':hashlib.sha256((H/'local-repair-native.json').read_bytes()).hexdigest(),'runtimeAdmitted':False}
(H/'glb-roundtrip-audit.json').write_text(json.dumps(r,indent=2)+'\n');print(r['passed'],r['total']);assert all(checks.values())
