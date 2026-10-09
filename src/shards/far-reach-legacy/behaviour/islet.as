// SF49-g (G183) / SF8c socketLift: the Rising Islet (and its road gate: the same script with the gate flag). The islet
// rests level with the road; an action carries it up its chains to the gate isle (a tenth of the ride easing in, a tenth out);
// it rests there, and with nobody calling it comes back down after the dwell (the automatic idle return).
// Parameters: rest x y z, dock x y z, the travel one way (seconds), the row's part (0 the islet, which always collides;
// 1 its stationary road gate, which collides while the islet is away from the road), the dwell at the top (seconds).
// Actions: 1 ride (from either end, to the other; on the way, turn back), 2 call down, 3 call up (either also turns a ride
// heading the other way).
// The state lives in the entity's own fields, so a snapshot of them is the whole lift: 5 raised = progress 0..1 along the
// chains; 6 raising = 1 rising, 0.5 lowering, 0 resting at the road, 0.2..0.4 resting at the top (the dwell's clock).
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 4; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
@inline function input(i: i32): f64 { return load<f64>(16384 + i * 8); }
@inline function param(i: i32): f64 { return load<f64>(8192 + i * 8); }
@inline function field(id: f64, value: f64): void {
  const o = 24576 + count * 40; store<f64>(o, 1); store<f64>(o + 8, id); store<f64>(o + 16, value); store<f64>(o + 24, 0); store<f64>(o + 32, 0); count++;
}
const UP: f64 = 1;
const DOWN: f64 = 0.5;
const DWELL0: f64 = 0.2;
const DWELL1: f64 = 0.4;
const RAMP: f64 = 0.1;
const SETTLE: f64 = 0.004;
// the fraction of the climb reached at progress s: accelerate, cruise, decelerate (peak speed 1 / (1 - RAMP) of the mean)
@inline function eased(s: f64): f64 {
  const top: f64 = 1 / (1 - RAMP);
  if (s < RAMP) return top * s * s / (2 * RAMP);
  if (s > 1 - RAMP) return 1 - top * (1 - s) * (1 - s) / (2 * RAMP);
  return top * (s - RAMP / 2);
}
export function on_tick(): void {
  count = 0;
  if (query(410, 4096, 8192) !== 9) unreachable();
  const action = input(2), dt = input(1), travel = param(6), dwell = param(8);
  let s = input(10), raising = input(11);
  const atTop = raising >= DWELL0 && raising <= DWELL1;
  if (raising === 0) {
    if (action === 1 || action === 3) raising = UP;
  } else if (raising === UP) {
    if (action === 1 || action === 2) raising = DOWN;
  } else if (raising === DOWN) {
    if (action === 1 || action === 3) raising = UP;
  } else if (atTop) {
    if (action === 1 || action === 2) raising = DOWN;
    else {
      raising += (DWELL1 - DWELL0) * dt / dwell;
      if (raising >= DWELL1 - 1e-9) raising = DOWN;
    }
  }
  // the last few millimetres settle in one step, so a deck within a millimetre of a stop is resting there (its gate open)
  if (raising === UP) { s += dt / travel; if (s >= 1 - SETTLE) { s = 1; raising = DWELL0; } }
  else if (raising === DOWN) { s -= dt / travel; if (s <= SETTLE) { s = 0; raising = 0; } }
  const e = eased(s);
  store<f64>(24576, 4); store<f64>(24584, param(0) + (param(3) - param(0)) * e); store<f64>(24592, param(1) + (param(4) - param(1)) * e);
  store<f64>(24600, param(2) + (param(5) - param(2)) * e); store<f64>(24608, 0); count = 1;
  // the islet always collides; the gate closes the road whenever the islet is not resting at the road
  field(4, param(7) === 0 ? 1 : (s > 0 || raising !== 0 ? 1 : 0));
  field(5, s); field(6, raising);
}
