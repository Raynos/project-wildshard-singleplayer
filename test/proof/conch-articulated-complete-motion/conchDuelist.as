import { Actor, Move, Strike, Field, State, Do, Read } from './generated/driftwoodConchDuelistDecision';
@inline function stage(value:i32):void { State.stage=value;State.clock=0;Do.field(Actor.enemy,Field.stage,value);Do.field(Actor.enemy,Field.clock,0); }
@inline function guard(value:f64):void { Do.field(Actor.enemy,Field.guard,value); }
export function onStart():void { State.cancelled=false;guard(0);stage(0); }
export function onTick(dt:f64):void {
  if(State.cancelled||!Read.alive(Actor.enemy))return;
  if(Read.stunned(Actor.enemy)) {Do.stop(Actor.enemy);guard(0);if(State.stage!=4)stage(2);return;}
  State.clock=Math.min(60,State.clock+dt);Do.field(Actor.enemy,Field.clock,State.clock);
  // A real sword hit stuns after damage.dealt; preserve the parry response until that stun ends.
  if(State.stage==4) {
    const target=Read.nearestPlayer(Actor.enemy);
    if(target==0) {stage(2);return;}
    stage(3);Do.strike(Actor.enemy,Strike.counter,target);return;
  }
  if(State.stage==1&&State.clock>=.6)guard(0);
  if(State.stage==2) { if(State.clock>=1.5)stage(0);return; }
  if(State.stage!=0)return;
  const target=Read.nearestPlayer(Actor.enemy);if(target==0)return;
  if(Read.distance(Actor.enemy,target)<=2.3) {Do.stop(Actor.enemy);stage(1);guard(1);Do.strike(Actor.enemy,Strike.thrust,target);}
  else Do.move(Actor.enemy,Move.stalk,target);
}
export function onHit(source:i32,amount:f64,hpShare:f64):void {
  if(State.cancelled||!Read.alive(Actor.enemy))return;
  if(State.stage==1&&State.clock<.6) {
    guard(0);Do.stop(Actor.enemy);stage(4);
  }
}
export function onStrikeDone(strike:i32,hit:bool):void {if(!State.cancelled&&((State.stage==1&&strike==Strike.thrust)||(State.stage==3&&strike==Strike.counter))){guard(0);stage(2);}}
export function onStop():void {State.cancelled=true;guard(0);Do.stop(Actor.enemy);}
export function onDeath(killer:i32):void {onStop();stage(5);}
