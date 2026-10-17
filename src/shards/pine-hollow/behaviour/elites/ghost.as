import { State, Read, List, Do, Clock, Field, Move, Strike, Cue, Params } from '../generated/pineEliteGhostStag';
import { heading, distance, fleeHeading } from './common';

function mode(value: i32): void { State.mode = value; State.modeT = 0; }
function steer(yaw: f64, speed: f64, turn: f64): void {
  Do.field(Clock.self, Field.heading, yaw); Do.field(Clock.self, Field.speed, speed); Do.field(Clock.self, Field.turn, turn);
  Do.move(Clock.self, Move.steer);
}
function look(player: i32, weight: f64): void {
  Do.field(Clock.self, Field.lookHeight, 0); Do.field(Clock.self, Field.lookWeight, weight);
}
function vanish(): void {
  Do.field(Clock.self, Field.hidden, 1); Do.stop(Clock.self);
  Do.cue(Cue.fade, Clock.self); Do.cue(Cue.call, Clock.self); Do.cue(Cue.signature, Clock.self);
  State.fadeT = 2; State.cd = Read.field(Clock.self, Field.phase2) > 0 ? 2.4 : 4.5; mode(2);
}
function appear(x: f64, z: f64, player: i32): void {
  Do.field(Clock.self, Field.x, x); Do.field(Clock.self, Field.z, z);
  Do.move(Clock.self, Move.relocate, player); Do.field(Clock.self, Field.hidden, 0);
  Do.cue(Cue.reappear, Clock.self); mode(3);
}
function comeback(player: i32): void {
  const px = Read.x(player), pz = Read.z(player), yaw = Read.yaw(player);
  for (let i: i32 = 0; i < 8; i++) {
    const side: f64 = i === 0 ? 0 : i === 1 ? 0.6 : i === 2 ? -0.6 : i === 3 ? 1.2 : i === 4 ? -1.2 : i === 5 ? 1.8 : i === 6 ? -1.8 : Math.PI;
    const r = 14 + Read.random() * 4, x = px + Math.sin(yaw + side) * r, z = pz + Math.cos(yaw + side) * r;
    if (Math.abs(x) > Params.bound || Math.abs(z) > Params.bound || distance(x, z, Params.lairX, Params.lairZ) > Params.leashRadius - 12) continue;
    Read.groundHeight(x, z); const y = List.at(0); Read.groundHeight(px, pz);
    if (Math.abs(y - List.at(0)) > 6) continue;
    appear(x, z, player); return;
  }
  appear(Read.x(Clock.self), Read.z(Clock.self), player);
}
export function onStart(): void { mode(0); State.wanderT = 0; State.cd = 3; State.lastHit = -1000000; State.fadeT = 0; State.autoT = 5; }
export function onSignal(_signal: i32, _value: f64, _by: i32): void { vanish(); }
export function onTick(dt: f64): void {
  const self = Clock.self, player = Read.nearestPlayer(self);
  if (!Read.alive(self) || player === 0) return;
  State.modeT += dt;
  const x = Read.x(self), z = Read.z(self), px = Read.x(player), pz = Read.z(player);
  const d = distance(x, z, px, pz), yaw = heading(x, z, px, pz);
  if (Read.field(self, Field.leashing) > 0) {
    Do.stop(self); Do.field(self, Field.hidden, 0); mode(1);
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
  const p2 = Read.field(self, Field.phase2) > 0, hit = Read.field(self, Field.lastHit) > State.lastHit;
  State.cd -= dt; if (hit) State.lastHit = Read.field(self, Field.lastHit);
  if (State.mode === 2) { State.fadeT -= dt; if (State.fadeT <= 0) comeback(player); return; }
  if (State.cd <= 0 && (hit || d < 12)) { vanish(); return; }
  if (p2 && State.mode === 4) { State.autoT -= dt; if (State.autoT <= 0 && State.cd <= 0) { State.autoT = 3.5 + Read.random() * 1.5; vanish(); return; } }
  if (State.mode === 3) { steer(yaw, 0, 4); look(player, 1); if (State.modeT > (p2 ? 1.1 : 1.6) || hit) mode(4); return; }
  if (State.mode !== 4) mode(4);
  steer(fleeHeading(x, z, px, pz, Params.lairX, Params.lairZ, Params.leashRadius * 0.55), 7, 3.2); look(player, 0);
  if (State.modeT > 2.6 + (Read.field(self, Field.seed) % 1) * 1.4) mode(3);
}
