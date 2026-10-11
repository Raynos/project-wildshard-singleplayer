import { inputs, clock } from "./wildshard-director";
// Native bodies, ballistics and RNG retain their exact owners. This director owns firing pace.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 4; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
function event(type: i32, value: f64 = 0): void {
  const at = 24576 + count * 40;
  store<f64>(at, 3); store<f64>(at + 8, type); store<f64>(at + 16, clock.self);
  store<f64>(at + 24, value); store<f64>(at + 32, 0); count++;
}
export function on_tick(): void {
  count = 0;
  if (inputs.phase < 0 || clock.tick === 0) return;
  // The shot's two native spread draws happen before this separate retry draw.
  if (inputs.phase === 1) { event(9183, 3 + inputs.roll * 1.8); return; }
  event(9181, -clock.dt);
  if (inputs.quiet === 0 && inputs.remaining - clock.dt <= 0
      && inputs.distance < 62 && inputs.distance > 6 && inputs.engaged === 1) event(9182);
}
