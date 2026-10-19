"""Independent NumPy candidate curve provenance check, no channel-program evaluator."""
import json, math, pathlib, numpy as np, hashlib
root=pathlib.Path('.')
geo=json.loads((root/'tmp/conch-motion-observer-event-order1/runtime-geometry.json').read_text())[0]
bones=json.loads((root/'art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1/metadata.json').read_text())['bodies'][0]['bones']
curve=json.loads((root/'src/shards/driftwood-isle/data/conchPlantedContact.json').read_text())['heights']
v=np.column_stack([np.array(geo['positions']).reshape(-1,3),np.ones(7338)])
ix=np.array(geo['indices']).reshape(-1,4); weights=np.array(geo['weights']).reshape(-1,4)
inv=np.array([np.array(x).reshape(4,4,order='F') for x in geo['inverses']])
def rot(x,y,z):
 cx,sx,cy,sy,cz,sz=math.cos(x),math.sin(x),math.cos(y),math.sin(y),math.cos(z),math.sin(z)
 return np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])@np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])
results=[]
for i,height in enumerate(curve):
 t=i/(len(curve)-1); k=t*t*(3-2*t)
 angles={'body':(0,0,.75*k),'head':(.25*k,0,0),'eyestalkLeft':(0,0,-.18*k),'eyestalkRight':(0,0,.18*k),'shieldArm':(.4*k,0,0),'shieldForearm':(0,.3*k,0),'rapierArm':(.42*k,0,0),'rapierForearm':(0,.25*k,0)}
 for side in ['Left','Right']:
  angles['leg'+side]=(-.18*k,0,0);angles['leg'+side+'Knee']=(-.28*k,0,0);angles['leg'+side+'Ankle']=(.18*k,0,0)
 world={}
 for bone in bones:
  name,parent=bone['name'],bone['parent']; local=np.eye(4);pos=np.array(bone['pos']);local[:3,:3]=rot(*angles.get(name,(0,0,0)))
  if parent:pos=pos-np.array(next(x['pos'] for x in bones if x['name']==parent))
  local[:3,3]=pos;world[name]=local if parent is None else world[parent]@local
 skin=np.array([world[x['name']]for x in bones])@inv;out=np.zeros_like(v)
 for slot in range(4):out+=np.einsum('nij,nj->ni',skin[ix[:,slot]],v)*weights[:,slot,None]
 required=.003-float(out[:,1].min());results.append({'knot':i,'requiredHeight':required,'authoredHeight':height,'difference':height-required})
error=max(abs(x['difference'])for x in results);assert len(curve)==97 and error<1e-12
report={'method':'Independent NumPy column-major four-weight FK of canonical vertices; explicit authored collapse rotations, no TS evaluator','knots':97,'vertices':7338,'blendedVertices':int(sum((weights>0).sum(1)>1)),'maxAbsoluteHeightDifference':error,'curveSha256':hashlib.sha256((root/'src/shards/driftwood-isle/data/conchPlantedContact.json').read_bytes()).hexdigest(),'results':results}
(root/'tmp/conch-planted-offline/independent-curve.json').write_text(json.dumps(report,indent=2)+'\n');print(error)
