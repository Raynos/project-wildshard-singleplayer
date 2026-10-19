"""Explicit core hit volumes and seven exact rigid-part hulls. Source study only.
No native geometry changes, root lifts, collision padding or engine changes.
"""
import hashlib,json
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'v3'
native=json.loads((SOURCE/'native-source.json').read_text())
metadata=json.loads((SOURCE/'metadata.json').read_text())
bones={b['name']:(i,b) for i,b in enumerate(native['bones'])}
parts=[];audit=[]
for part in native['parts']:
 index,bone=bones[part['name']]
 indices=np.asarray(part['skinIndices']).reshape(-1,4)
 weights=np.asarray(part['skinWeights']).reshape(-1,4)
 assert np.all(indices[:,0]==index) and np.all(weights[:,0]==1) and np.all(weights[:,1:]==0)
 positions=np.asarray(part['positions'],dtype=np.float64).reshape(-1,3)
 points=np.unique(positions,axis=0)-np.asarray(bone['pos'])
 hull=ConvexHull(points)
 selected=points[hull.vertices]
 assert 4<=len(selected)<=128 and hull.volume>0
 error=float(np.max(points@hull.equations[:,:3].T+hull.equations[:,3]))
 assert error<=1e-8
 parts.append({'bone':part['name'],'points':selected.tolist()})
 audit.append({'bone':part['name'],'sourceVertices':len(positions),'uniqueVertices':len(points),'hullVertices':len(selected),'volume':float(hull.volume),'maximumSourceOutsideHull':error})
assert len(parts)==7 and sum(len(p['points']) for p in parts)<=512
body=metadata['bodies'][0]
body['dims'].update({'capsuleAxis':'z','bodyHalfLen':.35,'bodyRadius':.60,'headRadius':.75,'rigidCorpse':{'parts':parts}})
# Existing axis/native rigid-body contract; body bind remains .7 and geometry stays byte-identical.
(HERE/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
receipt={'schema':'wildshard.brine-pitcher.core-runtime-study.v1','productBuilt':False,'runtimeAcceptance':False,'contactAcceptance':False,'visualAcceptance':False,'geometryChanged':False,'rootLift':0,'livingHitPolicy':'Torso and primary central pitcher only. Side mouths are attack emitters, not additional damage hitboxes; roots, canopy and leaves are decorative. Must review visible hit feedback in actual gameplay before acceptance.','liveBodyCapsule':{'axis':'z','bindY':.7,'halfLength':.35,'radius':.6,'restBottom':.1},'livePrimaryHeadRadius':.75,'corpsePolicy':'Existing single rigid root with seven following convex part shapes; unchanged numeric death animation. No additional bodies, joints, engine callbacks or admission exemptions. World contact still requires actual simulation and complete-cycle recording.','parts':audit,'totalHullPoints':sum(len(p['points']) for p in parts),'sourcePins':{name:hashlib.sha256((SOURCE/name).read_bytes()).hexdigest() for name in ['metadata.json','native-source.json','payload.bin']}}
(HERE/'audit.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'parts':len(parts),'points':receipt['totalHullPoints'],'runtimeAcceptance':False}))
