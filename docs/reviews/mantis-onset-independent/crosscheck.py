"""Independent active-only counterfactual, not a fresh runtime capture."""
import json, math, hashlib
from pathlib import Path
import numpy as np
out=Path(__file__).parent
base=Path('art/driftwood-isle/lowpoly-mantis/runtime-admission')
native=json.loads((base/'v7-rigid1/mantis-v7-native.json').read_text())
trace=json.loads((base/'arena-candidate4/evidence/observer-render-trace.json').read_text())
binds={b['name']:np.array(b['pos']) for b in native['bones']}
def quat(v):
 x,y,z,w=v[3:]; return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def euler(m):
 y=math.asin(max(-1,min(1,m[0,2])))
 assert abs(m[0,2])<.9999999, 'Euler singularity'
 return np.array([math.atan2(-m[1,2],m[2,2]),y,math.atan2(-m[0,1],m[0,0])])
def xyz(v):
 x,y,z=v;a,b=math.cos(x),math.sin(x);c,d=math.cos(y),math.sin(y);e,f=math.cos(z),math.sin(z)
 return np.array([[c*e,-c*f,d],[a*f+b*e*d,a*e-b*f*d,-b*c],[b*f-a*e*d,b*e+a*f*d,a*c]])
def smooth(x):
 t=max(0,min(1,x));return t*t*(3-2*t)
def points(row,new):
 posed={};changed=row['alive'] and row['stage'] in [1,3] and row['posePhase']==2 and row['poseClock']<.1
 residual=(1-smooth(row['poseClock']/.1))*(1-smooth(row['deathT'])) if changed else 0
 active=-1 if row['stage']==1 else 1
 for b in native['bones']:
  name=b['name'];v=row['bones'][name];m=np.eye(4);m[:3,:3]=quat(v);m[:3,3]=v[:3]
  if new and changed:
   d=np.zeros(3)
   if name=='body':d[0]=.1
   elif name=='neck':d[0]=.22
   for side in [-1,1]:
    if name in [f'wing{side}_0',f'wing{side}_1']:d[2]=-side*.07
    if name==f'raptor{side}':d[2]=-side*.08;d[0]=1.1 if side==active else 0
    if name==f'raptor{side}_elbow' and side==active:d[0]=-1
    if name==f'raptor{side}_hook' and side==active:d[1]=-side*.32
   m[:3,:3]=xyz(euler(m[:3,:3])+residual*d)
  posed[name]=posed[b['parent']]@m if b['parent'] else m
 world=np.array(row['world']).reshape(4,4).T
 allpoints=[]
 for p in native['parts']:
  verts=np.array(p['positions']).reshape(-1,3)-binds[p['name']]
  verts=np.column_stack((verts,np.ones(len(verts))))
  allpoints.append((world@posed[p['name']]@verts.T).T[:,:3])
 return np.vstack(allpoints)
rows=[];prev=None
for r in trace:
 old,new=points(r,False),points(r,True)
 row={'frame':r['frame'],'alive':r['alive'],'oldMinimum':float(old[:,1].min()-900),'newMinimum':float(new[:,1].min()-900),'delta':float(np.linalg.norm(new-old,axis=1).max())}
 if prev is not None:row.update(oldTravel=float(np.linalg.norm(old-prev[0],axis=1).max()),newTravel=float(np.linalg.norm(new-prev[1],axis=1).max()))
 rows.append(row);prev=(old,new)
p={'method':'Independent NumPy hierarchy and analytically derived XYZ Euler deltas from the two edited envelope terms; exact captured translations and world matrices retained. Counterfactual only; no scalar full-trace replay or visual/collider admission.','frames':len(rows),'oldMinimum':min(r['oldMinimum'] for r in rows),'newMinimum':min(r['newMinimum'] for r in rows),'deadMinimum':min(r['newMinimum'] for r in rows if not r['alive']),'changed':[r for r in rows if r['delta']>1e-10]}
(out/'world-crosscheck.json').write_text(json.dumps(p,indent=2)+'\n');print(json.dumps(p,indent=2))
