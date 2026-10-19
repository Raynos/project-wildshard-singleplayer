"""Read-only source composition and new-body attachment audit. No asset admission."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
sys.path.insert(0,str(HERE.parent/'puffer-remaster-assembly'))
import assemble
sys.path.insert(0,str(HERE.parent/'puffer-remaster-guided'))
from paint_semantic_face_diagonal_robust import components,triangles,topology
sys.path.insert(0,str(HERE.parent/'puffer-spike-study'))
from build_spikes import clearance
BODY='art/driftwood-isle/puffer-remaster-guided/semantic-face-diagonal-native.json'
BODY_SHA='483b47367ddbad0e4872f357f786fc0cca778380a07bd536428923aadd3046cb'
def pin(path):
 p=ROOT/path
 return {'path':path,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
def measure(points,hull):
 points=np.array(points); distances=clearance(points,hull)
 return {'sampleCount':len(points),'minSignedDistance':min(distances),'maxSignedDistance':max(distances),'allInside':max(distances)<-1e-6,'points':points.tolist(),'signedDistances':distances}
def audit():
 manifest=json.loads((HERE.parent/'puffer-remaster-assembly/source-pins.json').read_text())
 source={k:assemble.load_pin(v) for k,v in manifest.items()}
 body=assemble.load_pin({'path':BODY,'sha256':BODY_SHA})
 candidate,composition=assemble.compose_checked(body,source)
 ts=triangles(body['parts'][0]);connected=components(ts);main=sorted(connected[0]);volume=topology([ts[i] for i in main])
 assert len(main)==4380
 # Painter helper returns Blender axes; measurements use native axes.
 hull=np.array([[[p[0],p[2],p[1]] for p in ts[i][::-1]] for i in main])
 indexed=json.loads((HERE.parent/'puffer-fin-study/terminal-fin-fans-indexed.json').read_text())
 fins=[]
 for m in indexed['meshes']:
  root=np.array(m['vertices'])[m['rootVertexIndices']]
  samples=np.concatenate([root,(root+np.roll(root,-1,axis=0))/2,root.mean(axis=0)[None,:]])
  fins.append({'name':m['name'],**measure(samples,hull)})
 tail=np.array(source['tail']['parts'][0]['positions'][:132*3]).reshape(-1,3)
 # Proximal cap is the forwardmost retained root ring, selected geometrically.
 cap=np.unique(tail[np.isclose(tail[:,2],tail[:,2].max(),atol=1e-8,rtol=0)],axis=0)
 center=cap.mean(axis=0);angles=np.arctan2(cap[:,1]-center[1],cap[:,0]-center[0]);cap=cap[np.argsort(angles)]
 tailcheck=measure(np.concatenate([cap,(cap+np.roll(cap,-1,axis=0))/2,center[None,:]]),hull)
 spikes=[]
 for m in source['spike_indexed']['meshes']:
  root=np.array(m['vertices'])[m['rootVertexIndices']]
  samples=np.concatenate([root,(root[:,None,:]+root[None,:,:]).reshape(-1,3)/2,root.mean(axis=0)[None,:]])
  spikes.append({'name':m['name'],'inheritedUnchangedException':m['baselineExact'],**measure(samples,hull)})
 retained=[x for x in spikes if x['inheritedUnchangedException']]
 changed=[x for x in spikes if not x['inheritedUnchangedException']]
 checks={'tailRootBurial':tailcheck['allInside'],'forefinRootBurial':all(x['allInside'] for x in fins),'spikeRootClearance':all(x['allInside'] for x in changed),'identityTransforms':True}
 return {'status':'Measured static source audit; inherited exceptions require coordinator review, not runtime admission','body':pin(BODY),'componentPins':manifest,'composition':composition,'mainHullTriangles':len(main),'mainHullVolume':volume,'checks':checks,'tail':tailcheck,'forefins':fins,'spikes':spikes,'inheritedExceptions':retained,'limitations':['Finite attachment samples are not a continuous overlap or dynamic-clearance proof.','Unchanged primary/rear spike exposure remains; no automatic waiver.','No all-component self-intersection or animation acceptance.','Source painting is retained without coplanar optimization.']}
if __name__=='__main__':
 result=audit();path=HERE/'source-attachment-audit.json'
 with path.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
 print(json.dumps({k:result[k] for k in ['status','body','mainHullTriangles','mainHullVolume','checks']}))
 print('Inherited exposure:',[(x['name'],x['maxSignedDistance']) for x in result['inheritedExceptions']])
