import { Signal, Field, Channel, Params, Read, Do } from './generated/nalatiMounts';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,n:f64):void{Do.channel(id,n);}
// One bounded integration and one public telegraph per fixed step; native code owns the horse.
@inline export function breakingEntry(signal:i32,value:f64,source:i32):void {
  if(signal==Signal.start){put(Channel.kind,f(Field.r0)<.5?0:f(Field.r0)<.78?1:2);put(Channel.dir,f(Field.r1)<.5?-1:1);return;}
  const dt=f(Field.dt),t=f(Field.roundT)+dt,round=f(Field.round),lead=f(Field.next)-t,kind=f(Field.kind),dir=f(Field.dir),power=f(Field.power);
  let next=f(Field.next),bv=f(Field.bv),spinT=f(Field.spinT),spinF=f(Field.spinF),rearAt=f(Field.rearAt),rearDir=f(Field.rearDir),shake=Math.max(0,f(Field.shake)-dt*2.5),buck:f64=0,rear:f64=-1,kick:f64=0,toss:f64=0;
  if(lead>0&&lead<Params.telegraph){buck=kind==0?1:0;rear=kind==2?.6:-1;toss=kind==1?1:0;shake=Math.max(shake,.35);}
  if(lead<=0){
    if(kind==0){bv+=dir*2.1*power;shake=1;kick=1;}
    if(kind==2){bv+=dir*1.9*power;rear=1;rearAt=t+.35;rearDir=dir;}
    if(kind==1){spinF=dir*1.25*power;spinT=1;}
    const nextKind=f(Field.r0)<.5?0:f(Field.r0)<.78?1:2;
    next=t+(nextKind==1?1.25:.95)*(1.08-.07*round)+f(Field.r2)*.3;
    put(Channel.kind,nextKind);put(Channel.dir,f(Field.r1)<.5?-1:1);
  }
  if(rearAt>0&&t>=rearAt){bv-=rearDir*3.2*power;rear=0;rearAt=-10;shake=.8;}
  const spinning=spinT>0;
  if(spinning)spinT=Math.max(0,spinT-dt);
  bv+=( (spinning?spinF:0)-Math.max(-1,Math.min(1,f(Field.lean)))*Params.leanAcc)*dt;
  bv*=Math.exp(-Params.damp*dt);
  const b=Math.max(-Params.clampBalance,Math.min(Params.clampBalance,f(Field.b)+bv*dt)),red=Math.abs(b)>Params.red,redT=red?f(Field.redT)+dt:Math.max(0,f(Field.redT)-dt*2);
  let outcome:f64=redT>Params.throwTime||Math.abs(b)>=Params.throwBalance?-1:0,nextRound=round,nextT=t;
  if(outcome==0&&t>=Params.roundTime){nextRound++;nextT=0;rearAt=-10;next=.55;put(Channel.power,Math.pow(1.2,nextRound-1));if(nextRound>Params.rounds)outcome=1;}
  put(Channel.next,next);put(Channel.round,nextRound);put(Channel.roundT,nextT);put(Channel.b,b);put(Channel.bv,bv);put(Channel.redT,redT);put(Channel.spinF,spinF);put(Channel.spinT,spinT);put(Channel.rearAt,rearAt);put(Channel.rearDir,rearDir);put(Channel.shake,shake);
  put(Channel.buck,buck);put(Channel.rear,rear);put(Channel.kick,kick);put(Channel.toss,toss);put(Channel.danger,red?1:0);put(Channel.roll,-b*25*Math.PI/180);put(Channel.yaw,spinning?Math.sign(spinF)*dt*2.6:0);put(Channel.outcome,outcome);
}
