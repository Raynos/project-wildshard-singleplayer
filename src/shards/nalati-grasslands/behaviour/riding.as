import { Signal, Field, Channel, Params, Read, Do } from './generated/nalatiRiding';
@inline function f(id:i32):f64{return Read.field(0,id);}
export function onSignal(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.panic){
    const dx=f(Field.x)-f(Field.px),dz=f(Field.z)-f(Field.pz),d=Math.sqrt(dx*dx+dz*dz);
    Do.channel(Channel.duration,f(Field.bite)>0?Params.bitePanic:f(Field.practice)>0||d>=Params.boltRange?0:d<Params.boltNear?Params.boltLong:Params.boltShort);
  } else if(signal==Signal.name){
    const dx=f(Field.x)-f(Field.cx),dz=f(Field.z)-f(Field.cz),px=f(Field.x)-f(Field.px),pz=f(Field.z)-f(Field.pz);
    Do.channel(Channel.distance,f(Field.alive)>0&&dx*dx+dz*dz<=Params.railRange*Params.railRange?px*px+pz*pz:1e12);
    Do.channel(Channel.x,f(Field.x)+Math.sin(f(Field.yaw))*Params.nameHead*f(Field.scale));
    Do.channel(Channel.z,f(Field.z)+Math.cos(f(Field.yaw))*Params.nameHead*f(Field.scale));
    Do.channel(Channel.radius,Params.nameReach);
  } else if(signal==Signal.dismount){
    const side=f(Field.thrown)>0?Params.sideThrown:Params.sideDismount;
    Do.channel(Channel.x,f(Field.x)+Math.cos(f(Field.yaw))*side);Do.channel(Channel.z,f(Field.z)-Math.sin(f(Field.yaw))*side);
    Do.channel(Channel.altX,f(Field.x)-Math.cos(f(Field.yaw))*side);Do.channel(Channel.altZ,f(Field.z)+Math.sin(f(Field.yaw))*side);
  } else if(signal==Signal.mount){
    Do.channel(Channel.accept,f(Field.mounted)==0&&f(Field.present)>0&&f(Field.alive)>0&&f(Field.driven)==0&&(f(Field.available)>0||(f(Field.breaking)>0&&f(Field.stallion)>0))?1:0);
  } else if(signal==Signal.walk){
    const active=f(Field.version)>0&&f(Field.board)==0&&f(Field.swim)==0;
    const crouch=active&&f(Field.crouched)>0;
    Do.channel(Channel.crouched,crouch?1:0);Do.channel(Channel.sprinting,active&&f(Field.depth)<.6&&!crouch&&f(Field.sprint)>0&&f(Field.forward)>0?1:0);
    Do.channel(Channel.wade,f(Field.board)==0&&f(Field.swim)==0&&f(Field.grounded)>0?Math.min(1,f(Field.depth)/1.1):0);
  }
}
