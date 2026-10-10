// SF36 Nalati's weapon hooks (behaviour/weapons.json). The sabre's mounted pass: base × (1 + speed / divisor) × the pass
// chain (+step per live link, capped), rounded. Parameters: 0 the speed divisor, 1 the chain step, 2 the chain cap.
// Inputs: 2 hook (1 damage), 3 entity, 4 phase (1 pass), 5 weapon (1 the sabre), 6 base, 7 speed, 8 links.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 1; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
@inline function input(i: i32): f64 { return load<f64>(16384+i*8); }
@inline function parameter(i: i32): f64 { return load<f64>(8192+i*8); }
export function on_tick(): void {
  count = 0;
  if (input(2) !== 1 || input(4) !== 1 || input(5) !== 1) return;
  if (query(410,4096,8192) !== 3) unreachable();
  const chain = Math.min(parameter(2), 1 + parameter(1) * input(8));
  const damage = Math.round(input(6) * (1 + input(7) / parameter(0)) * chain);
  store<f64>(24576,3); store<f64>(24584,1); store<f64>(24592,input(3)); store<f64>(24600,damage); store<f64>(24608,0);
  count = 1;
}
