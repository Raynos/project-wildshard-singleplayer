import { Actor, Move, Strike, Field, State, Do, Read } from './generated/driftwoodSplinterMantisDecision';
@inline function stage(value:i32):void {State.stage=value;State.clock=0;Do.field(Actor.enemy,Field.stage,value);Do.field(Actor.enemy,Field.clock,0);}
export function onStart():void {State.cancelled=false;stage(0);Do.field(Actor.enemy,Field.beat,0);}
function tactics(dt:f64):void {
  if(State.cancelled||!Read.alive(Actor.enemy))return;
  if(Read.stunned(Actor.enemy)) {Do.stop(Actor.enemy);Do.field(Actor.enemy,Field.beat,0);stage(2);return;}
  State.clock=Math.min(60,State.clock+dt);Do.field(Actor.enemy,Field.clock,State.clock);
  if(State.stage==2) {if(State.clock>=1.7)stage(0);return;}
  if(State.stage!=0)return;
  const target=Read.nearestPlayer(Actor.enemy);if(target==0)return;
  if(Read.distance(Actor.enemy,target)<=3.4) {Do.stop(Actor.enemy);stage(1);Do.field(Actor.enemy,Field.beat,1);Do.strike(Actor.enemy,Strike.first,target);}
  else Do.move(Actor.enemy,Move.stalk,target);
}
export function onStrikeDone(strike:i32,hit:bool):void {
  if(State.cancelled||!Read.alive(Actor.enemy))return;
  if(State.stage==1&&strike==Strike.first) {
    const target=Read.nearestPlayer(Actor.enemy);
    if(target!=0) {stage(3);Do.field(Actor.enemy,Field.beat,2);Do.strike(Actor.enemy,Strike.second,target);return;}
  }
  if(State.stage==1||State.stage==3) {stage(2);Do.field(Actor.enemy,Field.beat,0);}
}
export function onHit(source:i32,amount:f64,hpShare:f64):void {
}
export function onStop():void {State.cancelled=true;Do.field(Actor.enemy,Field.beat,0);Do.stop(Actor.enemy);}
export function onDeath(killer:i32):void {onStop();stage(5);}

// Presentation-only observations of the existing authoritative StrikeRunner phase.
// These fields never choose a target, move, strike, damage, cancel or alter timing.
export function onTick(dt:f64):void {
  if(!State.cancelled&&Read.alive(Actor.enemy)) {
    const phase=Read.strikeState(Actor.enemy);
    State.poseClock=phase==State.posePhase?Math.min(60,State.poseClock+dt):0;
    State.posePhase=phase;
    Do.field(Actor.enemy,Field.posePhase,phase);Do.field(Actor.enemy,Field.poseClock,State.poseClock);
  }
  tactics(dt);
}
