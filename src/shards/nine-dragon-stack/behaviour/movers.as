// G571 / H9: Nine Dragon's movers as a SCRIPT-ABI v2 view module (lane 3): the monorail train, the cable gondola and
// the drones, each a transform position (generators/moversView.ts). Its one binding's current columns: the page clock,
// then constants: the train (x, y, z, speed, loop length), the gondola's cable (x0, x1, y, z) and swing (margin, rise,
// rate, phase), the drone count, then per drone its orbit (x, y, z, radius, rate, phase, bob rate, bob). Each scheduled
// frame writes every mover's local matrix at the page clock: the train loops along x, the gondola swings along its
// sagging cable, each drone circles facing along its orbit and bobs.

const IO: i32 = 1024;
const HEADER: i32 = 128;
const ENTRY: i32 = 24;
const SAMPLE_DIRECTORY: i32 = 15;
const TRANSFORMS: i32 = 17;
const RECORD: i32 = 80;
const DRONE: i32 = 64;

export function ws_abi(): i32 { return 2; }
export function ws_io(): i32 { return IO; }
export function ws_init(lo: i32, hi: i32, fuel: i32): i32 { return fuel; }

function entry(kind: i32): i32 { return IO + HEADER + (kind - 1) * ENTRY; }
function region(kind: i32): i32 { return IO + load<i32>(entry(kind) + 4); }

/** one changed transform position: a yaw about +y then the translation, column-major */
function put(index: i32, x: f64, y: f64, z: f64, yaw: f64): void {
  const at = region(TRANSFORMS) + index * RECORD, c = <f32>Math.cos(yaw), s = <f32>Math.sin(yaw);
  store<i32>(at, 0); store<i32>(at + 4, index); store<i32>(at + 8, 0); store<i32>(at + 12, 1);
  const m = at + 16;
  store<f32>(m, c); store<f32>(m + 4, 0); store<f32>(m + 8, -s); store<f32>(m + 12, 0);
  store<f32>(m + 16, 0); store<f32>(m + 20, 1); store<f32>(m + 24, 0); store<f32>(m + 28, 0);
  store<f32>(m + 32, s); store<f32>(m + 36, 0); store<f32>(m + 40, c); store<f32>(m + 44, 0);
  store<f32>(m + 48, <f32>x); store<f32>(m + 52, <f32>y); store<f32>(m + 56, <f32>z); store<f32>(m + 60, 1);
}

export function ws_view(dt: f64, alpha: f64, fuel: i32): i32 {
  const stamp = region(SAMPLE_DIRECTORY);
  if (load<i32>(stamp + 4) == 0) return fuel;
  const t = load<f64>(IO + load<i32>(stamp + 20)), c = IO + load<i32>(stamp + 20) + 8;
  // the train: along x from its start, wrapping at the loop's length
  const tx = load<f64>(c), ty = load<f64>(c + 8), tz = load<f64>(c + 16), speed = load<f64>(c + 24), length = load<f64>(c + 32);
  const run = t * speed;
  put(0, tx + (run - Math.floor(run / length) * length), ty, tz, 0);
  // the gondola: across the cable and back, rising toward its far anchor
  const x0 = load<f64>(c + 40), x1 = load<f64>(c + 48), cy = load<f64>(c + 56), cz = load<f64>(c + 64);
  const margin = load<f64>(c + 72), rise = load<f64>(c + 80), rate = load<f64>(c + 88), phase = load<f64>(c + 96);
  const gx = x0 + margin + (x1 - x0 - margin * 2) * (0.5 + 0.5 * Math.sin(t * rate + phase));
  put(1, gx, cy + (gx - x0) / (x1 - x0) * rise, cz, 0);
  // the drones: each round its orbit, facing along it, bobbing
  const drones = <i32>load<f64>(c + 104);
  for (let i = 0; i < drones; i++) {
    const d = c + 112 + i * DRONE;
    const ox = load<f64>(d), oy = load<f64>(d + 8), oz = load<f64>(d + 16), r = load<f64>(d + 24);
    const orbit = load<f64>(d + 32), start = load<f64>(d + 40), bobRate = load<f64>(d + 48), bob = load<f64>(d + 56);
    const angle = t * orbit + start;
    put(2 + i, ox + Math.cos(angle) * r, oy + Math.sin(t * bobRate + start) * bob, oz + Math.sin(angle) * r, -angle);
  }
  store<i32>(entry(TRANSFORMS) + 16, 2 + drones); store<i32>(IO + 72, 2 + drones);
  return fuel;
}
