import json,pathlib,numpy as np
base=pathlib.Path('docs/reviews/bellback-runtimecandidate5-actual');c=json.loads((base/'native-case-0.json').read_text());native=json.loads(pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json').read_text())
def xyz(v):return np.array([v[k] for k in ['x','y','z']])
def rot(q):
 x,y,z,w=[q[k] for k in ['x','y','z','w']];return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
rows=[]
for i,s in enumerate(c['steps']):
 low=(float('inf'),None,None,None)
 for sh in s['worldShapes']:
  part=next(p for p in native['parts'] if p['name']==sh['bone']);bind=next(b['pos'] for b in native['bones'] if b['name']==sh['bone']);v=(np.array(part['positions']).reshape(-1,3)-bind)*c['initial']['root']['scale'];points=v@rot(sh['rotation']).T+xyz(sh['position']);j=int(np.argmin(points[:,1]));h=points[j,1]-900
  if h<low[0]:low=(float(h),sh['bone'],v[j],points[j])
 if low[0]<-.005:
  initialsh=next(p for p in c['initial']['shapes'] if p['bone']==low[1]);bodylocal=rot(initialsh['localRotation'])@low[2]+xyz(initialsh['localPosition']);states={}
  for phase,b in [('before',s['before']),('after',s['after'])]:
   # Native mass properties are deferred until first integration; use admitted explicit local COM for step0.
   com=xyz(b['localCom']) if b['mass'] else np.array([0,c['initial']['dims']['bodyY']*.6*c['initial']['root']['scale'],0]);arm=rot(b['rotation'])@(bodylocal-com);velocity=xyz(b['linvel'])+np.cross(xyz(b['angvel']),arm);states[phase]={'linvel':b['linvel'],'angvel':b['angvel'],'pointVelocity':velocity.tolist(),'rootPosition':b['position'],'ccd':b['ccd']}
  rows.append({'step':i,'time':sum(x['dt'] for x in c['steps'][:i+1]),'frame':s['frame'],'minimum':low[0],'bone':low[1],'minimumVertexWorld':low[3].tolist(),'states':states,'minimumManifold':min(p['distance'] for m in s['contacts'] for p in m['points'])})
result={'classification':'Initial rotational contact transient, not resting residual. All >5mm fixed endpoints occur in first three 60Hz steps (<=50ms) after immediate lethal throw. Root rises while initial rear-foot rotational point velocity goes downward; response reverses point normal velocity and penetration decays. CCD is false. This supports investigating temporal contact resolution but does not demonstrate CCD correctness; no CCD changes or run made.','initialCCD':c['initial']['body']['ccd'],'rows':rows,'final':{'state':c['steps'][-1]['resultState'],'time':sum(s['dt'] for s in c['steps']),'linvel':c['steps'][-1]['after']['linvel'],'angvel':c['steps'][-1]['after']['angvel']}}
p=pathlib.Path('docs/reviews/bellback-captured-solver-study/impact-classification.json');p.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
