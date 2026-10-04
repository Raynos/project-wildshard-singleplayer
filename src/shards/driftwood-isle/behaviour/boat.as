// ABI-v0: tick, dt, action, self, permissions, parameter count; then data and six pose/state fields.
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
