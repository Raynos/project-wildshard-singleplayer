// Author-only action request: the trusted melee row owns contacts, damage and impulses.
let count: i32 = 0;
export function abi_version(): i32 { return 0; }
export function init(_lo: i32, _hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 1; }
export function out_count(): i32 { return count; }
export function on_tick(): void {
  count = 0;
  if (load<f64>(16400) != 3 || load<f64>(16424) != 0) return;
  store<f64>(24576, 3);
  store<f64>(24584, 301);
  store<f64>(24592, load<f64>(16408));
  store<f64>(24600, 3);
  store<f64>(24608, 0);
  count = 1;
}
