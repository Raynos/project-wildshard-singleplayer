"""One bounded offline Fourier fit. No runtime solver, product edit, or acceptance."""
import json, math, hashlib
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
OUT=Path(__file__).parent
NATIVE=Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json')
N=json.loads(NATIVE.read_text()); BONES={b['name']:b for b in N['bones']}
H=8; STANCE=.62; DISTANCE=2*1.399999976158142*math.sin(.36)/.62/2

def basis(p, derivative=0):
 p=np.asarray(p); rows=[np.ones_like(p) if derivative==0 else np.zeros_like(p)]
 for k in range(1,H+1):
  w=2*np.pi*k
  rows.extend([w**derivative*np.cos(w*p+derivative*np.pi/2),w**derivative*np.sin(w*p+derivative*np.pi/2)])
 return np.stack(rows,axis=-1)

def rotation(q,side):
 x,z,k,y=np.moveaxis(q,-1,0); y=y*side;z=z*side;k=k*side
 def eye():return np.broadcast_to(np.eye(3),(*x.shape,3,3)).copy()
 rx=eye();ry=eye();rz=eye();rk=eye()
 for r,a,u,v in [(rx,x,1,2),(ry,y,2,0),(rz,z,0,1),(rk,k,0,1)]:
  c=np.cos(a);s=np.sin(a);r[...,u,u]=c;r[...,v,v]=c;r[...,u,v]=-s;r[...,v,u]=s
 return rx@ry@rz,rk

def geometry(name):
 part=next(p for p in N['parts'] if p['name']==name); v=np.array(part['positions']).reshape(-1,3)
 ids=np.flatnonzero(v[:,1]<=v[:,1].min()+.03);hip=np.array(BONES[name[:-5]]['pos']);knee=np.array(BONES[name]['pos']);side=-1 if name.startswith('leg-') else 1
 return v,ids,hip,knee,side

def posed(q,name):
 v,ids,hip,knee,side=geometry(name);r,k=rotation(q,side)
 return np.einsum('...ij,...vj->...vi',r,np.einsum('...ij,vj->...vi',k,v-knee)+knee-hip)+hip

def target(p,name):
 v,ids,hip,knee,side=geometry(name);c=v[ids].mean(0);u=np.maximum(0,(p-STANCE)/(1-STANCE));e=DISTANCE*STANCE
 a1=-DISTANCE*(1-STANCE);a3,a4,a5=np.linalg.solve([[1,1,1],[3,4,5],[6,12,20]],[e-a1,0,0])
 z=np.where(p<STANCE,e/2-DISTANCE*p,-e/2+a1*u+a3*u**3+a4*u**4+a5*u**5)
 offset=0 if name in ['leg-1_0_knee','leg1_1_knee'] else .5
 bob=.02*np.abs(np.sin(np.pi*(p-offset)))
 return np.stack([np.full_like(p,c[0]-side*.12),.015+.12*np.sin(np.pi*u)**2-bob,c[2]+z+(-.20 if '_0_' in name else .10)],axis=-1),bob

def run():
 seed=json.loads(Path('docs/reviews/mantis-gait-audit/reach.json').read_text());p=np.arange(128)/128;b=basis(p); fits={}
 for name in seed['results']:
  angles=np.array([s['anglesHipXMirroredZKneeZHipY'] for s in seed['samples'] if s['foot']==name])[:-1]
  initial=np.linalg.lstsq(b,angles,rcond=None)[0];v,ids,hip,knee,side=geometry(name);desired,bob=target(p,name)
  weights=np.array([.15,.3,.45,.6,.8]);reg=np.array([0]+[k*k for k in range(1,H+1) for _ in range(2)])[:,None]
  def residual(flat):
   co=flat.reshape(2*H+1,4);q=b@co;vv=posed(q,name);cc=vv[:,ids].mean(1)
   actual=np.stack([cc[:,0],vv[:,:,1].min(1),cc[:,2]],axis=-1)
   blend=posed(q[None]*weights[:,None,None],name)[:,:,:,1].min(-1)+bob[None]*weights[:,None]-.008
   bounds=np.maximum(np.abs(q[:,:2])-.65,0)
   return np.concatenate([(actual-desired).ravel(),(3*np.minimum(blend-.001,0)).ravel(),(.00002*reg*co).ravel(),bounds.ravel()])
  opt=least_squares(residual,initial.ravel(),max_nfev=100,ftol=1e-9,xtol=1e-9,gtol=1e-9)
  fits[name]={'coefficients':opt.x.reshape(2*H+1,4).tolist(),'success':bool(opt.success),'status':int(opt.status),'evaluations':opt.nfev,'cost':float(opt.cost),'message':opt.message}
  (OUT/'fit.json').write_text(json.dumps({'harmonics':H,'stance':STANCE,'distance':DISTANCE,'nativeSha256':hashlib.sha256(NATIVE.read_bytes()).hexdigest(),'fits':fits},indent=2)+'\n')
  print(name,opt.success,opt.nfev,opt.cost,flush=True)
if __name__=='__main__':run()
