import { Signal, Field, Channel, Read, Do } from './generated/nalatiEliteGroup';
@inline function f(id:i32):f64{return Read.field(0,id);}
@inline function put(id:i32,value:f64):void{Do.channel(id,value);}
/** The original due-only group law and retained capture, with no new clock. */
export function onSignal(signal:i32,value:f64,source:i32):void{
  assert(signal==Signal.argymaqFrame);
  const dt=f(Field.dt),state=f(Field.state);
  let lane=f(Field.laneT),run=f(Field.runT),capture=0.0,signature=0.0,lead=0.0;
  let fromX=f(Field.fromX),fromY=f(Field.fromY),fromZ=f(Field.fromZ),toX=f(Field.toX),toY=f(Field.toY),toZ=f(Field.toZ);
  if(state!=f(Field.previousState)){
    if(state==1){lane=1.2;capture=1;signature=1;fromX=f(Field.x);fromY=f(Field.y);fromZ=f(Field.z);toX=f(Field.px);toY=f(Field.py);toZ=f(Field.pz);}
    if(state==2)lane=Math.max(lane,1.4);
  }
  if(lane>0)lane-=dt;
  if(f(Field.phase2)!=0&&f(Field.engaged)!=0&&state!=3){run-=dt;if(run<=0){run=8;lead=1;}}
  put(Channel.laneT,lane);put(Channel.runT,run);put(Channel.previousState,state);
  put(Channel.fromX,fromX);put(Channel.fromY,fromY);put(Channel.fromZ,fromZ);put(Channel.toX,toX);put(Channel.toY,toY);put(Channel.toZ,toZ);
  put(Channel.capture,capture);put(Channel.signature,signature);put(Channel.lead,lead);
  put(Channel.adopt,f(Field.bonded)!=0&&f(Field.same)==0?1:0);
  put(Channel.fraction,Math.max(0,(f(Field.health)-.25)/.75));put(Channel.broken,state==f(Field.brokenState)?1:0);
}
