"""Read-only exact weighted-vertex and native hull checks for captured candidate5."""
import hashlib,json,pathlib,sys
import numpy as np
base=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission'); cap=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2])
native_path=base/'visual/frame2-native/bellback-v6-native.json';native=json.loads(native_path.read_text())
assert hashlib.sha256(native_path.read_bytes()).hexdigest()=='32e78a1677765c511645905ca7c48ad3e60d0cf7fac4a8dbd830d39e9f343d44'
trace=json.loads((cap/'render-trace.json').read_text());fixed=json.loads((cap/'fixed-trace.json').read_text())
cases=[json.loads(p.read_text()) for p in sorted(cap.glob('native-case-*.json'))]
def mat(q):
 if isinstance(q,dict):q=[q[k] for k in ['x','y','z','w']]
 x,y,z,w=q;assert abs(x*x+y*y+z*z+w*w-1)<1e-5
 return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def xyz(v):return np.array([v[k] for k in ['x','y','z']])
def local(v):
 m=np.eye(4);m[:3,:3]=mat(v[3:]);m[:3,3]=v[:3];return m
parts={};bind={};count=0
for p in native['parts']:
 v=np.array(p['positions']).reshape(-1,3);w=np.array(p['skinWeights']).reshape(-1,4);idx=np.array(p['skinIndices']).reshape(-1,4);joint=next(i for i,b in enumerate(native['bones']) if b['name']==p['name']);assert np.all(w[:,0]==1) and np.all(w[:,1:]==0) and np.all(idx[:,0]==joint)
 parts[p['name']]=np.column_stack([v,np.ones(len(v))]);bind[p['name']]=np.array(native['bones'][joint]['pos']);count+=len(v)
assert count==13374
render=[]
for r in trace:
 world=np.array(r['world']).reshape(4,4).T;poses={};mins={}
 for b in native['bones']:
  name=b['name'];pose=local(r['bones'][name]);pose=pose if b['parent'] is None else poses[b['parent']]@pose;poses[name]=pose
  inv=np.eye(4);inv[:3,3]=-bind[name];points=parts[name]@(world@pose@inv).T;mins[name]=float(points[:,1].min()-900)
 render.append({'frame':r['frame'],'gameTime':r['gameTime'],'wallTime':r['wallTime'],'scenario':r['scenario'],'alive':r['alive'],'ragdollState':(r.get('ragdoll') or {}).get('state'),'minimum':min(mins.values()),'parts':mins})
fixed_rows=[];max_support=0
for r in fixed:
 mins={};hulls={};case=next(c for c in cases if c['scenario']==r['scenario']);scale=case['initial']['root']['scale']; native_shapes={p['bone']:p for p in case['nativeShapes']}
 for s in r['shapes']:
  name=s['bone'];rot=mat(s['rotation']);p=xyz(s['position']);v=(parts[name][:,:3]-bind[name])*scale;h=np.array(native_shapes[name]['vertices']).reshape(-1,3)
  mins[name]=float((v@rot.T+p)[:,1].min()-900);hulls[name]=float((h@rot.T+p)[:,1].min()-900);max_support=max(max_support,abs(mins[name]-hulls[name]))
 fixed_rows.append({'frame':r['frame'],'gameTime':r['gameTime'],'wallTime':r['wallTime'],'scenario':r['scenario'],'phase':r['phase'],'minimum':min(mins.values()),'nativeHullMinimum':min(hulls.values()),'parts':mins})
