import { Signal, Field, Channel, Read, Do } from './generated/nalatiTitanFire';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
// Event projections; retained state belongs to the native binding at <= 10 Hz.
export function onSignal(signal:i32,value:f64,source:i32):void {
if(signal==Signal.ignite){put(Channel.burn,f(Field.burn)*(.8+Read.random()*.4));} else if(signal==Signal.fire){
    const burn=f(Field.burn)-f(Field.dt);let mask:i32=0;
    if(burn>0&&f(Field.spread)>0){
      for(let i:i32=1;i<=i32(f(Field.count));i++){
        if(Read.field(i,Field.mode)!=0)continue;
        const dx=Read.field(i,Field.x),dz=Read.field(i,Field.z),along=(dx*f(Field.wx)+dz*f(Field.wz))/Math.sqrt(dx*dx+dz*dz);
        if(Read.random()<(along>.5?.16:along>-.2?.035:.004))mask|=1<<(i-1);
      }
    }
    put(Channel.burn,burn);put(Channel.mask,mask);
  } else if(signal==Signal.fireContact){
 const cd=f(Field.cd)-f(Field.dt),hurt=f(Field.hit)>0&&cd<=0;
 put(Channel.cd,hurt?.5:cd);put(Channel.hurt,hurt?f(Field.amount)*.5:0);put(Channel.speed,f(Field.open)>0?-10*f(Field.dt):0);
}

}
