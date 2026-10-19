"""Read-only actual weighted foot trajectories. Run from repository root."""
import hashlib,json,math,sys
from pathlib import Path
import numpy as np
out=Path(__file__).parent
native_path=Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json')
trace_path=Path(sys.argv[1] if len(sys.argv)>1 else 'tmp/mantis-precontact-capture-run2/render-trace.json')
native=json.loads(native_path.read_text()); trace=json.loads(trace_path.read_text())
def matrix(v):
 x,y,z,w=v[3:];m=np.eye(4);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,3]=v[:3];return m
feet={}
for p in native['parts']:
 if p['name'].startswith('leg') and p['name'].endswith('_knee'):
  v=np.array(p['positions']).reshape(-1,3); ids=np.where(v[:,1]<=v[:,1].min()+.03)[0]
  feet[p['name']]=(p,ids)
def category(r):
 p=r['poseInputs']
 if not p['alive']:return 'death'
 if p['flinch']>1e-6 or r['flinch']>1e-6:return 'hit_or_flinch'
 if p['stage'] in [1,3] or r['strike']['phase']!='idle' or p['posePhase']!=0:return 'attack_or_boundary'
 if p['stage']==0 and p['speed']>.2:return 'locomotion'
 return 'stationary_or_recovery'
rows=[]
for r in trace:
 posed={}; world=np.array(r['world']).reshape(4,4).T
 for b in native['bones']:
  local=matrix(r['bones'][b['name']]);posed[b['name']]=posed[b['parent']]@local if b['parent'] else local
 row={'frame':r['frame'],'bout':r['bout'],'time':r['poseInputs']['t'],'category':category(r),'phase':r['poseInputs']['phase'],'speed':r['poseInputs']['speed'],'root':world[:3,3].tolist(),'yaw':r['yaw'],'hitEventCount':r['hitEventCount'],'feet':{}}
 for name,(p,ids) in feet.items():
  v=np.array(p['positions']).reshape(-1,3); indices=np.array(p['skinIndices']).reshape(-1,4); weights=np.array(p['skinWeights']).reshape(-1,4);assert np.max(abs(weights.sum(1)-1))<1e-7
  local=np.zeros_like(v)
  for j in np.unique(indices):
   b=native['bones'][int(j)];h=np.column_stack((v-np.array(b['pos']),np.ones(len(v)))); influence=(weights*(indices==j)).sum(1);local+=((posed[b['name']]@h.T).T[:,:3])*influence[:,None]
  w=(world@np.column_stack((local,np.ones(len(v)))).T).T[:,:3]
  offset=(0 if name in ['leg-1_0_knee','leg1_1_knee'] else .5)
  row['feet'][name]={'worldMaterialCentroid':w[ids].mean(0).tolist(),'localMaterialCentroid':local[ids].mean(0).tolist(),'minimumClearance':float(w[:,1].min()-r['floor']),'materialMinimumClearance':float(w[ids,1].min()-r['floor']),'nominalStance':math.sin(2*math.pi*(row['phase']+offset))<=0}
 rows.append(row)
pairs=[]
for a,b in zip(rows,rows[1:]):
 dt=b['time']-a['time'];root=np.linalg.norm((np.array(b['root'])-a['root'])[[0,2]])
 yaw=abs(math.atan2(math.sin(b['yaw']-a['yaw']),math.cos(b['yaw']-a['yaw'])))
 if b['bout']!=a['bout'] or not 0<dt<=.15 or root>.5 or a['hitEventCount']!=b['hitEventCount']:continue
 if a['category']!=b['category']:continue
 for name in feet:
  f,g=a['feet'][name],b['feet'][name];d=np.linalg.norm((np.array(g['worldMaterialCentroid'])-f['worldMaterialCentroid'])[[0,2]])
  pairs.append({'frames':[a['frame'],b['frame']],'foot':name,'category':a['category'],'dt':dt,'worldDistance':float(d),'rootDistance':float(root),'worldSpeed':float(d/dt),'rootSpeed':float(root/dt),'straight':yaw<=math.radians(5),'nominalStance':f['nominalStance'] and g['nominalStance'],'nearFloor':max(f['materialMinimumClearance'],g['materialMinimumClearance'])<=.03})
def stats(ps):
 return {'pairs':len(ps),'secondsSummedOverFeet':sum(p['dt'] for p in ps),'footTravel':sum(p['worldDistance'] for p in ps),'rootTravelSummedOverFeet':sum(p['rootDistance'] for p in ps),'travelRatio':sum(p['worldDistance'] for p in ps)/sum(p['rootDistance'] for p in ps) if sum(p['rootDistance'] for p in ps)>1e-9 else None,'medianFootSpeed':float(np.median([p['worldSpeed'] for p in ps])) if ps else None}
summary={}
for cat in sorted(set(r['category'] for r in rows)):
 rr=[r for r in rows if r['category']==cat];pp=[p for p in pairs if p['category']==cat]
 summary[cat]={'rows':len(rr),'allPairs':stats(pp),'straightNominalStance':stats([p for p in pp if p['straight'] and p['nominalStance']]),'straightNearFloor':stats([p for p in pp if p['straight'] and p['nearFloor']]),'feet':{}}
 for name in feet:
  xyz=np.array([r['feet'][name]['localMaterialCentroid'] for r in rr]);clear=np.array([r['feet'][name]['minimumClearance'] for r in rr])
  summary[cat]['feet'][name]={'localMaterialRangeXYZ':np.ptp(xyz,axis=0).tolist(),'minimumClearance':float(clear.min()),'maximumClearance':float(clear.max()),'nearFloorRows':int(sum(clear<=.03))}
report={'nativeSha256':hashlib.sha256(native_path.read_bytes()).hexdigest(),'traceSha256':hashlib.sha256(trace_path.read_bytes()).hexdigest(),'footSelections':{k:ids.tolist() for k,(_,ids) in feet.items()},'summary':summary,'method':'Fixed bind-lowest-30mm vertex material centroid, actual skin indices/weights, parent hierarchy and complete mesh world. Nominal stance is current knee-unflexed sine half. Near floor <=30mm is a proxy, not force/contact. Reject boundary, hit-count, bout, large-time/root and yaw pairs as specified in measure.py.'}
(out/'metrics.json').write_text(json.dumps(report,indent=2)+'\n');(out/'trajectories.json').write_text(json.dumps(rows,separators=(',',':'))+'\n');(out/'pairs.json').write_text(json.dumps(pairs,separators=(',',':'))+'\n')
print(json.dumps(summary,indent=2))
