"""Offline support-function analysis; never a runtime collision or physics substitute."""
import hashlib,json,pathlib,itertools
import numpy as np
from scipy.spatial import ConvexHull,HalfspaceIntersection
HERE=pathlib.Path('docs/reviews/bellback-corpse-shape-study');BASE=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission')
paths=[BASE/'visual/frame2-native/bellback-v6-native.json',HERE/'dense-poses.json',BASE/'arena-candidate3/build1/render-trace.json',BASE/'arena-candidate3/full-combat1/render-trace.json']
native,dense,old,new=[json.loads(p.read_text()) for p in paths]
def local(v):
 x,y,z,w=v[3:];m=np.eye(4);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,3]=v[:3];return m
parts=[]
for p in native['parts']:
 v=np.array(p['positions']).reshape(-1,3);w=np.array(p['skinWeights']).reshape(-1,4);ind=np.array(p['skinIndices']).reshape(-1,4)
 assert np.all(w[:,0]==1) and np.all(w[:,1:]==0) and np.all(ind[:,0]==next(i for i,b in enumerate(native['bones']) if b['name']==p['name']))
 parts.append((p['name'],v,v[ConvexHull(v).vertices]))
def pose(row,full=False):
 poses={};result=[]
 for b in native['bones']:
  mat=local(row['bones'][b['name']]);poses[b['name']]=mat if b['parent'] is None else poses[b['parent']]@mat
 for name,v,h in parts:
  inv=np.eye(4);inv[:3,3]=-np.array(next(b['pos'] for b in native['bones'] if b['name']==name));mat=poses[name]@inv;p=v if full else h;result.append(p@mat[:3,:3].T+mat[:3,3])
 return result
obs=[]
for cap,trace in enumerate([old,new]):
 for i,r in enumerate(trace):
  if not r['alive'] or i+1<len(trace) and not trace[i+1]['alive']:obs.append((cap,r,pose(r,True)))
clouds=[pose(r) for r in dense]+[pose(r) for _,r,_ in obs]
# Rigid transforms preserve convexity: reducing each original part before the sweep is exact for support/containment.
perpart=[np.concatenate([v[i] for v in clouds]) for i in range(len(parts))]
hulls=[p[ConvexHull(p).vertices] for p in perpart];allpoints=np.concatenate(hulls);hull=allpoints[ConvexHull(allpoints).vertices]
lo=allpoints.min(0);hi=allpoints.max(0)
def corners(lo,hi):return np.array(list(itertools.product(*zip(lo,hi))))
boxes=np.concatenate([corners(p.min(0),p.max(0)) for p in perpart]);box=corners(lo,hi)
# Bounded outer hull from 26 support planes; every input point is contained by construction.
normals=np.array([x for x in itertools.product([-1,0,1],repeat=3) if x!=(0,0,0)],float);normals/=np.linalg.norm(normals,axis=1)[:,None]
bounds=(hull@normals.T).max(0)+1e-6
outer=HalfspaceIntersection(np.column_stack([normals,-bounds]),allpoints.mean(0)).intersections
shapes={'envelopeBox':box,'partBoxes8':boxes,'exactSweptHull':hull,'partHulls8':allpoints,'outer26PlaneHull':outer}
rows=[]
for cap,r,v in obs:
 w=np.array(r['world']).reshape(4,4).T;n=w[1,:3];mesh=np.concatenate(v);minimum=float((mesh@n).min());gaps={name:float(minimum-(p@n).min()) for name,p in shapes.items()}
 rows.append({'capture':cap,'frame':r['frame'],'alive':r['alive'],'deathT':r['deathT'],'meshFloor':minimum+float(w[1,3])-900,'gaps':gaps})
# All orientations at each dense pose: deterministic 2,000 unit normal samples plus cardinal axes.
i=np.arange(2000);y=1-2*(i+.5)/2000;a=i*np.pi*(3-np.sqrt(5));rad=np.sqrt(1-y*y);dirs=np.vstack([np.column_stack([rad*np.cos(a),y,rad*np.sin(a)]),np.eye(3),-np.eye(3)])
support={name:(p@dirs.T).max(0) for name,p in shapes.items()};worst={name:{'gap':-1} for name in shapes}
for r,cloud in zip(dense,clouds):
 mesh=np.concatenate(cloud);actual=(mesh@dirs.T).max(0)
 for name,s in support.items():
  gap=s-actual;k=int(gap.argmax())
  if gap[k]>worst[name]['gap']:worst[name]={'gap':float(gap[k]),'deathT':r['deathT'],'normal':dirs[k].tolist()}
summary={name:{'maxCapturedGap':max(r['gaps'][name] for r in rows),'oldFrozenGap':next(r['gaps'][name] for r in reversed(rows) if r['capture']==0),'frame449Gap':next(r['gaps'][name] for r in rows if r['capture']==1 and r['frame']==449),'orientationSweep':worst[name]} for name in shapes}
assert max(abs(r['gaps']['exactSweptHull']-r['gaps']['partHulls8']) for r in rows)<1e-10
assert max((allpoints@normals.T-bounds).max(0))<1e-8
result={'schema':'bellback.corpse-support-study.v1','acceptance':False,'method':'Analytical support only, exact eight-bone rigid native geometry. 1001 numeric collapse knots plus 187 recorded last-live/corpse poses. Sampling is not continuous proof or a re-simulated trajectory. Compound hull and whole hull plane support equality asserted.','inputs':[{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in paths],'vertices':sum(len(p[1]) for p in parts),'bones':len(native['bones']),'denseSamples':len(dense),'observations':len(rows),'hullVertices':len(hull),'partHullVertices':[len(p) for p in hulls],'outerHullVertices':len(outer),'box':{'center':((lo+hi)/2).tolist(),'halfExtents':((hi-lo)/2).tolist()},'summary':summary,'rows':rows}
(HERE/'support-results.json').write_text(json.dumps(result,indent=2)+'\n')
(HERE/'candidate-shapes.json').write_text(json.dumps({'proposalOnly':True,'outer26PlaneHull':outer.tolist(),'exactSweptHull':hull.tolist(),'partHulls8':[p.tolist() for p in hulls],'partBoxes8':[{'center':((p.min(0)+p.max(0))/2).tolist(),'halfExtents':((p.max(0)-p.min(0))/2).tolist()} for p in perpart]},separators=(',',':'))+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['rows','inputs']},indent=2))
