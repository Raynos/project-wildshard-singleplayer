"""Exact float32 single-sided export of complete closed anatomical native source."""
import hashlib,json,struct
from pathlib import Path
import numpy as np
H=Path(__file__).resolve().parent;n=json.loads((H/'candidate-native.json').read_text())
g={'asset':{'version':'2.0','generator':'Puffer next complete guided carrier bridge'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'skins':[],'materials':[{'name':'Native linear matte paint','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.83},'doubleSided':False}],'buffers':[{}],'bufferViews':[],'accessors':[]}
buf=bytearray()
def attr(values,width,kind='f32',target=None,bounds=False):
 global buf
 while len(buf)%4:buf.append(0)
 dtype='<f4' if kind=='f32' else '<u2';a=np.array(values,dtype=dtype).reshape(-1,width);raw=a.tobytes();view={'buffer':0,'byteOffset':len(buf),'byteLength':len(raw)}
 if target:view['target']=target
 vi=len(g['bufferViews']);g['bufferViews'].append(view);buf.extend(raw)
 ac={'bufferView':vi,'componentType':5126 if kind=='f32' else 5123,'count':len(a),'type':{3:'VEC3',4:'VEC4',16:'MAT4'}[width]}
 if bounds:ac.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 ai=len(g['accessors']);g['accessors'].append(ac);return ai
names={b['name']:i for i,b in enumerate(n['bones'])}
for b in n['bones']:
 parent=n['bones'][names[b['parent']]] if b['parent'] else None
 local=(np.array(b['pos'])-np.array(parent['pos'])).tolist() if parent else b['pos']
 g['nodes'].append({'name':b['name'],'translation':local})
for i,b in enumerate(n['bones']):
 if b['parent']:g['nodes'][names[b['parent']]].setdefault('children',[]).append(i)
ib=[]
for b in n['bones']:
 m=np.eye(4);m[:3,3]=-np.array(b['pos']);ib.extend(m.T.reshape(-1).tolist())
g['skins']=[{'name':'Eight exact native bind pivots','joints':list(range(8)),'skeleton':0,'inverseBindMatrices':attr(ib,16)}]
g['scenes'][0]['nodes'].append(0)
for p in n['parts']:
 v=np.array(p['positions']).reshape(-1,3);tr=v.reshape(-1,3,3);normal=np.cross(tr[:,1]-tr[:,0],tr[:,2]-tr[:,0]);normal/=np.linalg.norm(normal,axis=1)[:,None];normal=np.repeat(normal,3,axis=0)
 ats={'POSITION':attr(v,3,target=34962,bounds=True),'NORMAL':attr(normal,3,target=34962),'COLOR_0':attr(p['colorsLinear'],3,target=34962),'JOINTS_0':attr(p['skinIndices'],4,'u16',34962),'WEIGHTS_0':attr(p['skinWeights'],4,target=34962)}
 mi=len(g['meshes']);g['meshes'].append({'name':p['name'],'primitives':[{'attributes':ats,'material':0,'mode':4}]});ni=len(g['nodes']);g['nodes'].append({'name':p['name'],'mesh':mi,'skin':0});g['scenes'][0]['nodes'].append(ni)
g['buffers'][0]['byteLength']=len(buf)
j=json.dumps(g,separators=(',',':'),allow_nan=False).encode();j+=b' '*((-len(j))%4);buf+=b'\0'*((-len(buf))%4)
data=struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(buf))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(buf),b'BIN\0')+buf
p=H/'candidate.glb';p.write_bytes(data)
r={'sourceSha256':hashlib.sha256((H/'candidate-native.json').read_bytes()).hexdigest(),'glbSha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'vertices':sum(len(p['positions'])//3 for p in n['parts']),'bones':8,'parts':7,'geometryAndPaint':'native arrays converted to IEEE float32 only','bindPivots':'absolute native pivots converted to parent-relative nodes and inverse world translations','runtimeAdmitted':False,'closedAnatomicalInserts':4}
(H/'glb-export-receipt.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
