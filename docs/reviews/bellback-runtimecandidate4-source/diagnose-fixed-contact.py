"""Read-only diagnostic of completed capture, not a physics rerun or exact velocity recording."""
import pathlib,json,math,hashlib
import numpy as np
B=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission');D=B/'arena-candidate4/full-combat2'
fixed=json.loads((D/'fixed-trace.json').read_text());renders=json.loads((D/'render-trace.json').read_text());analysis=json.loads((D/'contact-analysis.json').read_text())
native=json.loads((B/'visual/frame2-native/bellback-v6-native.json').read_text());recipe=json.loads((B/'arena-candidate4/metadata.json').read_text())['bodies'][0]['dims']['rigidCorpse']
points={p['bone']:np.column_stack((p['points'],np.ones(len(p['points'])))) for p in recipe['parts']}
def mat(p,q):
 q=np.array(q);q=q/np.linalg.norm(q);x,y,z,w=q;m=np.eye(4);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,3]=p;return m
rows=[];previous=None
for index,r in enumerate(fixed):
 if r['phase']!='fixedPost':continue
 bones={}
 for b in native['bones']:
  v=r['bones'][b['name']];m=mat(v[:3],v[3:]);bones[b['name']]=m if b['parent'] is None else bones[b['parent']]@m
 shapes={s['bone']:mat([s['position'][k] for k in ('x','y','z')],[s['rotation'][k] for k in ('x','y','z','w')]) for s in r['shapes']}
 root=shapes['body']@np.linalg.inv(bones['body'])
 mins={n:float((p@shapes[n].T)[:,1].min()-900) for n,p in points.items()}
 matching=max(float(np.max(abs((p@shapes[n].T)-(p@(root@bones[n]).T)))) for n,p in points.items())
 row={'index':index,'frame':r['frame'],'scenario':r['scenario'],'deathT':r['deathT'],'minimum':min(mins.values()),'parts':mins,'maxShapeVsCurrentPoseVertexError':matching}
 if previous is not None and previous['scenario']==r['scenario']:
  prevroot,prevbones=previous['root'],previous['bones']
  dt=1/60
  row['estimatedRootLinearVelocity']=((root[:3,3]-prevroot[:3,3])/dt).tolist()
  row['estimatedRootAngularSpeed']=math.acos(float(np.clip((np.trace(prevroot[:3,:3].T@root[:3,:3])-1)/2,-1,1)))/dt
  # Motion of the hull minimum produced by pose changes alone at the previous root.
  articulated=min(float((p@(prevroot@bones[n]).T)[:,1].min()-900) for n,p in points.items())
  row['poseOnlyMinimumDeltaAtPreviousRoot']=articulated-previous['minimum']
 rows.append(row);previous={'root':root,'bones':bones,'minimum':row['minimum'],'scenario':r['scenario']}
failures=[]
for a in analysis['rows']:
 if a['alive'] or a['minimum']>=-.005:continue
 related=[r for r in rows if r['frame']==a['frame'] and r['scenario']==a['scenario']]
 render=next(r for r in renders if r['frame']==a['frame'])
 failures.append({'renderFrame':a['frame'],'scenario':a['scenario'],'renderMinimum':a['minimum'],'latestShapeMinimum':a['latestPhysicsShapeMinimum'],'renderDifference':a['renderMinusLatestShapeMinimum'],'reportedFastest':render['ragdoll']['fastest'],'fixedPost':related})
result={'schema':'wildshard.bellback.runtimecandidate4.fixed-diagnosis.v1','acceptance':False,'fixedPostObservations':len(rows),'maxCurrentPoseMismatch':max(r['maxShapeVsCurrentPoseVertexError'] for r in rows),'worstFixedPost':min(rows,key=lambda r:r['minimum']),'renderFailures':failures,'scope':'No new simulation or settings changes. Normalized quaternion matrices used only for diagnostics. Recover rigid root from body collider and current body bone; test other collider poses against current bone hierarchy. Velocity values are endpoint finite differences at nominal1/60s, not recorded linvel/angvel/contact-point velocities; impact impulses and manifold depths unavailable. FixedPre world poses excluded because they can retain prior cached world transforms until physics.step.','rows':rows}
p=D/'fixed-diagnosis.json';p.write_text(json.dumps(result,separators=(',',':'))+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ('rows','renderFailures')},indent=2));print('failing render frames',[r['renderFrame'] for r in failures])
