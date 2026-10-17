// BossBrain retains the actual attempt, arena, death flag and reward. No replacement body or clock.
import { Actor, Move, Strike, Field, State, Do, Read } from './generated/driftwoodCaptainDecision';
@inline function get(field:i32):f64 { return Read.field(Actor.captain,field); }
@inline function set(field:i32,v:f64):void { Do.field(Actor.captain,field,v); }
@inline function state(v:i32):void { set(Field.st,v); }
// Event commands are buffered; durable pending resets survive a same-step tick.
@inline function cooldown(v:f64):void { State.resetCd=v;set(Field.cd,v); }
@inline function resetSub():void { State.resetSubt=true;set(Field.subt,0); }
@inline function phase():i32 { const hp=Read.hpShare(Actor.captain); return hp>.66?1:hp>.33?2:3; }
@inline function stalk():void {
  const target=Read.nearestPlayer(Actor.captain); if(target==0)return;
  const p=phase(); Do.move(Actor.captain,p==1?Move.stalk:p==2?Move.stalkFast:Move.stalkRage,target);
}
@inline export function onStart():void {
  if(get(Field.init)==0) { set(Field.init,1);state(0);cooldown(1);set(Field.poolX,Read.x(Actor.captain));set(Field.poolZ,Read.z(Actor.captain)); }
  // An old save resumes its admitted actor-memory state; initialization never erases it.
  if(get(Field.st)==0||get(Field.st)==1) { state(1); Do.move(Actor.captain,Move.rise); }
  else if(get(Field.st)==2)stalk();
  else if(get(Field.st)==3)finishStrike();
  else if(get(Field.st)==4)Do.move(Actor.captain,Move.sink);
}
@inline export function onTick(dt:f64):void {
  const st=i32(get(Field.st)),p=phase(),target=Read.nearestPlayer(Actor.captain);
  set(Field.phase,p);const cd=Math.max(0,(State.resetCd>=0?State.resetCd:get(Field.cd))-dt);State.resetCd=-1;set(Field.cd,cd);
  const sub=(State.resetSubt?0:get(Field.subt))+dt;State.resetSubt=false;set(Field.subt,sub);
  if(target==0)return;
  if(st==2) {
    if(p>1&&sub>(p==2?7:5)&&cd<=0) {state(4);Do.move(Actor.captain,Move.sink);return;}
    const px=Read.x(target),pz=Read.z(target),hx=get(Field.poolX),hz=get(Field.poolZ);
    if(Math.sqrt((px-hx)*(px-hx)+(pz-hz)*(pz-hz))>=get(Field.arena)) {Do.move(Actor.captain,p==1?Move.home:p==2?Move.homeFast:Move.homeRage);return;}
    if(Read.distance(Actor.captain,target)<2.3&&cd<=0) {
      state(3);Do.stop(Actor.captain);Do.strike(Actor.captain,p==1?Strike.swing:p==2?Strike.fast:Strike.rage,target);return;
    }
    if(cd<=0)stalk();
  } else if(st==5&&sub>1.1) {state(1);Do.move(Actor.captain,Move.relocate,target);}
}
@inline function finishStrike():void {
  if(phase()==3&&get(Field.combo)==0) {
    const target=Read.nearestPlayer(Actor.captain);if(target!=0){set(Field.combo,1);Do.strike(Actor.captain,Strike.second,target);return;}
  }
  set(Field.combo,0);cooldown(phase()==1?1.4:phase()==2?1.2:.8);state(2);stalk();
}
@inline export function onStrikeDone(strike:i32,hit:bool):void {if(i32(get(Field.st))==3)finishStrike();}
@inline export function onMoveDone(move:i32,ok:bool):void {
  if(move==Move.rise&&get(Field.st)==1) {state(2);resetSub();cooldown(.6);stalk();}
  else if(move==Move.sink&&get(Field.st)==4) {
    const target=Read.nearestPlayer(Actor.captain);if(target==0)return;
    const angle=Read.random()*Math.PI*2,r=1.2+Read.random(),hx=get(Field.poolX),hz=get(Field.poolZ);
    let x=Read.x(target)+Math.cos(angle)*r,z=Read.z(target)+Math.sin(angle)*r;
    const dx=x-hx,dz=z-hz,d=Math.sqrt(dx*dx+dz*dz),limit=get(Field.arena)-2;
    if(d>limit){x=hx+dx/d*limit;z=hz+dz/d*limit;}
    set(Field.burstX,x);set(Field.burstZ,z);resetSub();state(5);
  } else if(move==Move.relocate&&get(Field.st)==1) {
    const target=Read.nearestPlayer(Actor.captain);if(target!=0)Do.strike(Actor.captain,Strike.burst,target);
    Do.move(Actor.captain,Move.rise);
  }
}
@inline export function onStop():void {Do.stop(Actor.captain);}
@inline export function onDeath(killer:i32):void {Do.stop(Actor.captain);}
