// SF51-p (G184): a lantern lift's cage (and its gates: the same script with the gate flag). It rests at the deck or at the
// winch house; an action moves it end to end on a trapezoid speed profile (a tenth of the ride easing in, a tenth out).
// Parameters: bottom x y z, top x y z, the ride (seconds), the row's part: 0 the cage (always collides), 1 its gates
// (collide only while it moves), 2 the deck's door (collides unless it rests at the bottom), 3 the street's door (unless
// it rests at the top).
// Actions: 1 ride (from either end, to the other), 2 call down (only from the top), 3 call up (only from the bottom).
// The state lives in the entity's own fields, so a snapshot of them is the whole lift: 5 raised = progress 0..1 along the
// ride, 6 raising = 1 rising, 0.5 lowering, 0 at rest.
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
const RAMP: f64 = 0.1;
// the fraction of the height reached at progress s: accelerate, cruise, decelerate (peak speed 1 / (1 - RAMP) of the mean)
@inline function eased(s: f64): f64 {
  const top: f64 = 1 / (1 - RAMP);
  if (s < RAMP) return top * s * s / (2 * RAMP);
  if (s > 1 - RAMP) return 1 - top * (1 - s) * (1 - s) / (2 * RAMP);
  return top * (s - RAMP / 2);
}
export function on_tick(): void {
  count = 0;
  if (query(410, 4096, 8192) !== 8) unreachable();
  const action = input(2), dt = input(1), travel = param(6);
  let s = input(10), raising = input(11);
  if (raising === 0) {
    if (action === 1) raising = s < 0.5 ? 1 : 0.5;
    else if (action === 2 && s >= 0.5) raising = 0.5;
    else if (action === 3 && s < 0.5) raising = 1;
  }
  if (raising === 1) { s += dt / travel; if (s >= 1) { s = 1; raising = 0; } }
  else if (raising === 0.5) { s -= dt / travel; if (s <= 0) { s = 0; raising = 0; } }
  const u = eased(s);
  store<f64>(24576, 4); store<f64>(24584, param(0) + (param(3) - param(0)) * u); store<f64>(24592, param(1) + (param(4) - param(1)) * u);
  store<f64>(24600, param(2) + (param(5) - param(2)) * u); store<f64>(24608, 0);
  count = 1;
  const part = param(7), resting = raising === 0;
  let collide: f64 = 1;
  if (part === 1) collide = resting ? 0 : 1;
  else if (part === 2) collide = resting && s === 0 ? 0 : 1;
  else if (part === 3) collide = resting && s === 1 ? 0 : 1;
  field(4, collide);
  field(5, s);
  field(6, raising);
}
