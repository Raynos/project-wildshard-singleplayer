// The durable step is phase*10+mode: perch, takeoff, orbit, stalk, strike, dead.
// BossBrain owns encounter thresholds, retries and rewards.
import { Actor, Move, Strike, Timer, State, Params, Do, Read, Event } from './generated/farRocDecision';
function orbit(phase:i32):void {
  State.step=phase*10+2;
  Do.move(Actor.roc,phase==0?Move.orbitHigh:phase==1?Move.orbitWall:Move.orbitLow);
}
function stalk(phase:i32):void {
  const target=Read.nearestPlayer(Actor.roc);
  if(target==0) { orbit(phase); Do.timer(Timer.beat,Params.rest); return; }
  State.step=phase*10+3;
  Do.move(Actor.roc,phase==0?Move.stalkHigh:phase==1?Move.stalkWall:Move.stalkLow,target);
}
export function onStart():void {
  if(State.step!=0) return;
  const target=Read.nearestPlayer(Actor.roc); if(target==0) return;
  State.step=1; Do.move(Actor.roc,Move.takeoff,target);
}
export function onStop():void {
  Do.stop(Actor.roc); Do.timer(Timer.beat,0); State.step=0; Do.move(Actor.roc,Move.perch);
}
export function onThreshold(index:i32):void {
  const step=State.step, phase=step/10, mode=step%10;
  if(i32(Event.subject)!=Actor.roc || mode==0 || mode==5 || index<=phase || index>2) return;
  if(mode==2) orbit(index); else if(mode==3) stalk(index); else State.step=index*10+mode;
}
export function onMoveDone(move:i32,ok:bool):void {
  const step=State.step, phase=step/10, mode=step%10;
  if(i32(Event.subject)!=Actor.roc || mode==0 || mode==5) return;
  if(move==Move.takeoff && mode==1) { orbit(phase); Do.timer(Timer.beat,Params.firstRest); return; }
  const expected=phase==0?Move.stalkHigh:phase==1?Move.stalkWall:Move.stalkLow;
  if(mode!=3 || move!=expected) return;
  if(!ok) { orbit(phase); Do.timer(Timer.beat,Params.rest); return; }
  const target=Read.nearestPlayer(Actor.roc); if(target==0) { orbit(phase); Do.timer(Timer.beat,Params.rest); return; }
  State.step=phase*10+4; Do.strike(Actor.roc,phase==0?Strike.stoop:phase==1?Strike.galeWall:Strike.sweep,target);
  if(phase==0) Do.timer(Timer.beat,Params.stoopWindup);
}
export function onStrikeDone(strike:i32,hit:bool):void {
  const step=State.step, phase=step/10;
  if(i32(Event.subject)!=Actor.roc || step%10!=4) return;
  orbit(phase); Do.timer(Timer.beat,phase==2?Params.lowRest:Params.rest);
}
export function onTimer(timer:i32):void {
  if(timer!=Timer.beat) return;
  const step=State.step, phase=step/10, mode=step%10;
  if(mode==2) stalk(phase);
  else if(mode==4 && phase==0) {
    const target=Read.nearestPlayer(Actor.roc); if(target!=0) Do.move(Actor.roc,Move.dive,target);
  }
}
export function onDeath(killer:i32):void {
  const step=State.step;
  if(i32(Event.subject)!=Actor.roc || step%10==5) return;
  Do.stop(Actor.roc); Do.timer(Timer.beat,0); State.step=step/10*10+5;
}
