import { State, Read, Do, Clock, Field, Move, Strike, Cue, Params } from '../generated/pineEliteIronhide';
import { heading, distance } from './common';

function mode(value: i32): void { State.mode = value; State.modeT = 0; }
function steer(yaw: f64, speed: f64, turn: f64): void {
  Do.field(Clock.self, Field.heading, yaw); Do.field(Clock.self, Field.speed, speed); Do.field(Clock.self, Field.turn, turn);
  Do.move(Clock.self, Move.steer);
}
function look(player: i32, weight: f64): void {
  Do.field(Clock.self, Field.lookHeight, 0); Do.field(Clock.self, Field.lookWeight, weight);
}
export function onStart(): void { mode(0); State.wanderT = 0; State.again = false; }
export function onSignal(signal: i32, value: f64, by: i32): void {
  if (value === 1) { Do.strike(Clock.self, Strike.charge, Read.nearestPlayer(Clock.self)); mode(3); }
}
export function onTick(dt: f64): void {
  const self = Clock.self, player = Read.nearestPlayer(self);
  if (!Read.alive(self) || player === 0) return;
  State.modeT += dt;
  const x = Read.x(self), z = Read.z(self), px = Read.x(player), pz = Read.z(player);
  const d = distance(x, z, px, pz), yaw = heading(x, z, px, pz);
  if (Read.field(self, Field.leashing) > 0) {
    Do.stop(self); State.again = false; mode(1);
    const home = distance(x, z, Params.lairX, Params.lairZ);
    steer(heading(x, z, Params.lairX, Params.lairZ), home > 3 ? 4 : 0, 2.5); look(player, 0); return;
  }
  if (Read.field(self, Field.engaged) === 0) {
    State.wanderT -= dt;
    if (State.wanderT <= 0) {
      State.wanderT = 7 + Read.random() * 8;
      const angle = Read.random() * Math.PI * 2, r = Read.random() * Params.lairRadius * 0.6;
      State.wx = Params.lairX + Math.cos(angle) * r; State.wz = Params.lairZ + Math.sin(angle) * r;
    }
    steer(heading(x, z, State.wx, State.wz), distance(x, z, State.wx, State.wz) > 1.5 && State.wanderT < 5 ? 1.1 : 0, 1.5);
    look(player, d < Params.awareRadius ? 0.8 : 0); return;
  }
  const p2 = Read.field(self, Field.phase2) > 0;
  look(player, 1);
  if (State.mode === 3) {
    if (Read.strikeState(self) === 2 && Read.field(self, Field.strikeTime) < dt * 1.5) Do.cue(Cue.squeal, self);
    if (Read.strikeState(self) === 0) {
      if (State.again) { State.again = false; Do.strike(self, Strike.again, player); return; }
      mode(2);
    }
    return;
  }
  const side: f64 = Math.sin(Read.field(self, Field.seed) * 31) > 0 ? 1 : -1;
  const bend = Math.max(-1, Math.min(1, (d - 13) / 8)) * 0.9 * side;
  steer(yaw + side * Math.PI / 2 - bend, 4.2, 2.8);
  if (State.mode === 0 || State.mode === 1) mode(2);
  if (State.modeT > (p2 ? 1.4 : 2.6) && d < 30) {
    Do.strike(self, p2 ? Strike.chargePhase2 : Strike.charge, player);
    State.again = p2 && Read.random() < 0.55;
    Do.cue(Cue.grunt, self); Do.cue(Cue.signature, self); mode(3);
  }
}
