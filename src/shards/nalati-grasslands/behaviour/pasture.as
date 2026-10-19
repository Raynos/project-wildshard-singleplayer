import { Signal, Field, Channel, Read, List, Do } from './generated/nalatiPasture';
@inline function get(field:i32):f64 { return Read.field(0,field); }
// Fixed arithmetic bounds patrol bearings without libm argument-reduction work.
@inline function bearing(y:f64,x:f64):f64 {
  const ay=Math.abs(y),ax=Math.abs(x),t=Math.min(ax,ay)/Math.max(1e-9,Math.max(ax,ay));
  let a=t*(Math.PI/4+.273*(1-t));
  if(ay>ax)a=Math.PI/2-a;if(x<0)a=Math.PI-a;
  return y<0?-a:a;
}
// Event-only actor law. The native owner publishes decisions at ten Hz.
export function onSignal(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.raidFirst) {
    Do.channel(Channel.raidT,150+Read.random()*90);
  } else if(signal==Signal.shepherdSite) {
    const x=get(Field.cx)+12,z=get(Field.cz)+16;
    Do.channel(Channel.accept,Math.abs(x)<=240&&Math.abs(z)<=240?1:0);
    Do.channel(Channel.x,x);Do.channel(Channel.z,z);Do.channel(Channel.yaw,bearing(-12,-16));
  } else if(signal==Signal.raidStart) {
    const x=get(Field.cx)-80,z=get(Field.cz)-8,spawn=get(Field.packAlive)<2&&get(Field.spawned)<2;
    Do.channel(Channel.accept,get(Field.raiding)==0&&get(Field.alive)>=20
      &&(get(Field.force)!=0||(get(Field.blocked)==0&&get(Field.distance)<=220))
      &&(!spawn||(Math.abs(x)<=230&&Math.abs(z)<=230))?1:0);
    Do.channel(Channel.spawn,spawn?1:0);Do.channel(Channel.x,x);Do.channel(Channel.z,z);
  } else if(signal==Signal.raidReady) {
    Do.channel(Channel.accept,get(Field.packAlive)>1&&get(Field.ready)!=0?1:0);
  } else if(signal==Signal.raidBegin) {
    Do.channel(Channel.raiding,1);Do.channel(Channel.pendingT,2);Do.channel(Channel.raids,get(Field.raids)+1);Do.channel(Channel.cracksNow,0);
  } else if(signal==Signal.raidRetry) {
    Do.channel(Channel.raidT,.25);
  } else if(signal==Signal.raidTick) {
    const dt=get(Field.dt);
    if(get(Field.raiding)!=0) {
      if(get(Field.present)==0){Do.channel(Channel.raiding,0);return;}
      let pending=get(Field.pendingT);
      if(pending>0){pending=get(Field.tracking)!=0?0:pending-dt;Do.channel(Channel.pendingT,pending);if(get(Field.tracking)==0&&pending>0)return;}
      if(get(Field.tracking)!=0&&get(Field.broken)==0)return;
      const outcome=get(Field.preyAlive)==0?1:get(Field.broken)!=0||get(Field.cracksNow)>0?2:0;
      Do.channel(Channel.raiding,0);Do.channel(Channel.raidT,360+Read.random()*180);Do.channel(Channel.outcome,outcome);
      if(outcome==1)Do.channel(Channel.taken,get(Field.taken)+1);else if(outcome==2)Do.channel(Channel.drivenOff,get(Field.drivenOff)+1);
    } else {const delay=get(Field.raidT)-dt;Do.channel(Channel.raidT,delay);if(delay<=0)Do.channel(Channel.attempt,1);}
  } else if(signal==Signal.shepherd) {
    const dt=get(Field.dt),hx=get(Field.px),hz=get(Field.pz),cx=get(Field.cx),cz=get(Field.cz);
    let cooldown=Math.max(0,get(Field.crackCd)-dt),rest=get(Field.restT),patrol=get(Field.patrolA),speed=0.0,yaw=get(Field.yaw);
    if(get(Field.wolf)!=0) {
      const dx=get(Field.wx)-hx,dz=get(Field.wz)-hz,d=Math.sqrt(dx*dx+dz*dz);
      yaw=bearing(dx,dz);speed=d>9?11.96:d>3?6.8:4.5;
      if(d<4.2&&cooldown<=0) {
        cooldown=1.3;Do.channel(Channel.crack,1);Do.channel(Channel.x,dx/(d==0?1:d));Do.channel(Channel.z,dz/(d==0?1:d));
        Do.channel(Channel.cracks,get(Field.cracks)+1);Do.channel(Channel.cracksNow,get(Field.cracksNow)+1);
        Do.channel(Channel.scare,(get(Field.cracksNow)+1)%2==0?1:0);
      }
    } else {
      const d=Math.sqrt((cx-hx)*(cx-hx)+(cz-hz)*(cz-hz));
      if(d>34){yaw=bearing(cx-hx,cz-hz);speed=d>45?6.8:4.5;}
      else if(rest>0){rest-=dt;}
      else {
        patrol=bearing(hx-cx,hz-cz)+.35;
        if(Read.radial(patrol,22)!=2)unreachable();yaw=bearing(cx+List.at(0)-hx,cz+List.at(1)-hz);speed=1.8;
        if(Read.random()<dt*.02)rest=6+Read.random()*8;
      }
    }
    Do.channel(Channel.crackCd,cooldown);Do.channel(Channel.restT,rest);Do.channel(Channel.patrolA,patrol);
    Do.channel(Channel.yaw,yaw);Do.channel(Channel.speed,speed);Do.channel(Channel.turn,speed>6?3.2:2.2);
    let state=speed>6?3:speed>.2?2:0;
    if(speed<=.2){if(Read.radial(get(Field.time)*.3+get(Field.seed)*5,1)!=2)unreachable();state=List.at(0)>.3?1:0;}
    Do.channel(Channel.state,state);
  }
}
