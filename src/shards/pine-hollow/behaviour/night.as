import { inputs, clock } from "./wildshard-director";

// Pine's night lifecycle decisions. Native placement, actor identities and control remain owner ports.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 8; }
let count: i32 = 0;
let elapsed: f64 = 0;
let accumulated: f64 = 0;
export function out_count(): i32 { return count; }

function event(type: i32, value: f64 = 0): void {
  const offset = 24576 + count * 40;
  store<f64>(offset, 3); store<f64>(offset + 8, type); store<f64>(offset + 16, clock.self);
  store<f64>(offset + 24, value); store<f64>(offset + 32, 0); count++;
}

export function on_tick(): void {
  count = 0;
  if (inputs.phase === 0) { elapsed = clock.dt; return; }
  if (inputs.phase === 1) {
    if (inputs.alive === 0) return;
    if (inputs.flee > 0) {
      const flee = inputs.flee + elapsed;
      event(9201, flee);
      if (flee > 3.5) event(9203);
    } else if (inputs.night < 0.35) event(9202);
  } else if (inputs.phase === 2) {
    if (inputs.alive === 0 || inputs.woke === 1) return;
    event(9204);
    if (inputs.distance < 20 || inputs.hurt === 1) event(9205);
  } else if (inputs.phase === 3) {
    accumulated += elapsed;
    const due = accumulated >= 1;
    if (due) accumulated = 0; // Shipping resets; it does not subtract a second.
    event(9206, accumulated);
    if (due) event(9207);
  } else if (inputs.phase === 4) {
    if (inputs.raceCount > 0) {
      if (inputs.raceDead === 1) event(9208);
    } else if (inputs.errand === 1 && inputs.night > 0.5 && inputs.nearMill === 1) event(9209);
  } else if (inputs.phase === 5) {
    if (inputs.alive === 1 && inputs.flee === 0 && inputs.distance > 230) event(9210);
  } else if (inputs.phase === 6) {
    if (inputs.night > 0.55 && inputs.nearGrowth === 1 && inputs.roamCount < inputs.maximum) event(9211);
  }
}
