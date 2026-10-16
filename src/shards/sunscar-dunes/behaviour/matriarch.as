// Durable step = phase*10 + mode (orbit, dive, climb, stalk/strike, dead).
// The existing encounter owns spawning, rise, phases, retry, weather and rewards.
import { Actor, Move, Strike, Timer, State, Params, Do, Read, Event } from './generated/sunscarMatriarchDecision';
@inline function orbit(phase:i32):void {
  State.step=phase*10+1; Do.move(Actor.matriarch,phase==0?Move.orbit:Move.stormOrbit);
}
@inline function ground():void {
  State.step=23; const target=Read.nearestPlayer(Actor.matriarch);
  if(target!=0) Do.move(Actor.matriarch,Move.stalk,target); else Do.timer(Timer.beat,0.2);
}
@inline function climb(phase:i32):void {
  State.step=phase*10+3; Do.move(Actor.matriarch,phase==0?Move.climb:Move.stormClimb);
}
export function onStart():void {
  if(State.step!=0) return;
  orbit(0); Do.timer(Timer.beat,Params.firstRest);
}
export function onStop():void { Do.stop(Actor.matriarch); Do.timer(Timer.beat,0); State.step=0; }
export function onThreshold(index:i32):void {
  const step=State.step, phase=step/10, mode=step%10;
  if(i32(Event.subject)!=Actor.matriarch || mode==5 || index<=phase || index>2) return;
  if(index==2) { Do.stop(Actor.matriarch); Do.timer(Timer.beat,0); State.step=21; Do.move(Actor.matriarch,Move.lie); }
  else if(mode==1) orbit(index); else State.step=index*10+mode;
}
export function onTimer(timer:i32):void {
  if(timer!=Timer.beat) return;
  const phase=State.step/10, mode=State.step%10;
  if(phase==2) { ground(); return; }
  if(mode==1) {
    const target=Read.nearestPlayer(Actor.matriarch); if(target==0) { Do.timer(Timer.beat,0.2); return; }
    State.step=phase*10+2; Do.move(Actor.matriarch,phase==0?Move.dive:Move.stormDive,target); Do.timer(Timer.beat,Params.diveMax);
  } else if(mode==2) climb(phase);
}
export function onMoveDone(move:i32,ok:bool):void {
  const step=State.step, phase=step/10, mode=step%10;
  if(i32(Event.subject)!=Actor.matriarch || mode==0 || mode==5) return;
  if(phase==2 && move==Move.lie) ground();
  else if(phase==2 && move==Move.stalk) {
    const target=Read.nearestPlayer(Actor.matriarch); if(target==0) { Do.timer(Timer.beat,0.2); return; }
    State.step=24; Do.strike(Actor.matriarch,Strike.tail,target);
  } else if(phase<2 && (move==Move.climb || move==Move.stormClimb) && mode==3) {
    orbit(phase); Do.timer(Timer.beat,phase==0?Params.rest:Params.stormRest);
  } else if(phase<2 && mode==2 && (move==Move.dive || move==Move.stormDive)) climb(phase);
}
export function onStrikeDone(strike:i32,hit:bool):void {
  const step=State.step; if(i32(Event.subject)!=Actor.matriarch) return;
  if(step==24) ground();
  else if(step%10==2) { Do.timer(Timer.beat,0); climb(step/10); }
}
export function onDeath(killer:i32):void {
  const step=State.step; if(i32(Event.subject)!=Actor.matriarch || step%10==5) return;
  Do.stop(Actor.matriarch); Do.timer(Timer.beat,0); State.step=step/10*10+5;
}
