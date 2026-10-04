// SF24 night watch and dawn decisions; sky interpolation, lanterns and reward views remain trusted G51 recipes.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 8; }
let count: i32 = 0;
let dawn: f64 = -1;
export function out_count(): i32 { return count; }
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
@inline function input(i: i32): f64 { return load<f64>(16384+i*8); }
@inline function parameter(i: i32): f64 { return load<f64>(8192+i*8); }
function event(type: i32, value: f64 = 0): void {
  const o = 24576+count*40;
  store<f64>(o,3); store<f64>(o+8,type); store<f64>(o+16,input(3)); store<f64>(o+24,value); store<f64>(o+32,0); count++;
}
export function on_tick(): void {
  count = 0;
  if (query(410,4096,8192) !== 6) unreachable();
  let nightRequest = input(6) === 1, dawnRequest = input(7) === 1;
  const incoming = i32(input(32));
  for (let i = 0; i < incoming; i++) {
    const kind = input(33+i*6);
    if (kind === 9181) nightRequest = true;
    else if (kind === 9182) dawnRequest = true;
  }
  if (nightRequest) { event(9161); if (input(10) < 0.5 && input(9) === 1) event(9162, parameter(4)); }
  if (dawnRequest && dawn < 0 && input(8) === 0) { dawn = 0; event(9163); }
  if (input(0) === 0 || dawn < 0) return;
  const was = dawn; dawn += input(1);
  if (was < parameter(0) && dawn >= parameter(0) && input(9) === 1) event(9164, parameter(5));
  if (was < parameter(1) && dawn >= parameter(1)) event(9165);
  if (was < parameter(2) && dawn >= parameter(2)) event(9166);
  if (was < parameter(3) && dawn >= parameter(3)) { event(9167); dawn = -1; }
}
