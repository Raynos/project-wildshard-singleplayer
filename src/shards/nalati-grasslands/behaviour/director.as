import { inputs, clock } from "./wildshard-director";
// The shipping raid clock. Native ports own pack admission, prey, shepherd, RNG and outcomes.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 8; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
@inline function parameter(i: i32): f64 { return load<f64>(8192 + i * 8); }
function event(type: i32, value: f64 = 0): void {
  const o = 24576 + count * 40;
  store<f64>(o, 3); store<f64>(o + 8, type); store<f64>(o + 16, clock.self);
  store<f64>(o + 24, value); store<f64>(o + 32, 0); count++;
}
export function on_tick(): void {
  count = 0;
  if (query(410, 4096, 8192) !== 2) unreachable();
  if (inputs.phase < 0 || clock.tick === 0) return;
  // Synchronous native start feedback shares this tick's quotas, but advances no clock.
  if (inputs.phase === 1) { if (inputs.started === 0) event(9084, parameter(0)); return; }
  if (inputs.raiding === 1) {
    if (inputs.present === 0) { event(9083); return; }
    if (inputs.pending > 0) {
      let pending = inputs.pending - clock.dt;
      if (inputs.tracking === 1) pending = 0;
      event(9085, pending);
      if (inputs.tracking === 0 && pending > 0) return;
    }
    if (inputs.tracking === 1 && inputs.broken === 0) return;
    event(9082, inputs.preyAlive === 0 ? 1 : inputs.broken === 1 || inputs.cracked === 1 ? 2 : 0);
    return;
  }
  const remaining = inputs.delay - clock.dt;
  event(9084, remaining);
  if (remaining <= 0) event(9081);
}
