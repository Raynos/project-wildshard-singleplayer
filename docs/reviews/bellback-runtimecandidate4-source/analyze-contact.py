"""Independent NumPy reconstruction of exact captured render and Rapier shape poses.
Read-only original geometry. Writes only a supplied new diagnostic result.
"""
import json,pathlib,sys,hashlib
import numpy as np
base=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission')
tracepath=pathlib.Path(sys.argv[1]);output=pathlib.Path(sys.argv[2])
trace=json.loads(tracepath.read_text());native=json.loads((base/'visual/frame2-native/bellback-v6-native.json').read_text())
recipe=json.loads((base/'arena-candidate4/metadata.json').read_text())['bodies'][0]['dims']['rigidCorpse']
assert hashlib.sha256((base/'visual/frame2-native/bellback-v6-native.json').read_bytes()).hexdigest()=='32e78a1677765c511645905ca7c48ad3e60d0cf7fac4a8dbd830d39e9f343d44'
def matrix(p,q):
 x,y,z,w=q;assert abs(sum(a*a for a in q)-1)<1e-5
 m=np.eye(4);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,3]=p;return m
parts={p['name']:np.column_stack((np.array(p['positions']).reshape(-1,3)-np.array(next(b['pos'] for b in native['bones'] if b['name']==p['name'])),np.ones(len(p['positions'])//3))) for p in native['parts']}
hulls={p['bone']:np.column_stack((p['points'],np.ones(len(p['points'])))) for p in recipe['parts']}
rows=[]
for r in trace:
 world=np.array(r['world']).reshape(4,4).T;mats={};lows={};hull_lows={}
 for b in native['bones']:
  v=r['bones'][b['name']];m=matrix(v[:3],v[3:]);mats[b['name']]=m if b['parent'] is None else mats[b['parent']]@m
 for name,points in parts.items():
  m=world@mats[name];lows[name]=float((points@m.T)[:,1].min()-900);hull_lows[name]=float((hulls[name]@m.T)[:,1].min()-900)
 support_gap=max(abs(lows[n]-hull_lows[n]) for n in parts);assert support_gap<1e-9
 shapes=(r.get('ragdoll') or {}).get('shapes',[]);shape_min=None
 if shapes:
  assert len(shapes)==8
  values=[]
  for idx,s in enumerate(shapes):
   # Source creation keeps exact recipe order; bone names are checked when populated.
   name=recipe['parts'][idx]['bone'];assert s['bone'] in ('',name)
   m=matrix([s['position'][k] for k in ('x','y','z')],[s['rotation'][k] for k in ('x','y','z','w')]);values.append(float((hulls[name]@m.T)[:,1].min()-900))
  shape_min=min(values)
 rows.append({'frame':r['frame'],'scenario':r['scenario'],'alive':r['alive'],'deathT':r['deathT'],'state':(r.get('ragdoll') or {}).get('state'),'minimum':min(lows.values()),'parts':lows,'samePoseSupportGap':support_gap,'latestPhysicsShapeMinimum':shape_min,'renderMinusLatestShapeMinimum':None if shape_min is None else min(lows.values())-shape_min})
scenarios={}
for s in sorted(set(r['scenario'] for r in rows if not r['alive'])):
 dead=[r for r in rows if r['scenario']==s and not r['alive']];frozen=[r for r in dead if r['state']=='frozen']
 scenarios[s]={'deadFrames':len(dead),'minimum':min(r['minimum'] for r in dead),'penetratingFrames':sum(r['minimum']<-.005 for r in dead),'frozenFrames':len(frozen),'frozenMinimum':min((r['minimum'] for r in frozen),default=None),'frozenMaximumMinimum':max((r['minimum'] for r in frozen),default=None),'worst':min(dead,key=lambda r:r['minimum'])}
result={'schema':'wildshard.bellback.runtimecandidate4.contact.v1','runtimeAcceptance':False,'contactAcceptance':False,'traceSha256':hashlib.sha256(tracepath.read_bytes()).hexdigest(),'frames':len(rows),'verticesPerFrame':13374,'maximumSamePoseSupportGap':max(r['samePoseSupportGap'] for r in rows),'scenarios':scenarios,'limits':'Original rigid vertices and bone/root transforms, floor Y900. Same-pose support equality does not establish dynamic contacts. Latest collider world poses differ from interpolated render poses by design; report their gap, never interpret it as same-time support mismatch. No slope or physical-phone proof. Initial fixed steps may precede observation wrapper.','rows':rows}
output.write_text(json.dumps(result,separators=(',',':'))+'\n');print(json.dumps({k:v for k,v in result.items() if k!='rows'},indent=2))
