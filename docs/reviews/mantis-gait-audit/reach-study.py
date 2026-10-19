"""Offline reach study only: not product animation, a fitted clip or acceptance."""
import json,math,sys
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
out=Path(__file__).parent
variant=sys.argv[1] if len(sys.argv)>1 else 'signed-knee'
assert variant in ['wide','positive-knee','signed-knee']
n=json.loads(Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json').read_text());bones={b['name']:b for b in n['bones']}
# Existing walk phase at 1.15 m/s, scale=1. Two authored steps per unchanged phase cycle.
base_distance=2*1.399999976158142*math.sin(.36)/.62
stance=.62; step_distance=base_distance/2; excursion=step_distance*stance
# Quintic swing joins linear stance with matching derivatives and acceleration.
# z(u)=a0+a1*u+... ; first derivative in normalized swing u.
a0=-excursion/2;a1=-step_distance*(1-stance);a2=0
A=np.array([[1,1,1],[3,4,5],[6,12,20]])
a3,a4,a5=np.linalg.solve(A,[excursion-a1,0,0])
def arc(p):
 if p<stance:return excursion/2-step_distance*p,.015
 u=(p-stance)/(1-stance)
 return a0+a1*u+a3*u**3+a4*u**4+a5*u**5,.015+.12*math.sin(math.pi*u)**2
def rx(a):
 c,s=math.cos(a),math.sin(a);return np.array([[1,0,0],[0,c,-s],[0,s,c]])
def ry(a):
 c,s=math.cos(a),math.sin(a);return np.array([[c,0,s],[0,1,0],[-s,0,c]])
def rz(a):
 c,s=math.cos(a),math.sin(a);return np.array([[c,-s,0],[s,c,0],[0,0,1]])
result={}; records=[]
for p in n['parts']:
 name=p['name']
 if not(name.startswith('leg') and name.endswith('_knee')):continue
 side=-1 if name.startswith('leg-') else 1; hip=bones[name[:-5]];knee=bones[name];v=np.array(p['positions']).reshape(-1,3);ids=np.where(v[:,1]<=v[:,1].min()+.03)[0];bindcent=v[ids].mean(0)
 indices=np.array(p['skinIndices']).reshape(-1,4);weights=np.array(p['skinWeights']).reshape(-1,4)
 # Verify rigid ownership before simplifying this reach-only model.
 joint=n['bones'].index(knee);assert np.all(np.sum(weights*(indices==joint),axis=1)==1)
 def posed(q):
  R=rx(q[0])@ry(side*q[3] if len(q)>3 else 0)@rz(side*q[1]);return (R@((rz(side*q[2])@(v-np.array(knee['pos'])).T)+np.array(knee['pos'])[:,None]-np.array(hip['pos'])[:,None])).T+hip['pos']
 prev=np.array([0.,0.,.05]) if variant=='wide' else np.array([0.,0.,.05,0.]) if variant=='positive-knee' else np.array([0.,.1,-.3,0.]);errors=[];angles=[];clearances=[]
 for i in range(129):
  phase=i/128;dz,y=arc(phase%1)
  target=np.array([bindcent[0],y,bindcent[2]+dz]) if variant=='wide' else np.array([bindcent[0]-side*.12,y,bindcent[2]+dz+(-.20 if '_0_' in name else .10)])
  def residual(q):
   vv=posed(q);cc=vv[ids].mean(0)
   return [cc[0]-target[0],vv[:,1].min()-target[1],cc[2]-target[2]]
  opt=least_squares(residual,prev,bounds=([-.65,-.65,0],[.65,.65,.95]) if variant=='wide' else ([-.65,-.65,0,-.65],[.65,.65,1.2,.65]) if variant=='positive-knee' else ([-.65,-.65,-1.2,-.65],[.65,.65,1.2,.65]),xtol=1e-12,ftol=1e-12,gtol=1e-12);prev=opt.x
  vv=posed(opt.x);err=float(np.linalg.norm(residual(opt.x)));errors.append(err);angles.append(opt.x.tolist());clearances.append(float(vv[:,1].min()))
  records.append({'foot':name,'phase':phase,'anglesHipXMirroredZKneeZHipY':opt.x.tolist(),'target':target.tolist(),'targetError':err,'minimum':float(vv[:,1].min())})
 result[name]={'maxTargetError':max(errors),'minimum':min(clearances),'angleMin':np.min(angles,axis=0).tolist(),'angleMax':np.max(angles,axis=0).tolist(),'seamAngleError':float(np.linalg.norm(np.array(angles[0])-angles[-1]))}
report={'scope':'Offline rigid knee-weighted foot reach only, no runtime changes, no fitted channel evaluation. Body fixed at bind. Whole-body and actual body-bob composition still require testing. Knee part rigid weights verified. No leg lengths or bind geometry changed.','baseDistancePerPhase':base_distance,'presentationMultiplier':2,'distancePerAuthoredCycle':step_distance,'stanceFraction':stance,'stanceExcursion':excursion,'swingLift':.12,'authoredFootCenterAdjustment':{'xInward':.12,'frontZ':-.20,'rearZ':.10},'swingPolynomial':[a0,a1,a2,a3,a4,a5],'results':result,'samples':records}
(out/({'wide':'rejected-wide-reach.json','positive-knee':'rejected-positive-knee-reach.json','signed-knee':'reach.json'}[variant])).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='samples'},indent=2))
