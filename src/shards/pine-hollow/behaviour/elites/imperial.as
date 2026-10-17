import { State, Read, Do, Clock, Spawn, Channel, Field, Move, Strike, Cue, Params } from '../generated/pineEliteImperialBull';
import { heading, distance } from './common';

function mode(value: i32): void { State.mode = value; State.modeT = 0; }
function steer(yaw: f64, speed: f64, turn: f64): void {
  Do.field(Clock.self, Field.heading, yaw); Do.field(Clock.self, Field.speed, speed); Do.field(Clock.self, Field.turn, turn);
  Do.move(Clock.self, Move.steer);
}
function look(player: i32, weight: f64): void {
  Do.field(Clock.self, Field.lookHeight, 0); Do.field(Clock.self, Field.lookWeight, weight);
}
function rival(dt: f64): void {
  const self = Clock.self, player = Read.nearestPlayer(self);
  if (Read.field(self, Field.engaged) === 0 || Read.field(self, Field.leashing) > 0) {
    State.call = Read.field(self, Field.call);
    if (Read.alive(self)) { Do.stop(self); Do.field(self, Field.scripted, 0); } return;
  }
  if (!Read.alive(self)) {
    if (Read.field(self, Field.call) <= State.call) return;
    State.call = Read.field(self, Field.call);
    const side: f64 = self === i32(Params.rival0) ? 1 : -1;
    const yaw = Read.field(self, Field.callYaw) + side * Math.PI / 2;
    const px = Read.x(player), pz = Read.z(player);
    let x = px + Math.sin(yaw) * 55, z = pz + Math.cos(yaw) * 55;
    if (Math.abs(x) > Params.bound || Math.abs(z) > Params.bound) { x = px - Math.sin(yaw) * 40; z = pz - Math.cos(yaw) * 40; }
    Do.field(self, Field.x, x); Do.field(self, Field.z, z);
    Do.spawn(self === i32(Params.rival0) ? Spawn.rival0 : Spawn.rival1); Do.cue(Cue.bugle, self); mode(0); return;
  }
  const yaw = heading(Read.x(self), Read.z(self), Read.x(player), Read.z(player));
  if (State.mode === 3) {
    if (Read.strikeState(self) === 0) mode(0);
    return;
  }
  const d = Read.distance(self, player);
  steer(yaw, d > 16 ? 7 : 1.5, 2.5); look(player, 1);
  if (d < 20 && Read.random() < dt * 0.6) { Do.strike(self, Strike.rival, player); mode(3); }
}
export function onStart(): void { mode(0); State.wanderT = 0; State.bugledPhase = -1; State.call = 0; }
export function onSignal(_signal: i32, value: f64, _by: i32): void {
  if (value === 1) mode(2); else { Do.strike(Clock.self, Read.field(Clock.self, Field.phase2) > 0 ? Strike.chargePhase2 : Strike.charge, Read.nearestPlayer(Clock.self)); mode(3); }
}
export function onTick(dt: f64): void {
  if (Clock.self !== i32(Params.main)) { rival(dt); return; }
  const self = Clock.self, player = Read.nearestPlayer(self);
  if (!Read.alive(self) || player === 0) return;
  State.modeT += dt;
  const x = Read.x(self), z = Read.z(self), px = Read.x(player), pz = Read.z(player);
  const d = distance(x, z, px, pz), yaw = heading(x, z, px, pz);
  if (Read.field(self, Field.leashing) > 0) {
    Do.stop(self); State.bugledPhase = -1; mode(1);
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
  if (State.mode === 2) {
    steer(yaw, 0, 2); Do.field(self, Field.lookHeight, 12);
    if (State.modeT > 0.2 && State.modeT - dt <= 0.2) Do.cue(Cue.bugle, self);
    if (State.modeT >= 1.8) {
      Do.channel(Channel.callYaw, yaw); State.call += 1; Do.channel(Channel.call, State.call); mode(4);
    }
    return;
  }
  if (State.mode === 3) { if (Read.strikeState(self) === 0) mode(4); return; }
  if (State.mode !== 4) mode(4);
  const phase: i32 = p2 ? 1 : 0;
  if (State.bugledPhase < phase && Read.spawnGroupAlive(Spawn.group) === 1 && (Read.field(self, Field.dusk) > 0.45 || Read.field(self, Field.night) > 0.45)) {
    State.bugledPhase = phase; mode(2); Do.cue(Cue.signature, self); return;
  }
  const back: f64 = d < 18 ? -1 : d > 26 ? 1 : 0;
  const side: f64 = Math.sin(Read.field(self, Field.clock) * 0.7 + Read.field(self, Field.seed) * 9) > 0 ? 1 : -1;
  steer(back === 0 ? yaw + side * 1.2 : back > 0 ? yaw : yaw + Math.PI, back === 0 ? 1.2 : 3.5, 2.2);
  if (State.modeT > (p2 ? 2 : 3.2)) { Do.strike(self, p2 ? Strike.chargePhase2 : Strike.charge, player); Do.cue(Cue.call, self); mode(3); }
}
