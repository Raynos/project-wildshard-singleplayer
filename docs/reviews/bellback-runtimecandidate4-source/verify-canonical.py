"""Read exact packed bytes; prove all rigid vertices share the proposed hull support.
No product, build, engine edits, transforms, fitting or sampled-contact claim.
"""
import hashlib,json,pathlib,zlib
import numpy as np
from scipy.spatial import ConvexHull
ROOT=pathlib.Path(__file__).resolve().parents[3]
BASE=ROOT/'art/driftwood-isle/lowpoly-bellback/runtime-admission'
def read(path): return json.loads(path.read_text())
def digest(path): return {'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}
original=BASE/'visual/frame2-native'
metadata=read(BASE/'arena-candidate4/metadata.json'); prior=read(BASE/'arena-candidate3/metadata.json')
recipe=read(ROOT/'docs/reviews/bellback-corpse-shape-study/posed-parts-proposal.json')['rigidCorpse']
assert metadata['bodies'][0]['dims'].pop('rigidCorpse')==recipe
assert metadata==prior
native=read(original/'bellback-v6-native.json'); payload=original/'payload.bin'
assert digest(payload)['sha256']=='b97a9df5437062aa2eb490340663c2b35ecf22ba83c83b834082d8ffe7ae7e9c'
raw=zlib.decompress(payload.read_bytes())
assert len(raw)==metadata['bytes']
body=metadata['bodies'][0]; assert body['fur'] is None and len(body['hard'])==8
assert body['bones']==native['bones']
rows=[];count=0
for index,(packed,part,bone,hullpart) in enumerate(zip(body['hard'],native['parts'],body['bones'],recipe['parts'],strict=True)):
 assert part['name']==bone['name']==hullpart['bone']
 attrs={a[0]:(a,offset) for a,offset in zip(packed['row']['attrs'],packed['offsets'],strict=True)}
 values={}
 for name,(a,offset) in attrs.items():
  assert a[1] in ('f32','u16')
  values[name]=np.frombuffer(raw,dtype='<f4' if a[1]=='f32' else '<u2',count=packed['row']['count']*a[2],offset=offset).reshape(-1,a[2])
 vertices=values['position'].astype(np.float64)
 assert np.array_equal(vertices,np.array(part['positions']).reshape(-1,3))
 weights=values['skinWeight']; indices=values['skinIndex']
 assert np.all(weights[:,0]==1) and np.all(weights[:,1:]==0) and np.all(indices[:,0]==index)
 points=vertices-np.array(bone['pos']); hullpoints=np.array(hullpart['points'])
 assert 4<=len(hullpoints)<=128 and np.isfinite(hullpoints).all() and np.max(abs(hullpoints))<=20
 # Both directions: all original vertices lie inside proposed hull, and each recipe
 # point is an exact original vertex. Thus their convex hulls and support coincide
 # for EVERY direction, not merely the finite normals tested numerically here.
 assert all(np.any(np.all(points==p,axis=1)) for p in hullpoints)
 hull=ConvexHull(hullpoints); violations=points@hull.equations[:,:3].T+hull.equations[:,3]
 max_violation=float(violations.max()); assert max_violation<1e-9
 reference=ConvexHull(points)
 assert all(np.any(np.all(hullpoints==points[i],axis=1)) for i in reference.vertices)
 support_gap=float(np.max(abs(np.max(points@hull.equations[:,:3].T,axis=0)-np.max(hullpoints@hull.equations[:,:3].T,axis=0))))
 assert support_gap<1e-9
 rows.append({'bone':bone['name'],'vertices':len(vertices),'hullPoints':len(hullpoints),'maxHalfspaceViolation':max_violation,'maxFacetSupportGap':support_gap,'hullVolume':float(hull.volume),'allHullPointsExactOriginalVertices':True,'everyCanonicalHullVertexRetained':True,'singleBoneUnitWeights':True})
 count+=len(vertices)
assert count==13374 and sum(r['hullPoints'] for r in rows)==435
result={'schema':'wildshard.bellback.runtimecandidate4.canonical-proof.v1','runtimeAcceptance':False,'contactAcceptance':False,'vertices':count,'bones':8,'hullPoints':435,'compressedPayload':digest(payload),'decodedBytes':len(raw),'rows':rows,'scope':'Exact canonical packed vertices, exact unit rigid weights, and equal convex hulls prove same-pose support equality under rigid transforms. Does not prove simulation clock, interpolation, dynamic or settled contact, slope stability, phone performance, or visual acceptance.'}
path=BASE/'arena-candidate4/canonical-proof.json';path.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
