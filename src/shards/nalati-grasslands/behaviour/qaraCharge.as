import { State, Read, Do, Clock, Field, Move, Strike, Cue, Params } from './generated/nalatiQaraCharge';
function mode(n: i32): void { State.mode = n; State.time = 0; }
function steer(yaw: f64, speed: f64, turn: f64): void {
  Do.field(Clock.self, Field.heading, yaw); Do.field(Clock.self, Field.speed, speed); Do.field(Clock.self, Field.turn, turn); Do.move(Clock.self, Move.steer);
}
function next(p2: bool): void {
  if (p2 && !State.paired) { State.paired = true; mode(2); return; }
  State.paired = false; State.cooldown = p2 ? 4.5 : 6.5; mode(1);
}
export function onStart(): void { mode(0); State.cooldown = 3; State.paired = false; }
export function onSignal(signal: i32, value: f64, by: i32): void { mode(value === 0 ? 5 : 2); }
export function onTick(dt: f64): void {
  const a = Clock.self, player = Read.nearestPlayer(a);
  if (!Read.alive(a) || player === 0) return;
  const x = Read.x(a), z = Read.z(a), px = Read.x(player), pz = Read.z(player);
  const dx = px - x, dz = pz - z, d = Math.sqrt(dx * dx + dz * dz), yaw = Math.atan2(dx, dz);
  const engaged = Read.field(a, Field.engaged) > 0, p2 = Read.field(a, Field.phase2) > 0;
  State.time += dt;
  if (Read.field(a, Field.leashing) > 0) {
    Do.stop(a); mode(5); steer(Math.atan2(Params.lairX - x, Params.lairZ - z), 9, 2.4); return;
  }
  if ((State.mode === 0 || State.mode === 5) && (engaged || d < Params.awareRadius * 0.8)) { mode(1); State.cooldown = 3; }
  if (State.mode === 5) { const hx = Params.lairX - x, hz = Params.lairZ - z; steer(Math.atan2(hx, hz), Math.sqrt(hx * hx + hz * hz) > 5 ? 9 : 0, 2.4); return; }
  if (State.mode === 0) { steer(Read.yaw(a), 0, 1.5); return; }
  if (State.mode === 1) {
    const angle = Math.atan2(x - px, z - pz) + 0.55;
    steer(Math.atan2(px + Math.sin(angle) * 22 - x, pz + Math.cos(angle) * 22 - z), 10, 2.2);
    State.cooldown -= dt;
    if (State.cooldown <= 0) { Do.strike(a, Strike.charge, player); Do.cue(Cue.signature, a); mode(3); }
  } else if (State.mode === 2) {
    Do.strike(a, Strike.charge, player); Do.cue(Cue.signature, a); mode(3);
  } else if (State.mode === 3) {
    if (Read.strikeState(a) === 2 && Read.field(a, Field.strikeTime) < dt * 1.5) Do.cue(Cue.squeal, a);
    if (Read.strikeState(a) === 0) { mode(4); Do.cue(Cue.opened, a); }
  } else if (State.mode === 4) {
    steer(Read.yaw(a), 3, 1); if (State.time > 2) next(p2);
  }
}
