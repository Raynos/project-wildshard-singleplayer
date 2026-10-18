import { Actor, Move, Strike, Field, State, Do, Read } from './generated/driftwoodColossusDecision';
@inline function phase(): i32 { const hp = Read.hpShare(Actor.self); return hp < .25 ? 3 : hp < .55 ? 2 : 1; }
@inline function pose(step: i32): void {
  State.step = step; State.elapsed = 0;
  Do.field(Actor.self, Field.pose, step); Do.field(Actor.self, Field.clock, 0); Do.field(Actor.self, Field.exposed, 0);
}
@inline function rest(seconds: f64): void { Do.stop(Actor.self); pose(0); State.cooldown = seconds; }
@inline function attack(step: i32, strike: i32, target: i32): void { Do.stop(Actor.self); pose(step); Do.strike(Actor.self, strike, target); }
@inline function sweep(target: i32): void { attack(State.side == 0 ? 1 : 2, State.side == 0 ? Strike.left : Strike.right, target); State.side = 1 - State.side; }
export function onStart(): void { rest(1); }
export function onTick(dt: f64): void {
  if (!Read.alive(Actor.self)) { Do.stop(Actor.self); return; }
  State.elapsed = Math.min(600, State.elapsed + dt); State.cooldown = Math.max(0, State.cooldown - dt);
  Do.field(Actor.self, Field.clock, State.elapsed); Do.field(Actor.self, Field.phase, phase());
  if (Read.stunned(Actor.self)) { State.sequence = 0; rest(1.1); return; }
  const target = Read.nearestPlayer(Actor.self);
  if (target == 0) { rest(1); return; }
  if (State.step != 0) {
    // Only a completed overhead impact opens the cage; no instant hidden counter or summoned adds.
    Do.field(Actor.self, Field.exposed, State.step == 3 && Read.strikeState(Actor.self) == 3 ? 1 : 0);
    if (State.elapsed > .3 && Read.strikeState(Actor.self) == 0) { State.sequence = 0; rest(1.1); }
    return;
  }
  Do.move(Actor.self, Move.face, target);
  if (State.cooldown > 0 || Read.distance(Actor.self, target) > 7) return;
  if (State.sequence == 3) { State.sequence = 0; attack(3, Strike.slam, target); }
  else { State.sequence = 1; sweep(target); }
}
export function onStrikeDone(strike: i32, hit: bool): void {
  if (!Read.alive(Actor.self)) { Do.stop(Actor.self); return; }
  if (Read.stunned(Actor.self)) { State.sequence = 0; rest(1.1); return; }
  const target = Read.nearestPlayer(Actor.self);
  if (target == 0) { State.sequence = 0; rest(1); return; }
  if (strike == Strike.left || strike == Strike.right) {
    if (phase() >= 2 && State.sequence == 1) { State.sequence = 2; sweep(target); return; }
    if (phase() == 3) { State.sequence = 0; attack(3, Strike.slam, target); return; }
    State.sequence = 3; rest(.75); return;
  }
  State.sequence = 0; rest(1.1);
}
export function onHit(by: i32, damage: f64, hp: f64): void { if (hp <= 0) onDeath(by); }
export function onDeath(killer: i32): void { Do.stop(Actor.self); pose(6); State.sequence = 0; Do.field(Actor.self, Field.awake, 0); }
export function onStop(): void { Do.stop(Actor.self); State.sequence = 0; Do.field(Actor.self, Field.exposed, 0); }
