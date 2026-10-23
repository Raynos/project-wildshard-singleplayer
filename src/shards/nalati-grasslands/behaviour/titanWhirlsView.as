// Nalati zero R6: the Storm Titan's whirlwinds' funnels and debris as a SCRIPT-ABI v2 view module (lane 3), moved out of
// game/boss/arenaFire.ts (ArenaWhirlsView.update's drawing). It runs at the fight's whirl slot, after each whirlwind's
// ease, visibility gate, law and ground (which stay with the fight: they decide which laws step). Samples
// (generators/titanWhirlsView.ts): the clock, the funnel's sink, spin and breathe, the debris spiral's constants and the
// whirlwind count (up to 8), then per whirlwind its ease k, visible (0 / 1), x, ground y and z. Transforms: each funnel's
// matrix (on the ground less the sink, turning at the spin while it shows, breathing). Batch (kind 24): the visible
// whirlwinds' debris, packed.

const IO: i32 = 1024;
const HEADER: i32 = 128;
const ENTRY: i32 = 24;
const SAMPLE_DIRECTORY: i32 = 15;
const TRANSFORMS: i32 = 17;
const BATCHES: i32 = 24;
const MOST: i32 = 8;

// each whirlwind's funnel turn (f64), advanced while it shows
const SPINS: usize = memory.data(MOST * 8);

export function ws_abi(): i32 { return 2; }
export function ws_io(): i32 { return IO; }
export function ws_init(lo: i32, hi: i32, fuel: i32): i32 { for (let i: i32 = 0; i < MOST; i++) store<f64>(SPINS + <usize>(i * 8), 0); return fuel; }

function entry(kind: i32): i32 { return IO + HEADER + (kind - 1) * ENTRY; }
function region(kind: i32): i32 { return IO + load<i32>(entry(kind) + 4); }
/** a column-major T * R * S matrix at `at` (f32), R the quaternion (qx, qy, qz, qw) */
function compose(at: i32, px: f64, py: f64, pz: f64, qx: f64, qy: f64, qz: f64, qw: f64, sx: f64, sy: f64, sz: f64): void {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz, xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  store<f32>(at, <f32>((1 - (yy + zz)) * sx)); store<f32>(at + 4, <f32>((xy + wz) * sx)); store<f32>(at + 8, <f32>((xz - wy) * sx)); store<f32>(at + 12, 0);
  store<f32>(at + 16, <f32>((xy - wz) * sy)); store<f32>(at + 20, <f32>((1 - (xx + zz)) * sy)); store<f32>(at + 24, <f32>((yz + wx) * sy)); store<f32>(at + 28, 0);
  store<f32>(at + 32, <f32>((xz + wy) * sz)); store<f32>(at + 36, <f32>((yz - wx) * sz)); store<f32>(at + 40, <f32>((1 - (xx + yy)) * sz)); store<f32>(at + 44, 0);
  store<f32>(at + 48, <f32>px); store<f32>(at + 52, <f32>py); store<f32>(at + 56, <f32>pz); store<f32>(at + 60, 1);
}

export function ws_view(dt: f64, alpha: f64, fuel: i32): i32 {
  const stamp = region(SAMPLE_DIRECTORY);
  if (load<i32>(stamp + 4) == 0) return fuel;
  const constants = IO + load<i32>(stamp + 20), whirls = <i32>Math.min(<f64>MOST, load<f64>(constants + 152)), c = constants + 160;
  const t = load<f64>(constants), sink = load<f64>(constants + 8), spin = load<f64>(constants + 16), breathe0 = load<f64>(constants + 24), breathe1 = load<f64>(constants + 32);
  const count = <i32>load<f64>(constants + 40), climb = load<f64>(constants + 48), turn = load<f64>(constants + 56), step = load<f64>(constants + 64);
  const radius0 = load<f64>(constants + 72), radius1 = load<f64>(constants + 80), height = load<f64>(constants + 88);
  const ax = load<f64>(constants + 96), ay = load<f64>(constants + 104), az = load<f64>(constants + 112), roll = load<f64>(constants + 120);
  const scale0 = load<f64>(constants + 128), scale1 = load<f64>(constants + 136), scale2 = <i32>load<f64>(constants + 144);
  const transforms = region(TRANSFORMS), debris = region(BATCHES);
  let n: i32 = 0, changed: i32 = 0;
  for (let i: i32 = 0; i < whirls; i++) {
    const at = c + i * 40, k = load<f64>(at), shown = load<f64>(at + 8) == 1, x = load<f64>(at + 16), y = load<f64>(at + 24), z = load<f64>(at + 32);
    const record = transforms + i * 80;
    store<u32>(record, 0); store<u32>(record + 4, i); store<u32>(record + 8, 0); store<u32>(record + 12, shown ? 1 : 0);
    if (!shown) continue;
    // the funnel: on the ground less the sink, turning at the spin while it shows, breathing
    const angle = load<f64>(SPINS + <usize>(i * 8)) + dt * spin; store<f64>(SPINS + <usize>(i * 8), angle);
    compose(record + 16, x, y - sink, z, 0, Math.sin(angle / 2), 0, Math.cos(angle / 2), k, k * (1 + breathe0 * Math.sin(t * breathe1 + <f64>i)), k);
    changed++;
    // its debris climbing the spiral, each piece rolling about the axis
    for (let piece: i32 = 0; piece < count; piece++) {
      const lifted = (<f64>piece / <f64>count) + t * climb + <f64>i * 0.13, u = lifted - Math.floor(lifted);
      const a = t * turn + <f64>piece * step, r = radius0 + u * radius1, half = (t * roll + <f64>piece) / 2, s = Math.sin(half);
      const size = k * (scale0 + <f64>(piece % scale2) * scale1);
      compose(debris + 16 + n * 64, x + Math.cos(a) * r, y + u * height, z + Math.sin(a) * r, ax * s, ay * s, az * s, Math.cos(half), size, size, size);
      n++;
    }
  }
  store<i32>(entry(TRANSFORMS) + 16, whirls); store<i32>(IO + 72, changed);
  store<u32>(debris, n); store<u32>(debris + 4, 0); store<u32>(debris + 8, n);
  return fuel;
}
