import { Signal, Field, Channel, Params, Read, Do } from './generated/nalatiMounts';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,n:f64):void{Do.channel(id,n);}
@inline export function approachEntry(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.select){
    let index:i32=-1,best:f64=1e12;
    { const i:i32=1;if(i<=i32(f(Field.count))&&Read.field(i,Field.alive)!=0&&!(f(Field.bonded)>0&&(f(Field.argymaq)>0||Read.field(i,Field.argymaq)==0))){
 const dx=Read.field(i,Field.x)-f(Field.px),dy=Read.field(i,Field.y)-f(Field.py),dz=Read.field(i,Field.z)-f(Field.pz),d=Math.sqrt(dx*dx+dy*dy+dz*dz);
 if(d<best){best=d;index=i-1;}
}}
{ const i:i32=2;if(i<=i32(f(Field.count))&&Read.field(i,Field.alive)!=0&&!(f(Field.bonded)>0&&(f(Field.argymaq)>0||Read.field(i,Field.argymaq)==0))){
 const dx=Read.field(i,Field.x)-f(Field.px),dy=Read.field(i,Field.y)-f(Field.py),dz=Read.field(i,Field.z)-f(Field.pz),d=Math.sqrt(dx*dx+dy*dy+dz*dz);
 if(d<best){best=d;index=i-1;}
}}
{ const i:i32=3;if(i<=i32(f(Field.count))&&Read.field(i,Field.alive)!=0&&!(f(Field.bonded)>0&&(f(Field.argymaq)>0||Read.field(i,Field.argymaq)==0))){
 const dx=Read.field(i,Field.x)-f(Field.px),dy=Read.field(i,Field.y)-f(Field.py),dz=Read.field(i,Field.z)-f(Field.pz),d=Math.sqrt(dx*dx+dy*dy+dz*dz);
 if(d<best){best=d;index=i-1;}
}}
{ const i:i32=4;if(i<=i32(f(Field.count))&&Read.field(i,Field.alive)!=0&&!(f(Field.bonded)>0&&(f(Field.argymaq)>0||Read.field(i,Field.argymaq)==0))){
 const dx=Read.field(i,Field.x)-f(Field.px),dy=Read.field(i,Field.y)-f(Field.py),dz=Read.field(i,Field.z)-f(Field.pz),d=Math.sqrt(dx*dx+dy*dy+dz*dz);
 if(d<best){best=d;index=i-1;}
}}
{ const i:i32=5;if(i<=i32(f(Field.count))&&Read.field(i,Field.alive)!=0&&!(f(Field.bonded)>0&&(f(Field.argymaq)>0||Read.field(i,Field.argymaq)==0))){
 const dx=Read.field(i,Field.x)-f(Field.px),dy=Read.field(i,Field.y)-f(Field.py),dz=Read.field(i,Field.z)-f(Field.pz),d=Math.sqrt(dx*dx+dy*dy+dz*dz);
 if(d<best){best=d;index=i-1;}
}}
{ const i:i32=6;if(i<=i32(f(Field.count))&&Read.field(i,Field.alive)!=0&&!(f(Field.bonded)>0&&(f(Field.argymaq)>0||Read.field(i,Field.argymaq)==0))){
 const dx=Read.field(i,Field.x)-f(Field.px),dy=Read.field(i,Field.y)-f(Field.py),dz=Read.field(i,Field.z)-f(Field.pz),d=Math.sqrt(dx*dx+dy*dy+dz*dz);
 if(d<best){best=d;index=i-1;}
}}
{ const i:i32=7;if(i<=i32(f(Field.count))&&Read.field(i,Field.alive)!=0&&!(f(Field.bonded)>0&&(f(Field.argymaq)>0||Read.field(i,Field.argymaq)==0))){
 const dx=Read.field(i,Field.x)-f(Field.px),dy=Read.field(i,Field.y)-f(Field.py),dz=Read.field(i,Field.z)-f(Field.pz),d=Math.sqrt(dx*dx+dy*dy+dz*dz);
 if(d<best){best=d;index=i-1;}
}}
{ const i:i32=8;if(i<=i32(f(Field.count))&&Read.field(i,Field.alive)!=0&&!(f(Field.bonded)>0&&(f(Field.argymaq)>0||Read.field(i,Field.argymaq)==0))){
 const dx=Read.field(i,Field.x)-f(Field.px),dy=Read.field(i,Field.y)-f(Field.py),dz=Read.field(i,Field.z)-f(Field.pz),d=Math.sqrt(dx*dx+dy*dy+dz*dz);
 if(d<best){best=d;index=i-1;}
}}

    put(Channel.index,index);put(Channel.distance,best);put(Channel.active,best<=Params.range?1:0);
  } else if(signal==Signal.approach){
    const dt=f(Field.dt),distance=f(Field.distance),beaten=f(Field.beaten)>0,mounted=f(Field.mounted)>0,speed=mounted?Math.max(f(Field.speed),6):f(Field.speed);
    const look=f(Field.dot)>Params.lookDot?f(Field.lookT)+dt:Math.max(0,f(Field.lookT)-dt*2);
    const offering=f(Field.offer)>0&&!mounted&&distance<Params.offerRange&&f(Field.alert)<Params.offerAlert;
    let trust:f64=-1,alert:f64=Params.alertCalm;
    if(f(Field.crouched)>0&&speed<=Params.slowSpeed&&distance<25)trust=Params.trustSlow;
    if(offering)trust=Math.max(trust,0)+Params.trustOffer;
    if(trust>0&&f(Field.downwind)>.82&&f(Field.strength)>.05)trust*=Params.trustWind;
    if(f(Field.crouched)==0&&!beaten&&distance<30){alert=Params.alertWalk;trust=Math.min(trust,0);}
    if(speed>Params.fastSpeed||look>Params.lookTime){trust=Params.trustRun;alert=Params.alertRun;}
    if(beaten){trust=Math.max(trust,0);alert=Params.alertBeaten;}
    const nextTrust=Math.max(0,Math.min(100,f(Field.trust)+trust*dt)),nextAlert=Math.max(0,Math.min(100,f(Field.alert)+alert*dt));
    put(Channel.lookT,look);put(Channel.trust,trust*dt);put(Channel.alert,nextAlert);
    put(Channel.lead,nextAlert>=100&&nextTrust>=20&&f(Field.flee)==0&&!beaten?1:0);
    put(Channel.radius,!mounted&&(beaten||(nextTrust>=100&&distance<Params.mountRange))?Params.mountReach:0);
    put(Channel.ear,Params.earHeight*f(Field.scale));
    put(Channel.offer,distance<Params.offerRange&&nextAlert<Params.offerAlert?1:0);
  } else if(signal==Signal.event){
    const dx=f(Field.x)-f(Field.cx),dz=f(Field.z)-f(Field.cz),px=f(Field.px)-f(Field.cx),pz=f(Field.pz)-f(Field.cz);
    const shot=f(Field.shot)>0,near=dx*dx+dz*dz<Params.range*Params.range;
    put(Channel.trust,near&&(shot||px*px+pz*pz<3600)?(shot?Params.trustShot:Params.trustWolves):0);
    put(Channel.alert,near&&shot?100:f(Field.alert));
  } else if(signal==Signal.finish){
    put(Channel.damage,f(Field.won)>0?0:Params.throwDamage);put(Channel.trust,f(Field.won)>0?0:Params.trustThrown);
  } else if(signal==Signal.eligible){
    put(Channel.accept,f(Field.bonded)==0||(f(Field.horseArgymaq)>0&&f(Field.argymaq)==0)?1:0);
  }
}
