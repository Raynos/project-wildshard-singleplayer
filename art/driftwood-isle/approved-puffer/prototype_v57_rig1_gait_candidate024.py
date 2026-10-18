"""Isolated straight-line rig1 contact prototype, not runtime wiring.
Phase integrates actual forward displacement / scale. Existing eight bones only.
Stance has no fin rotation; translated distal fan cancels actor translation and
body bob. Swing resets with smoothstep and a 6cm arch. Turning, terrain, attacks
require separate integration and review. Stop/resume transitions are explicit.
"""
import hashlib,json,math
from pathlib import Path
import numpy as np
NATIVE=Path('art/driftwood-isle/approved-puffer/unaccepted-v57-motion-rig1-native.json')
DUTY=.62;STROKE=.24;LIFT=.06
OFFSETS={'finL':0.,'finR':.5,'rearL':.5,'rearR':0.}

def sample(phase,body_bob):
    """Return bone-local displacement from bind, plus true support flag."""
    q=phase%1
    if q<DUTY:return np.array([0.,-body_bob,STROKE/2-STROKE*q/DUTY]),True
    u=(q-DUTY)/(1-DUTY);ease=u*u*(3-2*u)
    return np.array([0.,-body_bob+LIFT*math.sin(math.pi*u)**2,-STROKE/2+STROKE*ease]),False

class StepState:
    """Transitions deliberately suspend the planted-support claim."""
    def __init__(self):
        self.moving=None;self.elapsed=0.;self.start=np.zeros(2);self.last=np.zeros(2)
    def advance(self,phase,bob,moving,dt):
        raw,stance=sample(phase,bob);target=np.array([raw[2],raw[1]+bob])
        if self.moving is None:self.moving=moving;self.elapsed=1.;self.last=target if moving else np.zeros(2)
        if moving!=self.moving:
            self.start=self.last.copy();self.elapsed=0.;self.moving=moving
        duration=.12 if moving else .22
        self.elapsed+=dt;u=min(1,self.elapsed/duration);ease=u*u*(3-2*u)
        if not moving:target=np.zeros(2)
        value=self.start*(1-ease)+target*ease if u<1 else target
        self.last=value
        return np.array([0.,value[1]-bob,value[0]]),bool(moving and u>=1 and stance)

def run(profile):
    data=json.loads(NATIVE.read_text());names=[b['name']for b in data['bones']]
    body=np.array(data['bones'][names.index('body')]['pos']);phase=.1;actor_z=0.;last={};worst_slip=0.;minimum_y=1e9;area_ratio=1.;root_error=0.;contacts=0
    footparts=[];states={name:StepState() for name in OFFSETS}
    for p in data['parts']:
        if not p['name'].startswith('Volumetric connected '):continue
        name=p['name'].split()[-1];v=np.array(p['positions']).reshape(-1,3);idx=np.array(p['skinIndices']).reshape(-1,4);w=np.array(p['skinWeights']).reshape(-1,4)
        finw=np.where(idx==names.index(name),w,0).sum(axis=1);root=v[:,1]>(.475 if name.startswith('fin') else .487)
        # Distal sole vertices only: these have full fin weight and should plant.
        sole=(v[:,1]<.00401)&(finw>.9999);tri=v.reshape(-1,3,3);area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
        footparts.append((name,v,finw,root,sole,area))
    dt=1/240
    for frame in range(1441):
        t=frame*dt;speed=profile(t)
        if frame:
            displacement=speed*dt;actor_z+=displacement;phase+=displacement*DUTY/STROKE
        bob=.015*(1+math.sin(t*2.4))
        for name,v,finw,root,sole,area in footparts:
            offset,stance=states[name].advance(phase+OFFSETS[name],bob,speed>1e-6,dt)
            posed=v+finw[:,None]*offset+[0,bob,actor_z]
            root_error=max(root_error,float(np.linalg.norm(posed[root]-(v[root]+[0,bob,actor_z]),axis=1).max()))
            minimum_y=min(minimum_y,float(posed[:,1].min()))
            tri=posed.reshape(-1,3,3);newarea=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1);area_ratio=min(area_ratio,float((newarea/area).min()))
            current=posed[sole]
            prior=last.get(name)
            # Exclude a hidden whole-cycle wrap between samples.
            cycle=int(phase+OFFSETS[name])
            if stance and prior is not None and prior[0] and prior[2]==cycle:
                worst_slip=max(worst_slip,float(np.linalg.norm(current-prior[1],axis=1).max()));contacts+=1
            last[name]=(stance,current,cycle)
    return {'sampledFrames':1441,'supportIntervals':contacts,'maximumSupportDisplacementPerFrame':worst_slip,'minimumLocalFloorY':minimum_y,'minimumTriangleAreaRatio':area_ratio,'maximumRootAttachmentError':root_error,'cycleHzAtPoint7':.7*DUTY/STROKE}

if __name__=='__main__':
    results={'constantPoint7':run(lambda t:.7),'accelerateDecelerate':run(lambda t:.7*max(0,math.sin(math.pi*t/6))),'stopResume':run(lambda t:.7 if t<2 or t>4 else 0)}
    for row in results.values():
        assert row['maximumRootAttachmentError']<1e-9
        assert row['minimumLocalFloorY']>=.00399
        assert row['minimumTriangleAreaRatio']>.5
        assert row['maximumSupportDisplacementPerFrame']<1e-9
    receipt={'status':'isolated numerical prototype only; no planted-foot video acceptance','nativeSha256':hashlib.sha256(NATIVE.read_bytes()).hexdigest(),'duty':DUTY,'stanceStroke':STROKE,'swingLift':LIFT,'calibratedWalkLegLen':STROKE/(2*math.sin(.36)),'scope':'straight forward movement, flat ground, no torso rotation or inflation; phase is integrated actual displacement; scale1','caveats':['0.24m stroke gives1.808Hz at0.7m/s; visual deformation/cadence unaccepted','swing/stance velocity is discontinuous; visual review required','turns, terrain and attack blending remain unimplemented; .22s stop/.12s resume are non-planted transition intervals','shared phase minimum0.6Hz needs low-speed compensation or dedicated displacement phase'],'results':results}
    out=Path('tmp/puffer-v57-rig1-gait-candidate024.json');out.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
