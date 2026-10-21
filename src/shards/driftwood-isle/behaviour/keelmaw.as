import { Actor, Strike, Field, State, Do, Read } from './generated/driftwoodKeelmawDecision';
@inline function pose(step: i32): void {
  State.step = step; State.elapsed = 0; State.poise = 0;
  Do.field(Actor.self, Field.step, step); Do.field(Actor.self, Field.clock, 0);
}
@inline function rest(): void { Do.stop(Actor.self); pose(0); State.cooldown = 1.8; }
export function onStart(): void { rest(); }
export function onTick(dt: f64): void {
  if (!Read.alive(Actor.self)) { Do.stop(Actor.self); return; }
  State.elapsed = Math.min(600, State.elapsed + dt);
  State.cooldown = Math.max(0, State.cooldown - dt);
  Do.field(Actor.self, Field.clock, State.elapsed);
  if (Read.stunned(Actor.self)) { if (State.step != 2) { Do.stop(Actor.self); pose(2); } return; }
  if (State.step == 2) { if (State.elapsed >= .9) rest(); return; }
  if (State.step != 0) {
    if (State.elapsed > .25 && Read.strikeState(Actor.self) == 0) rest();
    return;
  }
  if (State.cooldown > 0) return;
  const target = Read.nearestPlayer(Actor.self);
  if (target == 0 || Read.distance(Actor.self, target) > 2.8) return;
  Do.stop(Actor.self); pose(1); Do.strike(Actor.self, Strike.bite, target);
}
export function onStrikeDone(strike: i32, hit: bool): void {
  if (Read.alive(Actor.self) && State.step != 2) rest();
}
export function onHit(by: i32, damage: f64, hp: f64): void {
  if (hp <= 0) { onDeath(by); return; }
  if (State.step == 1 && Read.strikeState(Actor.self) == 1) {
    State.poise += damage;
    if (State.poise >= 18) { Do.stop(Actor.self); pose(2); }
  }
}
export function onDeath(killer: i32): void { Do.stop(Actor.self); pose(3); }
export function onStop(): void { Do.stop(Actor.self); }
