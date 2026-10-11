// Qara Batyr's night charge, on the SDK elite-script ABI-v0 used by Pine's fights.
// Native authority keeps the real crew and the 3D charge endpoints. Four slots keep
// the original clock, cooldown, phase-two pair and struck flag; no private Wasm state.
// Inputs 19/20 are the native along-lane fraction / height above ground.
// Parameters follow data/qaraBrain.ts in named groups below.
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

// Exact page Math, through the admitted host query (never AssemblyScript libm).
function math(op: f64, x: f64, y: f64): f64 {
  const kx = Math.trunc(x / 8192), ky = Math.trunc(y / 8192);
  store<f64>(4096, op); store<f64>(4104, kx); store<f64>(4112, x - kx * 8192);
  store<f64>(4120, ky); store<f64>(4128, y - ky * 8192);
  store<f64>(4136, 0); store<f64>(4144, 0); store<f64>(4152, 0);
  if (query(1, 4096, 12288) !== 1) unreachable();
  return load<f64>(12288);
}
function emit(op: f64, a: f64, b: f64, c: f64): void {
  const at = 24576 + count * 40;
  store<f64>(at, op); store<f64>(at + 8, a); store<f64>(at + 16, b);
  store<f64>(at + 24, c); store<f64>(at + 32, 0); count++;
}
function field(id: f64, value: f64): void { emit(1, id, value, 0); }
function verb(id: f64, value: f64): void { emit(3, id, input(3), value); }
function args(x: f64, z: f64): void { field(41, x); field(42, z); }
function target(x: f64, z: f64): void { args(x, z); verb(12, 0); }
// Native puppet steering keeps the page's think cadence (mem.v / mem.turn).
function steer(speed: f64, turn: f64): void { args(speed, turn); verb(2, 0); }
function drawLane(alpha: f64): void { args(alpha, 0); verb(12, 4); }
const WAIT: f64 = 0, CIRCLE: f64 = 1, WHEEL: f64 = 2, CHARGE: f64 = 3, OPEN: f64 = 4, HOME: f64 = 5;
let clock: f64 = 0, cooldown: f64 = 0, pairs: f64 = 0, struck: f64 = 0;
function nextCharge(p2: bool): void {
  if (p2 && pairs === 0) { pairs = 1; verb(1, WHEEL); clock = 0; return; }
  pairs = 0; verb(1, CIRCLE); cooldown = p2 ? parameter(27) : parameter(26);
}
export function on_tick(): void {
  count = 0;
  for (let i: i32 = 0; i < 8; i++) store<f64>(4096 + i * 8, 0);
  if (query(410, 4096, 8192) !== 31) unreachable();
  clock = input(21) + input(1); cooldown = input(22); pairs = input(23); struck = input(24);
  const mode = input(4), p2 = input(6) !== 0, px = input(9), pz = input(10), x = input(11), z = input(12);
  switch (mode) {
    case WAIT: target(x, z); steer(0, parameter(0)); break;
    case HOME:
      target(parameter(28), parameter(29)); steer(parameter(1), parameter(2));
      if (math(4, x - parameter(28), z - parameter(29)) < parameter(3)) verb(1, WAIT);
      break;
    case CIRCLE: {
      const angle = math(3, x - px, z - pz) + parameter(5);
      target(px + math(1, angle, 0) * parameter(4), pz + math(2, angle, 0) * parameter(4));
      steer(parameter(6), parameter(7)); cooldown -= input(1);
      if (cooldown <= 0) { verb(1, WHEEL); clock = 0; verb(5, 0); }
      break;
    }
    case WHEEL: {
      target(px, pz); steer(parameter(8), parameter(9));
      const dx = px - x, dz = pz - z, length = math(4, dx, dz);
      const d = length === 0 ? 1 : length;
      args(px + dx / d * parameter(10), pz + dz / d * parameter(10)); verb(12, 1);
      drawLane(parameter(11) + parameter(12) * Math.min(1, clock / parameter(13)));
      if (clock > parameter(14)) { verb(1, CHARGE); clock = 0; struck = 0; verb(4, 0); }
      break;
    }
    case CHARGE:
      verb(12, 2); steer(parameter(15), parameter(16)); drawLane(parameter(17));
      if (struck === 0 && input(7) < parameter(18) && input(20) < parameter(19)) {
        struck = 1; args(parameter(20), 0); verb(12, 5);
      }
      if (input(19) >= parameter(21) || clock > parameter(22)) {
        verb(11, 0);
        if (struck === 0) { verb(1, OPEN); clock = 0; verb(4, 1); }
        else nextCharge(p2);
      }
      break;
    case OPEN:
      args(parameter(25), 0); verb(12, 3); steer(parameter(23), parameter(24));
      if (clock > parameter(30)) nextCharge(p2);
      break;
    default: unreachable();
  }
  field(1, clock); field(2, cooldown); field(3, pairs); field(4, struck);
}
