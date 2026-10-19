"""Offline independent NumPy reconstruction; run from repository root. No renderer imports."""
import hashlib,json,pathlib,collections
import numpy as np
BASE=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission')
OUT=BASE/'arena-candidate3/independent-review'
def read(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
npath=BASE/'visual/frame2-native/bellback-v6-native.json'
tpath=BASE/'arena-candidate3/build1/render-trace.json'
native,trace=read(npath),read(tpath)
reference=read(BASE/'arena-candidate3/build1/world-contact.json')
def local(v):
 x,y,z,w=v[3:]; m=np.eye(4)
 m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
 m[:3,3]=v[:3];return m
parts=[]
for p in native['parts']:
 verts=np.array(p['positions']).reshape(-1,3)
 weights=np.array(p['skinWeights']).reshape(-1,4); indices=np.array(p['skinIndices']).reshape(-1,4)
 joint=next(i for i,b in enumerate(native['bones']) if b['name']==p['name'])
 assert np.all(weights[:,0]==1) and np.all(weights[:,1:]==0) and np.all(indices[:,0]==joint)
 parts.append((p['name'],np.column_stack([verts,np.ones(len(verts))])))
rows=[]; max_error=0
for row,ref in zip(trace,reference['frames'],strict=True):
 world=np.array(row['world']).reshape(4,4).T; poses={}; transforms={}
 for b in native['bones']:
  pose=local(row['bones'][b['name']]); assert abs(np.linalg.norm(row['bones'][b['name']][3:])-1)<1e-6
  if b['parent'] is not None: pose=poses[b['parent']]@pose
  poses[b['name']]=pose
  inv=np.eye(4);inv[:3,3]=-np.array(b['pos']);transforms[b['name']]=world@pose@inv
 lows={name:float((verts@transforms[name].T)[:,1].min()-900) for name,verts in parts}
 max_error=max(max_error,max(abs(lows[p['name']]-p['minHeight']) for p in ref['parts']))
 rows.append({'frame':row['frame'],'gameTime':row['gameTime'],'alive':row['alive'],'deathT':row['deathT'],'min':min(lows.values()),'parts':lows})
frozen=[(r,m) for r,m in zip(trace,rows) if not r['alive'] and r['ragdoll'] and r['ragdoll']['state']=='frozen']
runs=[]
for i,r in enumerate(trace):
 key=[r['stage'],r['strike']['currentId'],r['strike']['phase'],r['alive']]
 if not runs or runs[-1]['key']!=key:runs.append({'key':key,'firstFrame':r['frame'],'firstGameTime':r['gameTime'],'firstWallMs':r['wallTime'],'count':0})
 runs[-1].update(lastFrame=r['frame'],lastGameTime=r['gameTime'],lastWallMs=r['wallTime']);runs[-1]['count']+=1
interval=np.diff([r['wallTime'] for r in trace]); clock_steps=[b['clock']-a['clock'] for a,b in zip(trace,trace[1:]) if a['stage']==b['stage'] and b['clock']>a['clock']]
result={'schema':'bellback.independent-world-review.v1','runtimeAcceptance':False,'nativeSha256':sha(npath),'traceSha256':sha(tpath),'method':'Independent NumPy quaternion hierarchy; verified each vertex has exactly one unit rigid weight. Column-major captured world times posed ancestor transforms times inverse absolute bind translation times source vertex. Ground Y=900. No Three.js or original measurement implementation used.','verticesPerFrame':sum(len(p[1]) for p in parts),'observations':len(rows),'deadObservations':sum(not r['alive'] for r in rows),'minimum':min(r['min'] for r in rows),'postFoldMinimum':min(r['min'] for r in rows if not r['alive'] and r['deathT']>=.2),'framesBelowMinus5mm':sum(r['min']<-.005 for r in rows),'maxPartMinimumDisagreement':max_error,'frozenObservations':len(frozen),'settledFeet':{k:v for k,v in frozen[-1][1]['parts'].items() if k.startswith('leg')},'frozenGameTime':[frozen[0][0]['gameTime'],frozen[-1][0]['gameTime']],'runs':runs,'cadence':{'wallIntervalsMsPercentiles':dict(zip(['min','p50','p90','p95','p99','max'],np.percentile(interval,[0,50,90,95,99,100]).tolist())),'observedRenderHz':(len(trace)-1)/((trace[-1]['wallTime']-trace[0]['wallTime'])/1000),'stateClockPositiveStepValues':sorted(set(round(x,6) for x in clock_steps)),'gameTimeSpan':trace[-1]['gameTime']-trace[0]['gameTime'],'wallSpanSeconds':(trace[-1]['wallTime']-trace[0]['wallTime'])/1000}}
(OUT/'geometry-and-cadence.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
