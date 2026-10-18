import { Actor, Move, Strike, Field, State, Do, Read } from './generated/driftwoodBrinePufferDecision';
@inline function stage(value:i32):void { State.stage=value; State.clock=0; Do.field(Actor.enemy,Field.stage,value);Do.field(Actor.enemy,Field.clock,0); }
export function onStart():void { State.cancelled=false;stage(0); }
export function onTick(dt:f64):void {
  if(State.cancelled||!Read.alive(Actor.enemy))return;
  if(Read.stunned(Actor.enemy)) {Do.stop(Actor.enemy);stage(2);return;}
  State.clock=Math.min(60,State.clock+dt);Do.field(Actor.enemy,Field.clock,State.clock);
  const target=Read.nearestPlayer(Actor.enemy);if(target==0)return;
  if(State.stage==2) { if(State.clock>=2.4)stage(0);return; }
  if(State.stage!=0)return;
  if(Read.distance(Actor.enemy,target)<=2.1) { Do.stop(Actor.enemy);stage(1);Do.strike(Actor.enemy,Strike.burst,target); }
  else Do.move(Actor.enemy,Move.stalk,target);
}
export function onStrikeDone(strike:i32,hit:bool):void { if(!State.cancelled&&State.stage==1)stage(2); }
export function onHit(source:i32,amount:f64,hpShare:f64):void {  }
export function onStop():void { State.cancelled=true;Do.stop(Actor.enemy); }
export function onDeath(killer:i32):void { onStop();stage(5); }
