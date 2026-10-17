import { State, Read, Do, Clock, Field, Move, Strike, Cue, Params } from '../generated/pineEliteBlackpaw';
import { heading, distance } from './common';

function mode(value: i32): void { State.mode = value; State.modeT = 0; }
function steer(yaw: f64, speed: f64, turn: f64): void {
  Do.field(Clock.self, Field.heading, yaw); Do.field(Clock.self, Field.speed, speed); Do.field(Clock.self, Field.turn, turn);
  Do.move(Clock.self, Move.steer);
}
function look(player: i32, weight: f64): void {
  Do.field(Clock.self, Field.lookHeight, 0); Do.field(Clock.self, Field.lookWeight, weight);
}
function relocate(x: f64, z: f64): void {
  Do.field(Clock.self, Field.x, x); Do.field(Clock.self, Field.z, z); Do.move(Clock.self, Move.relocate, Read.nearestPlayer(Clock.self));
}
function lurk(): void { relocate(Params.mouthX, Params.mouthZ); Do.field(Clock.self, Field.hidden, 1); mode(2); }
function burst(): void {
  relocate(Params.burstX, Params.burstZ); Do.field(Clock.self, Field.hidden, 0);
  Do.cue(Cue.burst, Clock.self); Do.cue(Cue.signature, Clock.self); mode(3);
}
function roar(player: i32, p2: bool): void { mode(3); Do.strike(Clock.self, p2 ? Strike.roarPhase2 : Strike.roar, player); Do.cue(Cue.growl, Clock.self); }
export function onStart(): void { State.roarCd = 0; State.swipeT = -1; lurk(); }
export function onSignal(_signal: i32, value: f64, _by: i32): void {
  if (Read.field(Clock.self, Field.hidden) > 0) burst();
  const player = Read.nearestPlayer(Clock.self), p2 = Read.field(Clock.self, Field.phase2) > 0;
  if (value === 1) roar(player, p2); else { Do.strike(Clock.self, p2 ? Strike.chargePhase2 : Strike.charge, player); mode(4); }
}
export function onTick(dt: f64): void {
  const self = Clock.self, player = Read.nearestPlayer(self);
  if (!Read.alive(self) || player === 0) return;
  State.modeT += dt; State.roarCd -= dt;
  const x = Read.x(self), z = Read.z(self), px = Read.x(player), pz = Read.z(player);
  const d = distance(x, z, px, pz), yaw = heading(x, z, px, pz), p2 = Read.field(self, Field.phase2) > 0;
  if (Read.field(self, Field.leashing) > 0 || Read.field(self, Field.engaged) === 0) {
    Do.stop(self); look(player, 0);
    if (State.mode === 2) return;
    const home = distance(x, z, Params.mouthX, Params.mouthZ);
    if (home > 2.5) { steer(heading(x, z, Params.mouthX, Params.mouthZ), 2.2, 2); return; }
    if (d > 35) lurk(); return;
  }
  look(player, 1);
  if (State.mode === 2) { burst(); roar(player, p2); return; }
  if (State.mode === 3) {
    if (Read.strikeState(self) !== 0) return;
    State.roarCd = p2 ? 5.5 : 10;
    if (d > 5) { Do.strike(self, p2 ? Strike.chargePhase2 : Strike.charge, player); mode(4); } else mode(6);
    return;
  }
  if (State.mode === 4 || State.mode === 5) { if (Read.strikeState(self) === 0) mode(6); return; }
  if (State.mode !== 6) mode(6);
  steer(yaw, d > 3 ? (p2 ? 4 : 3.2) : 0, 2.2);
  if (State.roarCd <= 0 && d < 12) roar(player, p2);
  else if (d < 3.6) { Do.strike(self, Strike.swipe, player); mode(5); }
  else if (d > 7 && d < 22 && State.modeT > 2.2) { Do.strike(self, p2 ? Strike.chargePhase2 : Strike.charge, player); mode(4); }
}
