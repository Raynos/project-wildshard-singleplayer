import { Actor, Strike, Field, State, Do, Read } from './generated/driftwoodBrinePitcherDecision';
@inline function pose(step: i32): void {
  State.step = step; State.elapsed = 0; State.poise = 0;
  Do.field(Actor.self, Field.step, step); Do.field(Actor.self, Field.clock, 0);
}
@inline function rest(seconds: f64): void { Do.stop(Actor.self); pose(0); State.cooldown = seconds; }
export function onStart(): void { State.sequence = 0; rest(1.8); }
export function onTick(dt: f64): void {
  if (!Read.alive(Actor.self)) { Do.stop(Actor.self); return; }
  State.elapsed = Math.min(600, State.elapsed + dt);
  State.cooldown = Math.max(0, State.cooldown - dt);
  Do.field(Actor.self, Field.clock, State.elapsed);
  if (Read.stunned(Actor.self)) { if (State.step != 4) { Do.stop(Actor.self); pose(4); } return; }
  if (State.step == 4) { if (State.elapsed >= .9) rest(1.5); return; }
  if (State.step != 0) {
    if (State.elapsed > .25 && Read.strikeState(Actor.self) == 0) rest(1.6);
    return;
  }
  // Real idle persists out of range. Root motion is never synthesized in animation.
  if (State.cooldown > 0) return;
  const target = Read.nearestPlayer(Actor.self);
  if (target == 0 || Read.distance(Actor.self, target) > 2.4) return;
  Do.stop(Actor.self);
  if (State.sequence == 0) { pose(1); Do.strike(Actor.self, Strike.crown, target); }
  else if (State.sequence == 1) { pose(2); Do.strike(Actor.self, Strike.left, target); }
  else { pose(3); Do.strike(Actor.self, Strike.right, target); }
  State.sequence = (State.sequence + 1) % 3;
}
export function onStrikeDone(strike: i32, hit: bool): void {
  if (!Read.alive(Actor.self)) return;
  if (State.step == 4) return;
  rest(1.6);
}
export function onHit(by: i32, damage: f64, hp: f64): void {
  if (hp <= 0) { onDeath(by); return; }
  if (State.step >= 1 && State.step <= 3 && Read.strikeState(Actor.self) == 1) {
    State.poise += damage;
    if (State.poise >= 18) { Do.stop(Actor.self); pose(4); }
  }
}
export function onDeath(killer: i32): void { Do.stop(Actor.self); pose(6); Do.field(Actor.self, Field.awake, 0); }
export function onStop(): void { Do.stop(Actor.self); State.sequence = 0; }
