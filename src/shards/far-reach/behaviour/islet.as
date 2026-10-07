// SF49-g (G183): the Rising Islet. A kinematic grass islet rests level with the road, rises along its chains to the gate
// isle, rests there and comes back down, on one fixed cycle from the session's tick. Parameters: rest x y z, dock x y z,
// the dwell at each end and the travel one way (seconds), and a phase offset (seconds).
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 2; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
@inline function input(i: i32): f64 { return load<f64>(16384 + i * 8); }
@inline function param(i: i32): f64 { return load<f64>(8192 + i * 8); }
export function on_tick(): void {
  count = 0;
  if (query(410, 4096, 8192) !== 9) unreachable();
  const dwell = param(6), travel = param(7), period = 2 * (dwell + travel);
  let t = input(0) / 60 + param(8);
  t = t - Math.floor(t / period) * period;
  let s: f64 = 0;
  if (t < dwell) s = 0;
  else if (t < dwell + travel) s = (t - dwell) / travel;
  else if (t < 2 * dwell + travel) s = 1;
  else s = 1 - (t - 2 * dwell - travel) / travel;
  s = s * s * (3 - 2 * s);
  store<f64>(24576, 4); store<f64>(24584, param(0) + (param(3) - param(0)) * s); store<f64>(24592, param(1) + (param(4) - param(1)) * s);
  store<f64>(24600, param(2) + (param(5) - param(2)) * s); store<f64>(24608, 0);
  store<f64>(24616, 1); store<f64>(24624, 4); store<f64>(24632, 1); store<f64>(24640, 0); store<f64>(24648, 0);
  count = 2;
}
