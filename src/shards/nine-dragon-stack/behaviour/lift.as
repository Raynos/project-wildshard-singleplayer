// SF51-p (G184) / SF8c socketLift: a lantern lift's cage (and its gates and doors: the same script with the part flag).
// It rests at the deck; an action moves it end to end on a trapezoid speed profile (a tenth of the ride easing in, a tenth
// out); it rests at the winch house, and with nobody calling it comes back down after the dwell (the automatic idle return).
// Parameters: bottom x y z, top x y z, the ride (seconds), the row's part, the dwell at the top (seconds). The parts:
// 0 the cage (always collides), 1 its gates (collide only while it moves), 2 a door at the deck (the end wall's door and the
// stationary road gate across the socket's inner line: collide unless it rests at the bottom), 3 the street's door (unless
// it rests at the top).
// Actions: 1 ride (from either end, to the other), 2 call down (only from the top), 3 call up (only from the bottom); a
// moving cage ignores them (nobody aboard is jolted into a turn back).
// The state lives in the entity's own fields, so a snapshot of them is the whole lift: 5 raised = progress 0..1 along the
// ride, 6 raising = 1 rising, 0.5 lowering, 0 resting at the deck, 0.2..0.4 resting at the top (the dwell's clock).
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
// the fraction of the height reached at progress s: accelerate, cruise, decelerate (peak speed 1 / (1 - RAMP) of the mean)
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
  } else if (atTop) {
    if (action === 1 || action === 2) raising = DOWN;
    else {
      raising += (DWELL1 - DWELL0) * dt / dwell;
      if (raising >= DWELL1 - 1e-9) raising = DOWN;
    }
  }
  // the last few millimetres settle in one step, so a cage within a millimetre of a stop is resting there (its doors open)
  if (raising === UP) { s += dt / travel; if (s >= 1 - SETTLE) { s = 1; raising = DWELL0; } }
  else if (raising === DOWN) { s -= dt / travel; if (s <= SETTLE) { s = 0; raising = 0; } }
  const u = eased(s);
  store<f64>(24576, 4); store<f64>(24584, param(0) + (param(3) - param(0)) * u); store<f64>(24592, param(1) + (param(4) - param(1)) * u);
  store<f64>(24600, param(2) + (param(5) - param(2)) * u); store<f64>(24608, 0);
  count = 1;
  const part = param(7), moving = raising === UP || raising === DOWN;
  let collide: f64 = 1;
  if (part === 1) collide = moving ? 1 : 0;
  else if (part === 2) collide = raising === 0 && s === 0 ? 0 : 1;
  else if (part === 3) collide = raising >= DWELL0 && raising <= DWELL1 && s === 1 ? 0 : 1;
  field(4, collide);
  field(5, s);
  field(6, raising);
}
