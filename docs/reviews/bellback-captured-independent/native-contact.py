"""Independent exact-native-hull contact/support audit, including creation and terminal step."""
import json,pathlib,sys,numpy as np
base=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission');cap=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);n=json.loads((base/'visual/frame2-native/bellback-v6-native.json').read_text())
v={p['name']:np.array(p['positions']).reshape(-1,3)-np.array(next(b['pos'] for b in n['bones'] if b['name']==p['name'])) for p in n['parts']}
def pose(s):
 q=s['rotation'];x,y,z,w=[q[k] for k in ['x','y','z','w']];assert abs(x*x+y*y+z*z+w*w-1)<1e-5
 return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]),np.array([s['position'][k] for k in ['x','y','z']])
results=[]
for file in sorted(cap.glob('native-case-*.json')):
 c=json.loads(file.read_text());hulls={p['bone']:np.array(p['vertices']).reshape(-1,3) for p in c['nativeShapes']};maxPlane=-1e9
 for p in c['nativeShapes']:
  hv=hulls[p['bone']];faces=np.array(p['indices']).reshape(-1,3);tri=hv[faces];norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);norm/=np.linalg.norm(norm,axis=1)[:,None];center=hv.mean(0);flip=np.sum(norm*(center-tri[:,0]),axis=1)>0;norm[flip]*=-1
  dist=v[p['bone']]@norm.T-np.sum(norm*tri[:,0],axis=1);maxPlane=max(maxPlane,float(dist.max()))
 rows=[];gap=0
 def record(shapes,idx,frame,state):
  global gap
  assert len(shapes)==8
  minima={};native={}
  for s in shapes:
   assert not s['sensor'];rot,pos=pose(s);bone=s['bone'];a=float((v[bone]@rot.T+pos)[:,1].min()-900);b=float((hulls[bone]@rot.T+pos)[:,1].min()-900);gap=max(gap,abs(a-b));minima[bone]=a;native[bone]=b
  rows.append({'step':idx,'frame':frame,'state':state,'minimum':min(minima.values()),'parts':minima,'nativeHullMinimum':min(native.values())})
 record(c['initial']['shapes'],-1,c['lethal']['frame'],'initial')
 for i,s in enumerate(c['steps']):record(s['worldShapes'],i,s['frame'],s['resultState'])
 velocities=[s['after'] for s in c['steps']];contacts=[m for s in c['steps'] for m in s['contacts']];distances=[p['distance'] for m in contacts for p in m['points']];impulses=[p['impulse'] for m in contacts for p in m['points']]
 local=[[(p['position'],p['rotation']) for p in s['localShapes']] for s in c['steps']]
 localFrozen=all(x==local[0] for x in local)
 initialBones=c['initial']['bones'];boneDelta=max(abs(a-b) for s in c['steps'] for name,values in s['bones'].items() for a,b in zip(values,initialBones[name]))
 results.append({'file':file.name,'scenario':c['scenario'],'lethal':c['lethal'],'count':len(rows),'postSteps':len(c['steps']),'minimum':min(x['minimum'] for x in rows),'penetrating':sum(x['minimum']<-.005 for x in rows),'worst':min(rows,key=lambda x:x['minimum']),'lastState':c['steps'][-1]['resultState'],'maximumOriginalVsNativeSupportDifference':gap,'maximumOriginalOutwardNativePlaneDistance':maxPlane,'fixedLocalShapesIdentical':localFrozen,'fixedBoneMaximumDeltaFromLethal':boneDelta,'minimumManifoldDistance':min(distances) if distances else None,'maximumManifoldImpulse':max(impulses) if impulses else None,'contactManifolds':len(contacts),'initialBody':c['initial']['body'],'terminalBody':c['steps'][-1]['after'],'rows':rows})
out.write_text(json.dumps({'method':'All original bind-local vertices transformed by actual eight recorded native collider world poses. Convex native triangle planes check containment; native hull support independently compared. Initial creation and all recorded post-solver steps through frozen result included. Flat floor Y900; 5mm threshold. No mixed render pose used.','cases':results},separators=(',',':'))+'\n');print(json.dumps([{k:v for k,v in x.items() if k not in ['rows','initialBody','terminalBody']} for x in results],indent=2))
