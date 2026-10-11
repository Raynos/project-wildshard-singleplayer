// Readable ABI-v0 fixed motion kernels. Rows supply every stop, speed, wave and permission.
// Keep arithmetic and field order stable: the complete guest continuation is part of saved gameplay.
const ride = String.raw`// SF49-g (G183) / SF8c socketLift: the Rising Islet (and its road gate: the same script with the gate flag). The islet
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
`;
const waves = String.raw`// ABI-v0: tick, dt, action, self, permissions, parameter count; then data and six pose/state fields.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 5; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
const PI: f64 = 3.141592653589793, TAU: f64 = 6.283185307179586;
@inline function input(i: i32): f64 { return load<f64>(16384 + i * 8); }
@inline function param(i: i32): f64 { return load<f64>(8192 + i * 8); }
// Range-reduced 13th-order sine. The recorded-pose witness checks its resulting metric error.
@inline function sine(value: f64): f64 {
  const x = value - Math.floor(value / TAU + 0.5) * TAU;
  const z = x * x;
  return x * (1 + z * (-1.0/6 + z * (1.0/120 + z * (-1.0/5040 + z * (1.0/362880 + z * (-1.0/39916800 + z / 6227020800))))));
}
let dx: f64 = 0, dy: f64 = 0, dz: f64 = 0;
@inline function wave(i: i32, x: f64, z: f64, t: f64): void {
  const o = 5 + i * 6, wx = param(o), wz = param(o+1), amp = param(o+2), k = TAU / param(o+3), speed = param(o+4), q = param(o+5);
  const phase = k * (wx*x + wz*z - speed*t), qa = q / (k * 4), c = sine(phase + PI/2);
  dx += wx*qa*c; dz += wz*qa*c; dy += amp*sine(phase);
}
@inline function displace(x: f64, z: f64, t: f64): void {
  dx = 0; dy = 0; dz = 0;
  wave(0,x,z,t); wave(1,x,z,t); wave(2,x,z,t); wave(3,x,z,t);
  const damp = param(4); dx *= damp; dy *= damp; dz *= damp;
}
@inline function height(x: f64, z: f64, t: f64): f64 {
  displace(x,z,t); let px = x-dx, pz = z-dz;
  displace(px,pz,t); px = x-dx; pz = z-dz;
  displace(px,pz,t); return dy;
}
@inline function field(id: f64, value: f64): void {
  const o = 24576 + count * 40; store<f64>(o,1); store<f64>(o+8,id); store<f64>(o+16,value); store<f64>(o+24,0); store<f64>(o+32,0); count++;
}
// The gentle swell's height difference / 4 stays below 0.1; the pose witness bounds the metric error.
@inline function tilt(value: f64): f64 { const z = value * value; return value * (1 + z * (-1.0/3 + z * (1.0/5 + z * (-1.0/7 + z / 9)))); }
export function on_tick(): void {
  count = 0;
  if (query(410, 4096, 8192) !== 29) unreachable();
  const t = input(0) / 60, x = param(0), y = param(1), z = param(2), heading = param(3);
  const fx = -sine(heading), fz = -sine(heading+PI/2), sx = -fz, sz = fx;
  const fore = height(x+fx*2,z+fz*2,t), aft = height(x-fx*2,z-fz*2,t);
  const star = height(x+sx*2,z+sz*2,t), port = height(x-sx*2,z-sz*2,t), heave = height(x,z,t);
  store<f64>(24576,4); store<f64>(24584,x); store<f64>(24592,y+heave); store<f64>(24600,z); store<f64>(24608,0); count = 1;
  field(1,tilt((fore-aft)/4)); field(2,heading); field(3,tilt((star-port)/4)); field(4,1);
}
`;
const abi = String.raw`// Shared ABI-v0 setup: fixed request, parameter and four-effect buffers.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 4; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
export function reset(): void { count = 0; }
@inline export function input(i: i32): f64 { return load<f64>(16384+i*8); }
@inline export function state(i: i32): f64 { return input(6+i); }
@inline export function param(i: i32): f64 { return load<f64>(8192+i*8); }
@inline export function field(id: f64, value: f64): void { const o = 24576+count*40; store<f64>(o,1); store<f64>(o+8,id); store<f64>(o+16,value); store<f64>(o+24,0); store<f64>(o+32,0); count++; }
`;
const hinge = String.raw`// Mode0 keeps a declared deck enabled; mode1 raises a winched deck after both locks.
import { reset, input, state, param, field } from './abi';
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
export function on_tick(): void {
  reset();
  if (query(410, 4096, 8192) < 1) unreachable();
  if (param(0) === 0) { field(4,1); return; }
  let angle = state(0), raised = state(4), raising = state(5);
  const action = input(2), unlocked = input(4) === 3;
  if (action === 3) { angle = 0; raised = 1; raising = 0; }
  else if ((action === 1 && unlocked) || action === 2) { if (raised === 0) raising = 1; }
  if (raising === 1 && raised === 0) { angle = min(0, angle+input(1)*param(1)); if (angle >= 0) { raised = 1; raising = 0; } }
  field(1,angle); field(4,raised); field(5,raised); field(6,raising);
}
`;

/** Readable fixed guest sources; compiler inputs are independent of any shard or browser. */
export function moverProgram(kind: 'ride' | 'hinge' | 'waves'): { source: string; sources: Readonly<Record<string, string>> } {
  if (kind === 'hinge') return { source: "export {abi_version,init,in_ptr,in_cap,out_ptr,out_cap,out_count} from './commons/abi';\nexport {on_tick} from './commons/bridge';\n", sources: { 'commons/abi.ts': abi, 'commons/bridge.ts': hinge } };
  return { source: kind === 'ride' ? ride : waves, sources: {} };
}
