// SF27 Pine Hollow's named elites' shared script prelude: scripts/bake/species-scripts.mjs compiles each elite's module
// (ironhide.as, ghostStag.as, blackpaw.as, imperialBull.as) with this file in front. The ABI is
// @wildshard/game/shardfile/eliteScripts: inputs 0 tick, 1 dt, 2 clock, 3 entity, 4 mode, 5 mode seconds, 6 phase 2,
// 7 distance and 8 yaw to the player, 9-10 player x z, 11-12 own x z, 13 seed, 14 last hit time, 15 god, 16-18 lane 0's
// state (0 none 1 tell 2 run 3 skid), clock and busy, 19-20 host values, 21… slots. The answer is an ordered stream:
// fields 1… the slots, 41-42 argument registers, events the verbs (1 mode, 2 steer, 3 look, 4 voice, 5 signature, 6 lane,
// 7 contact, 8 trauma, 9 attack, 10 ring, 11 ring off, 12 action). Trigonometry and hypot are the host's
// (the math query), random draws the elite's own stream (query 2), so a module matches the TypeScript goal bit for bit.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 64; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
@inline function input(i: i32): f64 { return load<f64>(16384 + i * 8); }
@inline function parameter(i: i32): f64 { return load<f64>(8192 + i * 8); }
function ask(kind: i32, op: f64, x: f64, y: f64): f64 {
  const kx = Math.trunc(x / 8192), ky = Math.trunc(y / 8192);
  store<f64>(4096, op); store<f64>(4104, kx); store<f64>(4112, x - kx * 8192); store<f64>(4120, ky); store<f64>(4128, y - ky * 8192);
  store<f64>(4136, 0); store<f64>(4144, 0); store<f64>(4152, 0);
  if (query(kind, 4096, 12288) !== 1) unreachable();
  return load<f64>(12288);
}
function sin(x: f64): f64 { return ask(1, 1, x, 0); }
function atan2(x: f64, y: f64): f64 { return ask(1, 3, x, y); }
function hypot(x: f64, y: f64): f64 { return ask(1, 4, x, y); }
function random(): f64 { return ask(2, 0, 0, 0); }
function emit(op: f64, a: f64, b: f64, c: f64): void {
  const at = 24576 + count * 40;
  store<f64>(at, op); store<f64>(at + 8, a); store<f64>(at + 16, b); store<f64>(at + 24, c); store<f64>(at + 32, 0);
  count++;
}
function field(id: f64, value: f64): void { emit(1, id, value, 0); }
function verb(id: f64, value: f64): void { emit(3, id, input(3), value); }
function setMode(mode: f64): void { verb(1, mode); }
function steer(yaw: f64, speed: f64, turn: f64): void { field(41, speed); field(42, turn); verb(2, yaw); }
function look(weight: f64, rise: f64): void { field(41, rise); field(42, 1); verb(3, weight); }
function lookWeight(weight: f64): void { field(42, 0); verb(3, weight); }
function voice(i: f64): void { verb(4, i); }
function signature(): void { verb(5, 0); }
function lane(i: f64, tell: f64, speedMul: f64): void { field(41, tell); field(42, speedMul); verb(6, i); }
function contact(i: f64): void { verb(7, i); }
function trauma(k: f64): void { verb(8, k); }
function attack(seconds: f64): void { verb(9, seconds); }
function ring(radius: f64, alpha: f64): void { field(41, alpha); verb(10, radius); }
function ringHide(): void { verb(11, 0); }
function action(i: f64): void { verb(12, i); }
// every call starts here: the output count, the parameters loaded at 8192 (`n` of them)
function begin(n: i32): void {
  count = 0;
  store<f64>(4096, 0); store<f64>(4104, 0); store<f64>(4112, 0); store<f64>(4120, 0); store<f64>(4128, 0); store<f64>(4136, 0); store<f64>(4144, 0); store<f64>(4152, 0);
  if (query(410, 4096, 8192) !== n) unreachable();
}
