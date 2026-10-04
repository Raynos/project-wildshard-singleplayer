// Mode0 keeps a declared deck enabled; mode1 raises a winched deck after both locks.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 4; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
@inline function input(i: i32): f64 { return load<f64>(16384+i*8); }
@inline function state(i: i32): f64 { return input(6+i); }
@inline function param(i: i32): f64 { return load<f64>(8192+i*8); }
@inline function field(id: f64, value: f64): void { const o = 24576+count*40; store<f64>(o,1); store<f64>(o+8,id); store<f64>(o+16,value); store<f64>(o+24,0); store<f64>(o+32,0); count++; }
export function on_tick(): void {
  count = 0;
  if (query(410, 4096, 8192) < 1) unreachable();
  if (param(0) === 0) { field(4,1); return; }
  let angle = state(0), raised = state(4), raising = state(5);
  const action = input(2), unlocked = input(4) === 3;
  if (action === 3) { angle = 0; raised = 1; raising = 0; }
  else if ((action === 1 && unlocked) || action === 2) { if (raised === 0) raising = 1; }
  if (raising === 1 && raised === 0) { angle = min(0, angle+input(1)*param(1)); if (angle >= 0) { raised = 1; raising = 0; } }
  field(1,angle); field(4,raised); field(5,raised); field(6,raising);
}
