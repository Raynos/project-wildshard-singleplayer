import { Actor, Move, Strike, Field, State, Do, Read } from './generated/driftwoodBellbackDecision';
@inline function pose(step: i32): void {
  State.step = step; State.elapsed = 0; State.poise = 0;
  Do.field(Actor.self, Field.pose, step); Do.field(Actor.self, Field.clock, 0);
}
@inline function rest(seconds: f64): void { Do.stop(Actor.self); pose(0); State.cooldown = seconds; }
@inline function attack(step: i32, strike: i32, target: i32): void {
  Do.stop(Actor.self); pose(step); Do.strike(Actor.self, strike, target);
}
export function onStart(): void { rest(.8); }
export function onTick(dt: f64): void {
  if (!Read.alive(Actor.self)) { Do.stop(Actor.self); return; }
  State.elapsed = Math.min(600, State.elapsed + dt);
  State.cooldown = Math.max(0, State.cooldown - dt);
  Do.field(Actor.self, Field.clock, State.elapsed);
  if (Read.stunned(Actor.self)) { Do.stop(Actor.self); pose(4); State.sequence = 0; return; }
  const target = Read.nearestPlayer(Actor.self);
  if (target == 0) { rest(.8); return; }
  if (State.step == 4) { if (State.elapsed >= 1.1) rest(.6); return; }
  if (State.step != 0) {
    // A cancelled/refused strike must not enqueue an echo or leave a stuck attack pose.
    if (State.elapsed > .25 && Read.strikeState(Actor.self) == 0) rest(1);
    return;
  }
  if (State.cooldown > 0) return;
  if (Read.distance(Actor.self, target) > 2.3) { Do.move(Actor.self, Move.approach, target); return; }
  if (State.sequence == 1 && Read.distance(Actor.self, target) < 1.8) {
    State.sequence = 0; attack(3, Strike.stomp, target);
  } else { State.sequence = 1; attack(1, Strike.pulse, target); }
}
export function onStrikeDone(strike: i32, hit: bool): void {
  if (!Read.alive(Actor.self)) { Do.stop(Actor.self); return; }
  if (Read.stunned(Actor.self)) { Do.stop(Actor.self); pose(4); State.sequence = 0; return; }
  if (State.step == 1 && strike == Strike.pulse) {
    const target = Read.nearestPlayer(Actor.self);
    if (target != 0) { attack(2, Strike.echo, target); return; }
  }
  if (State.step != 4) rest(1.3);
}
export function onHit(by: i32, damage: f64, hp: f64): void {
  if (hp <= 0) { onDeath(by); return; }
  if ((State.step == 1 || State.step == 2) && Read.strikeState(Actor.self) == 1) {
    State.poise += damage;
    // A heavy hit or several light hits break the bell's poise during its visible tell.
    if (State.poise >= 18) { Do.stop(Actor.self); pose(4); State.sequence = 0; }
  }
}
export function onDeath(killer: i32): void { Do.stop(Actor.self); pose(6); Do.field(Actor.self, Field.awake, 0); }
export function onStop(): void { Do.stop(Actor.self); State.sequence = 0; }