case_results=[]
for c in cases:
 scale=c['initial']['root']['scale'];containment=[]
 for h in c['nativeShapes']:
  name=h['bone'];verts=np.array(h['vertices']).reshape(-1,3);faces=np.array(h['indices']).reshape(-1,3);original=(parts[name][:,:3]-bind[name])*scale;tri=verts[faces];norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);norm/=np.linalg.norm(norm,axis=1)[:,None];sign=np.sign(np.einsum('ij,ij->i',norm,tri[:,0]-verts.mean(axis=0)));norm*=sign[:,None];dist=original@norm.T-np.einsum('ij,ij->i',norm,tri[:,0]);containment.append({'bone':name,'originalVertices':len(original),'nativeVertices':len(verts),'nativeTriangles':len(faces),'maximumOutwardPlaneDistance':float(dist.max())})
 initial=c['initial'];bones=initial['bones'];dead=[r for r in trace if r['scenario']==c['scenario'] and not r['alive']];bone_error=max(float(np.max(np.abs(np.array(v)-np.array(bones[k])))) for r in dead for k,v in r['bones'].items());fixed_error=max(float(np.max(np.abs(np.array(v)-np.array(bones[k])))) for s in c['steps'] for k,v in s['bones'].items());shape_error=max(float(np.max(np.abs(np.r_[xyz(s['position'])-xyz(initial['shapes'][i]['localPosition']),np.array(list(s['rotation'].values()))-np.array(list(initial['shapes'][i]['localRotation'].values()))]))) for step in c['steps'] for i,s in enumerate(step['localShapes']))
 direction=np.array(initial['dir']);direction[1]=0;direction/=np.linalg.norm(direction);throw=max(2,min(2.5,initial['damage']*.04));expected=xyz(initial['velocity'])+direction*throw*.6;expected[1]=initial['velocity']['y']+throw*1.3;spin=np.cross([0,1,0],direction)*throw*2.5
 frozen=[r for r in render if r['scenario']==c['scenario'] and r['ragdollState']=='frozen'];contacts=[p['distance'] for s in c['steps'] for m in s['contacts'] for p in m['points']]
 case_results.append({'scenario':c['scenario'],'posePolicy':initial['posePolicy'],'lethal':c['lethal'],'steps':len(c['steps']),'lastResultState':c['steps'][-1]['resultState'],'containment':containment,'maximumRenderBoneDelta':bone_error,'maximumFixedBoneDelta':fixed_error,'maximumLocalColliderDelta':shape_error,'initialLinvel':initial['body']['linvel'],'initialAngvel':initial['body']['angvel'],'expectedLinvel':expected.tolist(),'expectedAngvel':spin.tolist(),'maximumInitialVelocityDelta':float(max(np.max(np.abs(expected-xyz(initial['body']['linvel']))),np.max(np.abs(spin-xyz(initial['body']['angvel']))))),'minimumNativeManifoldDistance':min(contacts) if contacts else None,'frozenSamples':len(frozen),'frozenMinimum':min(r['minimum'] for r in frozen),'frozenMaximum':max(r['minimum'] for r in frozen)})
def summary(rows):
 return {'count':len(rows),'minimum':min(r['minimum'] for r in rows),'over5mm':sum(r['minimum']<-.005 for r in rows),'worst':min(rows,key=lambda r:r['minimum'])}
result={'schema':'wildshard.bellback.captured-contact.v1','method':'Exact original 13374 unit-weight vertices: meshWorld * hierarchy * inverseBind * originalVertex. Native fixed endpoints use corresponding native collider poses and original bind-local vertices. Native hull triangle planes test containment. Flat authored arena floor Y=900 only; no fake terrain; observations are not continuous-time proof. Initial velocities compared to unchanged rigid throw constants.','source':json.loads((cap/'report.json').read_text())['source'],'vertices':count,'render':summary(render),'deadRender':summary([r for r in render if not r['alive']]),'fixedPost':summary([r for r in fixed_rows if r['phase']=='fixedPost']),'maximumNativeHullVsOriginalSupportDifference':max_support,'cases':case_results,'renderRows':render,'fixedRows':fixed_rows}
out.write_text(json.dumps(result,separators=(',',':'))+'\n'); print(json.dumps({k:v for k,v in result.items() if k not in ['renderRows','fixedRows','cases']},indent=2));print(json.dumps(case_results,indent=2))
