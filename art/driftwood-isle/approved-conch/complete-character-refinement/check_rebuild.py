"""Compare frozen and capture-rebuilt GLBs without changing either artifact."""
import collections, hashlib, json, struct
from pathlib import Path
p=Path(__file__).resolve().parent
root=p.parents[3]
files=[p/'conch-character-refinement.glb',root/'tmp/conch-complete-character-refinement/conch-study.glb']
docs=[];buffers=[]
for f in files:
 b=f.read_bytes();n=struct.unpack_from('<I',b,12)[0];docs.append(json.loads(b[20:20+n]));buffers.append(b[28+n:])
assert docs[0]==docs[1], 'GLB metadata differs'
g=docs[0];diff=[]
for i,a in enumerate(g['accessors']):
 v=g['bufferViews'][a['bufferView']];o=v.get('byteOffset',0)+a.get('byteOffset',0)
 components={'SCALAR':1,'VEC3':3,'VEC2':2,'VEC4':4}[a['type']];fmt={5123:'H',5125:'I',5126:'f'}[a['componentType']];n=a['count']*components
 aa,bb=[struct.unpack_from('<'+fmt*n,b,o) for b in buffers]
 if aa==bb:continue
 assert a['type']=='SCALAR' and fmt in ['H','I'], 'Non-index attribute differs'
 def tris(ids):
  return collections.Counter(min(t,t[1:]+t[:1],t[2:]+t[:2]) for t in [tuple(ids[j:j+3]) for j in range(0,len(ids),3)])
 assert tris(aa)==tris(bb),'Oriented triangle multiset differs'
 diff.append({'accessor':i,'difference':'Same oriented triangles in different emission order'})
r={'files':[{'path':str(f.relative_to(root)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in files],'jsonIdentical':True,'positionNormalMaterialAttributesIdentical':True,'orientedTriangleMultisetsIdentical':True,'indexOrderingDifferences':diff,'note':'BMesh detail extrusion/triangulation can change emission order. Neither GLB altered. Generated blend files also contain session-dependent bytes; source Python is the authoritative editable source.'}
(p/'rebuild-closure.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
