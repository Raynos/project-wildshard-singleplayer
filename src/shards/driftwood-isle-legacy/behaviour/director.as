// Authoritative finale pacing. Presentation and captain combat remain trusted runtime recipes.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 8; }
let count: i32 = 0;
let initialized: bool = false;
let altar: bool = false;
let dead: bool = false;
let reward: f64 = -1;
export function out_count(): i32 { return count; }
@external("env", "query") declare function query(kind: i32, request: i32, response: i32): i32;
@inline function input(i: i32): f64 { return load<f64>(16384+i*8); }
@inline function parameter(i: i32): f64 { return load<f64>(8192+i*8); }
function event(type: i32): void {
  const o = 24576+count*40;
  store<f64>(o,3); store<f64>(o+8,type); store<f64>(o+16,input(3)); store<f64>(o+24,0); store<f64>(o+32,0); count++;
}
export function on_tick(): void {
  count = 0;
  if (query(410,4096,8192) !== 2) unreachable();
  const nowAltar = input(6) === 1, nowDead = input(7) === 1, seen = input(8) === 1;
  if (!initialized) {
    initialized = true; altar = nowAltar; dead = nowDead;
    if (nowAltar && !nowDead) event(9001);
    if (input(0) === 0) return; // Boot restores saved actors without advancing the reward's fixed-step clock.
  } else {
    if (nowAltar && !altar) event(9002);
    if (nowDead && !dead) event(9003);
    altar = nowAltar; dead = nowDead;
  }
  const dx = input(9)-input(11), dz = input(10)-input(12);
  if (reward === -1 && nowDead && !seen && sqrt(dx*dx+dz*dz) < parameter(0)) { reward = 0; event(9004); }
  if (reward >= 0) {
    reward += input(1);
    if (reward > parameter(1)) { reward = -2; event(9005); }
  }
}
