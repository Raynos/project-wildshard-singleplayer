"""Cross-frame replica of frozen preview wrapper; actual rig1 weighted vertices."""
import math,json,hashlib,itertools
from pathlib import Path
import numpy as np
wrapper=Path('src/pufferGaitContinuityPreview.ts');sha=hashlib.sha256(wrapper.read_bytes()).hexdigest();assert sha=='54662e9d697533877bb2c7cbe0a29ae415769416d6db3223558a1ab67feeb15d'
data=json.loads(Path('art/driftwood-isle/approved-puffer/unaccepted-v57-motion-rig1-native.json').read_text());names=[b['name']for b in data['bones']];bones={b['name']:np.array(b['pos'])for b in data['bones']};B=bones['body'];feet=[]
for p in data['parts']:
 if not p['name'].startswith('Volumetric connected '):continue
 name=p['name'].split()[-1];v=np.array(p['positions']).reshape(-1,3);ids=np.array(p['skinIndices']).reshape(-1,4);w=np.array(p['skinWeights']).reshape(-1,4);fw=np.where(ids==names.index(name),w,0).sum(axis=1);tri=v.reshape(-1,3,3);n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);feet.append((name,v,fw,np.linalg.norm(n,axis=1)))
def clamp(v):return max(0,min(1,v))
def ramp(c,lo,hi):return clamp((c-lo)/(hi-lo))
def rot(r):
 x,y,z=r;cx,sx=math.cos(x),math.sin(x);cy,sy=math.cos(y),math.sin(y);cz,sz=math.cos(z),math.sin(z)
 return np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])@np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])
def target(t,phase,speed,stage,clock,hit,dead):
 idle=math.sin(t*2.4);live=1-dead;active=stage==1;tell=active*ramp(clock,0,.82)*(1-ramp(clock,.9,1.12));burst=active*ramp(clock,.9,1)*(1-ramp(clock,1,1.42));gait=live*clamp(abs(speed)/(.6*.24/.62))*(1-clamp(hit/.3))*((1-ramp(clock,0,.22))if active else 0 if stage>1.5 else 1);bob=.015*(1+idle)
 out={'bodyY':.6+live*(bob+.1*hit+.03*tell+.06*burst)+.09*dead,'bodyR':np.array([live*(-.08*hit-.035*tell+.06*burst),0,.35*dead]),'bodySY':1-.4*dead,'swell':1+.1*active*ramp(clock/2.1,0,.39)*(1-ramp(clock/2.1,.43,.61)),'feet':{}}
 for name,_,_,_ in feet:
  q=(phase+(0 if name in('finL','rearR')else .5))%1;s=clamp((q-.62)/.38);forward=-.12+.24*s*s*(3-2*s)if q>.62 else .12-.24*q/.62
  pos=np.array([0,gait*(.06*math.sin(math.pi*s)-bob),gait*forward]);r=np.array([0,live*(1-gait)*(1 if name.endswith('L')else -1)*(.03*idle+.07*tell-.08*burst),0]);out['feet'][name]=(pos,r)
 return out
worst={'y':1e9};maxlift={'lift':0};minarea=1.;rooterror=0.;frames=0;cases=0;scenario_lifts={};maximum_guard_lift=0.
for scenario,dt,seed,timeoffset in itertools.product(('stop','attack','resume','rapid','hit','death','repeat'),(1/60,1/30,.1,.2,.3),(0,.2,.5,.8),(0,.65,1.3)):
 history=None;blend=None;phase=seed;cases+=1
 for k in range(int(3/dt)+1):
  elapsed=k*dt;t=timeoffset+elapsed;stage=0;clock=0;speed=.7;hit=0;dead=0
  if scenario=='repeat':t=timeoffset+math.floor(elapsed/.1)*.1
  if scenario in('rapid','repeat'):speed=.7 if int(elapsed/.075)%2==0 else 0
  elif elapsed>=.6:
   if scenario in('stop','resume'):speed=0 if scenario=='stop' or elapsed<1.2 else .7
   elif scenario in('attack','hit','death'):speed=0;stage=1;clock=elapsed-.6
  if scenario=='hit' and elapsed>=.65:hit=math.exp(-5.5*(elapsed-.65))
  if scenario=='death' and elapsed>=.9:dead=clamp((elapsed-.9)/.8)
  phase=(phase+max(.6,speed*.62/.24)*dt)%1 if speed>0 else phase
  raw=target(t,phase,speed,stage,clock,hit,dead);shown={**raw,'feet':{name:(pos.copy(),r.copy())for name,(pos,r)in raw['feet'].items()}};moving=abs(speed)>.001
  if history is None or dead>0 or dt>.25 or hit>history['hit']:blend=None
  else:
   stopped=history['moving']and not moving;entered=history['stage']!=1 and stage==1;resumed=not history['moving']and moving and stage==0
   if stopped or entered or resumed:blend={'from':history['shown'],'elapsed':0,'duration':.12 if resumed else .22}
   elif blend is not None and t>history['time']:blend['elapsed']+=dt
   if blend is not None:
    u=min(1,blend['elapsed']/blend['duration']);a=u*u*(3-2*u);old=blend['from'];angle=abs(old['bodyR']-raw['bodyR']).sum();up=max(.8,abs(math.cos(raw['bodyR'][0])*math.cos(raw['bodyR'][2])))
    for name,(pos,r)in raw['feet'].items():
     oldpos,oldr=old['feet'][name];p=oldpos*(1-a)+pos*a;rr=oldr+(r-oldr)*a;guard=(1-a)*(old['bodyY']-raw['bodyY']+2*(angle+a*abs(oldr-r).sum()))/up;maximum_guard_lift=max(maximum_guard_lift,guard);p[1]+=guard;shown['feet'][name]=(p,rr)
    if u>=1:blend=None
  R=rot(raw['bodyR']);ctx={'scenario':scenario,'dt':dt,'seed':seed,'timeOffset':timeoffset,'elapsed':elapsed}
  for name,v,fw,area in feet:
   pos,r=shown['feet'][name];distal=(v-bones[name])@rot(r).T+bones[name]+pos;belly=(v-B)*raw['swell']+B;w=distal*fw[:,None]+belly*(1-fw[:,None]);rooterror=max(rooterror,float(np.linalg.norm(w[fw==0]-belly[fw==0],axis=1).max()));w=((w-B)*[1,raw['bodySY'],1])@R.T+B+[0,raw['bodyY']-.6,0]
   low=float(w[:,1].min());lift=float(pos[1]-raw['feet'][name][0][1]);tri=w.reshape(-1,3,3);a=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1);minarea=min(minarea,float((a/area).min()))
   if low<worst['y']:worst={'y':low,'bone':name,**ctx}
   scenario_lifts[scenario]=max(scenario_lifts.get(scenario,0),lift)
   if lift>maxlift['lift']:maxlift={'lift':lift,'bone':name,**ctx}
  frames+=1;history={'shown':shown,'moving':moving,'stage':stage,'hit':hit,'time':t}
receipt={'status':'sampled cross-frame prototype audit; no visual acceptance','wrapperSha256':sha,'cases':cases,'maximumGuardAddedY':maximum_guard_lift,'maximumAddedYByScenario':scenario_lifts,'frames':frames,'worstFloor':worst,'maximumAdditionalFootY':maxlift,'minimumTriangleAreaRatio':minarea,'maximumCapToBellyError':rooterror,'limitations':['flat model floor only','no yaw-turn/world-ragdoll/terrain contact','recorded wrapper dt uses existing pose delta']}
Path('tmp/puffer-v57-gait5-corrected-continuity-audit.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
