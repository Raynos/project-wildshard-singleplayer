// SF27 Signal Dunes' sand skitterer as an admitted species script (behaviour/skitterer.json; rebuilt by
// `node scripts/bake/species-scripts.mjs` in a clean export). It waits under the sand (burrow 1 sinks the body), bursts out
// when the player comes near, runs in on a ring round the player at its own angle, asks for its bite, darts back after a
// bite, comes again; left alone it burrows again. A pure function of its inputs: its state is the host's slots.
// Inputs: 0 tick, 1 dt, 2 phase (1 think, 2 act), 3 entity, 4 alive, 5 calm, 6 t, 7 distance, 8 yaw to the player,
// 9-10 player x z, 11-12 own x z, 13 own yaw, 14 seed hash, 15 strike phase (0 idle 1 windup 2 active 3 recover 4 cooldown),
// 16 strike busy, 17-19 slots (state: 0 buried 1 burst 2 hunt 3 retreat, clock, far), 20 burrow.
// Trigonometry is the host's (the math query), so it matches the TypeScript policy it replaced bit for bit.
// Parameters: 0 wake, 1 sleep, 2 burst, 3 run, 4 ring, 5 retreat, 6 rebury, 7 bite range.
// Outputs: fields 1-3 the slots, 21 burrow, 31-33 steer (yaw, speed, turn rate); event 1 the bite request.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 8; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
@inline function input(i: i32): f64 { return load<f64>(16384 + i * 8); }
@inline function parameter(i: i32): f64 { return load<f64>(8192 + i * 8); }
// The host's Math through the math query (1): an argument splits into an exact multiple of 8192 and its remainder.
function math(op: f64, x: f64, y: f64): f64 {
  const kx = Math.trunc(x / 8192), ky = Math.trunc(y / 8192);
  store<f64>(4096, op); store<f64>(4104, kx); store<f64>(4112, x - kx * 8192); store<f64>(4120, ky); store<f64>(4128, y - ky * 8192);
  store<f64>(4136, 0); store<f64>(4144, 0); store<f64>(4152, 0);
  if (query(1, 4096, 12288) !== 1) unreachable();
  return load<f64>(12288);
}
function emit(op: f64, a: f64, b: f64): void {
  const at = 24576 + count * 40;
  store<f64>(at, op); store<f64>(at + 8, a); store<f64>(at + 16, b); store<f64>(at + 24, 0); store<f64>(at + 32, 0);
  count++;
}
function field(id: f64, value: f64): void { emit(1, id, value); }
function steer(yaw: f64, speed: f64, turn: f64): void { field(31, yaw); field(32, speed); field(33, turn); }
let state: f64 = 0;
let clock: f64 = 0;
let far: f64 = 0;
function save(): void { field(1, state); field(2, clock); field(3, far); }
export function on_tick(): void {
  count = 0;
  store<f64>(4096, 0); store<f64>(4104, 0); store<f64>(4112, 0); store<f64>(4120, 0); store<f64>(4128, 0); store<f64>(4136, 0); store<f64>(4144, 0); store<f64>(4152, 0);
  if (query(410, 4096, 8192) !== 8) unreachable();
  state = input(17); clock = input(18); far = input(19);
  const alive = input(4) !== 0, calm = input(5) !== 0, d = input(7), toPlayer = input(8), busy = input(16) !== 0, strike = input(15);
  if (input(2) === 1) {
    if (alive) {
      if (state === 0 && !calm && d < parameter(0)) { state = 1; clock = 0; }
      if (state === 2 && !busy && d < parameter(7)) emit(3, 1, input(3));
    }
    save(); return;
  }
  if (!alive) { field(21, 0); save(); return; }
  const dt = input(1), burrow = input(20);
  clock += dt;
  if (state === 0) { field(21, Math.min(1, burrow + dt * 1.5)); steer(input(13), 0, 2); save(); return; }
  if (state === 1) {
    field(21, Math.max(0, 1 - clock / parameter(2))); steer(toPlayer, 0, 6);
    if (clock >= parameter(2)) state = 2;
    save(); return;
  }
  field(21, 0);
  far = d > parameter(1) || calm ? far + dt : 0;
  if (far > parameter(6)) { state = 0; save(); return; }
  if (strike === 3) { state = 3; clock = 0; }
  if (busy && strike !== 4) { steer(toPlayer, 0, 8); save(); return; }
  if (state === 3) {
    steer(toPlayer + Math.PI + (input(14) % 2 === 0 ? 0.6 : -0.6), parameter(3), 7);
    if (clock > parameter(5)) state = 2;
    save(); return;
  }
  const ring = parameter(4), angle = (input(14) % 7) * 0.9 + input(6) * 0.4;
  const tx = input(9) + math(1, angle, 0) * ring, tz = input(10) + math(2, angle, 0) * ring;
  const goal = d < ring * 1.4 ? toPlayer : math(3, tx - input(11), tz - input(12));
  steer(goal, d < 1.2 ? 0 : parameter(3), 8);
  save();
}
