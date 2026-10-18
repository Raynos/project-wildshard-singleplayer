"""Exact admitted gait4 weighted fin envelope. Flat model floor, not world contact."""
import json,math,hashlib,itertools
from pathlib import Path
import numpy as np
source=Path('src/shards/driftwood-isle/generators/pufferNativeGait4Clips.ts');sha=hashlib.sha256(source.read_bytes()).hexdigest();assert sha=='501c9c6a16fa29a7f87780e263cb4ed1df9c9c2ac53077455f6a2eee08fdb4f0'
base=Path('src/shards/driftwood-isle/generators/pufferNativeClips.ts');assert hashlib.sha256(base.read_bytes()).hexdigest()=='2936bdd0072f05b2d41785333719fd9a9f1237d1fbf182d953d395bfa403bac0'
native=Path('art/driftwood-isle/approved-puffer/unaccepted-v57-motion-rig1-native.json');data=json.loads(native.read_text());names=[b['name']for b in data['bones']];bones={b['name']:np.array(b['pos'])for b in data['bones']};B=bones['body'];feet=[]
for p in data['parts']:
 if not p['name'].startswith('Volumetric connected '):continue
 name=p['name'].split()[-1];v=np.array(p['positions']).reshape(-1,3);idx=np.array(p['skinIndices']).reshape(-1,4);weights=np.array(p['skinWeights']).reshape(-1,4);fw=np.where(idx==names.index(name),weights,0).sum(axis=1);root=fw==0
 tri=v.reshape(-1,3,3);norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);area=np.linalg.norm(norm,axis=1)
 feet.append((name,v,fw,root,area,norm))
def clamp(x):return max(0,min(1,x))
def ramp(c,lo,hi):return clamp((c-lo)/(hi-lo))
def rotation(x=0,y=0,z=0):
 cx,sx=math.cos(x),math.sin(x);cy,sy=math.cos(y),math.sin(y);cz,sz=math.cos(z),math.sin(z)
 return np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])@np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])
worst={'minimumY':1e9};minarea={'ratio':1};mincos=1.;rooterror=0.;count=0
clocks=[(0,0),(2,0)]+[(1,c)for c in (0,.05,.11,.219,.22,.5,.82,.9,1,1.05,1.12,1.281,1.42,2.1)]
for (stage,clock),phase,idle,move,flinch,dead in itertools.product(clocks,np.linspace(0,1,17)[:-1],(-1,1),(0,.5,1),(0,.15,1),(0,.25,.5,1)):
 live=1-dead;active=stage==1;tell=active*ramp(clock,0,.82)*(1-ramp(clock,.9,1.12));burst=active*ramp(clock,.9,1)*(1-ramp(clock,1,1.42));swelling=1+.1*active*ramp(clock/2.1,0,.39)*(1-ramp(clock/2.1,.43,.61));gait=live*move*(1-clamp(flinch/.3))*((1-ramp(clock,0,.22))if active else 0 if stage>1.5 else 1)
 bob=.015*(1+idle);body_delta=live*(bob+.10*flinch+.03*tell+.06*burst)+.09*dead;R=rotation(x=live*(-.08*flinch-.035*tell+.06*burst),z=.35*dead);scale=np.array([1,1-.4*dead,1]);count+=1
 for name,v,fw,root,area,norm in feet:
  q=(phase+(0 if name in ('finL','rearR')else .5))%1;swing=clamp((q-.62)/.38);forward=-.12+.24*swing*swing*(3-2*swing)if q>.62 else .12-.24*q/.62
  offset=np.array([0,gait*(.06*math.sin(math.pi*swing)-bob),gait*forward]);yaw=live*(1-gait)*(1 if name.endswith('L')else -1)*(.03*idle+.07*tell-.08*burst)
  distal=(v-bones[name])@rotation(y=yaw).T+bones[name]+offset;belly=(v-B)*swelling+B;w=distal*fw[:,None]+belly*(1-fw[:,None]);rooterror=max(rooterror,float(np.linalg.norm(w[root]-belly[root],axis=1).max()));w=((w-B)*scale)@R.T+B+[0,body_delta,0]
  low=float(w[:,1].min());params=dict(stage=stage,clock=clock,phase=float(phase),idle=idle,move=move,flinch=flinch,dead=dead,bone=name)
  if low<worst['minimumY']:worst={'minimumY':low,'parameters':params}
  tri=w.reshape(-1,3,3);n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);a=np.linalg.norm(n,axis=1);ratio=float((a/area).min())
  if ratio<minarea['ratio']:minarea={'ratio':ratio,'parameters':params}
  # Compare after removing shared body rotation, so torso motion is not called a local inversion.
  baseline_normal=norm@R.T;mincos=min(mincos,float(((n*baseline_normal).sum(axis=1)/(a*area)).min()))
receipt={'status':'sampled weighted fin envelope; turning/terrain/stop discontinuities not accepted','sourceSha256':sha,'nativeSha256':hashlib.sha256(native.read_bytes()).hexdigest(),'poseSamples':count,'finEvaluations':count*4,'worstFloor':worst,'minimumTriangleArea':minarea,'minimumRelativeNormalCosine':mincos,'maximumCapToBellyError':rooterror,'limitations':['abrupt stop may jump12cm','no world terrain/ragdoll or yaw-turn contact proof','sampled envelope not continuous guarantee']}
Path('tmp/puffer-v57-rig1-gait4-audit.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
