// Nalati zero R6: the Storm Titan's grass fire as a SCRIPT-ABI v2 view module (lane 3), moved out of
// game/boss/arenaFire.ts (ArenaFireView: drawField, flame, puff, update's smoke, scorchCell). It runs at the fight's
// fire slot. Samples (generators/titanFireView.ts): on, clear, wind x / z / speed, the clock, the tier's smoke copies
// and rate, then the field's and the look's constants. Arrays (kind 23): the field's cell modes, their lifetimes, the
// ground under each cell, and this frame's burnt-out cells (a count, then cell indices). Batches (kind 24): the
// flames (heat, front, seed per copy), the smoke (age, glow, seed) and the scorch decals (appended as cells burn out),
// their capacities the last samples (the scorch also capped by its draw's copies).
// The smoke keeps rising after the fire is out; a reset (clear) takes the flames, the smoke and the scorch.

const IO: i32 = 1024;
const HEADER: i32 = 128;
const ENTRY: i32 = 24;
const SAMPLE_DIRECTORY: i32 = 15;
const ARRAYS: i32 = 23;
const BATCHES: i32 = 24;
const SMOKE: i32 = 200;
const SCORCH: i32 = 64;
const PUFF: i32 = 13;

// per smoke puff, 13 f64: x y z vx vy vz age life r0 r1 glow seed on; above the host IO (its 81920 bytes from IO), inside
// the module's three fixed pages (ws_init zeroes it)
const POOL: usize = 1024 + 81920;
let next: i32 = 0;
let scorched: i32 = 0;
let seed: u32 = 0x9e3779b9;

export function ws_abi(): i32 { return 2; }
export function ws_io(): i32 { return IO; }
export function ws_init(lo: i32, hi: i32, fuel: i32): i32 {
  seed = (<u32>lo ^ 0x9e3779b9) | 1; next = 0; scorched = 0;
  for (let i: i32 = 0; i < SMOKE * PUFF; i++) store<f64>(POOL + <usize>(i * 8), 0);
  return fuel;
}

function entry(kind: i32): i32 { return IO + HEADER + (kind - 1) * ENTRY; }
function region(kind: i32): i32 { return IO + load<i32>(entry(kind) + 4); }
/** the module's cosmetic random draw in [0, 1) (mulberry32) */
function random(): f64 {
  seed += 0x6d2b79f5;
  let t: u32 = seed;
  t = (t ^ (t >>> 15)) * (t | 1);
  t ^= t + (t ^ (t >>> 7)) * (t | 61);
  return <f64>((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
}
/** a column-major T * R * S matrix at `at` (f32), R the quaternion (qx, qy, qz, qw) */
function compose(at: i32, px: f64, py: f64, pz: f64, qx: f64, qy: f64, qz: f64, qw: f64, sx: f64, sy: f64, sz: f64): void {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz, xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  store<f32>(at, <f32>((1 - (yy + zz)) * sx)); store<f32>(at + 4, <f32>((xy + wz) * sx)); store<f32>(at + 8, <f32>((xz - wy) * sx)); store<f32>(at + 12, 0);
  store<f32>(at + 16, <f32>((xy - wz) * sy)); store<f32>(at + 20, <f32>((1 - (xx + zz)) * sy)); store<f32>(at + 24, <f32>((yz + wx) * sy)); store<f32>(at + 28, 0);
  store<f32>(at + 32, <f32>((xz + wy) * sz)); store<f32>(at + 36, <f32>((yz - wx) * sz)); store<f32>(at + 40, <f32>((1 - (xx + yy)) * sz)); store<f32>(at + 44, 0);
  store<f32>(at + 48, <f32>px); store<f32>(at + 52, <f32>py); store<f32>(at + 56, <f32>pz); store<f32>(at + 60, 1);
}
/** the ground grid's height at cell (a, b), clamped to the field */
function groundAt(ground: i32, width: i32, depth: i32, a: i32, b: i32): f64 {
  const i = a < 0 ? 0 : a >= width ? width - 1 : a, j = b < 0 ? 0 : b >= depth ? depth - 1 : b;
  return <f64>load<f32>(ground + (j * width + i) * 4);
}
/** a batch record: its header, then `capacity` matrices, then `capacity` attribute items (3 for the flames and the smoke) */
function batch(index: i32, flameCapacity: i32, smokeCapacity: i32): i32 {
  let at = region(BATCHES);
  if (index > 0) at += (4 + flameCapacity * 19) * 4;
  if (index > 1) at += (4 + smokeCapacity * 19) * 4;
  return at;
}

export function ws_view(dt: f64, alpha: f64, fuel: i32): i32 {
  const stamp = region(SAMPLE_DIRECTORY);
  if (load<i32>(stamp + 4) == 0) return fuel;
  const c = IO + load<i32>(stamp + 20);
  const on = load<f64>(c) == 1, clear = load<f64>(c + 8) == 1;
  const windX = load<f64>(c + 16), windZ = load<f64>(c + 24), windSpeed = load<f64>(c + 32), t = load<f64>(c + 40);
  const smokeRate = load<f64>(c + 56);
  const x0 = load<f64>(c + 64), z0 = load<f64>(c + 72), cell = load<f64>(c + 80), width = <i32>load<f64>(c + 88), depth = <i32>load<f64>(c + 96);
  const idle = load<f64>(c + 104), active = load<f64>(c + 112), burn = load<f64>(c + 120), scatter = load<f64>(c + 128), sink = load<f64>(c + 136), size = load<f64>(c + 144);
  const front0 = load<f64>(c + 152), front1 = load<f64>(c + 160), heat0 = load<f64>(c + 168), heat1 = load<f64>(c + 176), flameWidth = load<f64>(c + 184);
  const life0 = load<f64>(c + 192), life1 = load<f64>(c + 200), rise0 = load<f64>(c + 208), rise1 = load<f64>(c + 216);
  const radius0 = load<f64>(c + 224), radius1 = load<f64>(c + 232), expansion0 = load<f64>(c + 240), expansion1 = load<f64>(c + 248);
  const jitter = load<f64>(c + 256), lift = load<f64>(c + 264), scale0 = load<f64>(c + 272), scale1 = load<f64>(c + 280);
  const flameCapacity = <i32>load<f64>(c + 288), smokeCapacity = <i32>load<f64>(c + 296), scorchCap = <i32>load<f64>(c + 304);
  const smokeCap = <i32>Math.min(Math.min(<f64>SMOKE, load<f64>(c + 48)), <f64>smokeCapacity);
  const cells = width * depth, modes = region(ARRAYS), lifetimes = modes + cells * 4, ground = lifetimes + cells * 4, events = ground + cells * 4;
  const flames = batch(0, flameCapacity, smokeCapacity), smoke = batch(1, flameCapacity, smokeCapacity), scorch = batch(2, flameCapacity, smokeCapacity);
  if (clear) {
    for (let i: i32 = 0; i < SMOKE; i++) store<f64>(POOL + <usize>((i * PUFF + 12) * 8), 0);
    scorched = 0; store<u32>(scorch, 0);
  }
  // the smoke: it rises, slows, and the wind takes it (rolling downwind as a column)
  let n: i32 = 0;
  for (let i: i32 = 0; i < smokeCap; i++) {
    const p = POOL + <usize>(i * PUFF * 8);
    if (load<f64>(p + 96) == 0) continue;
    const age = load<f64>(p + 48) + dt / load<f64>(p + 56);
    if (age >= 1) { store<f64>(p + 96, 0); continue; }
    store<f64>(p + 48, age);
    const vy = load<f64>(p + 32) * (1 - dt * 0.25); store<f64>(p + 32, vy);
    const x = load<f64>(p) + (load<f64>(p + 24) + windX * windSpeed * 0.55 * age) * dt, z = load<f64>(p + 16) + (load<f64>(p + 40) + windZ * windSpeed * 0.55 * age) * dt, y = load<f64>(p + 8) + vy * dt;
    store<f64>(p, x); store<f64>(p + 8, y); store<f64>(p + 16, z);
    const r = load<f64>(p + 64) + (load<f64>(p + 72) - load<f64>(p + 64)) * Math.sqrt(age), half = (load<f64>(p + 88) * 6.28 + t * 0.2) / 2;
    compose(smoke + 16 + n * 64, x, y, z, 0, Math.sin(half), 0, Math.cos(half), r, r * 0.85, r);
    const item = smoke + 16 + smokeCapacity * 64 + n * 12;
    store<f32>(item, <f32>age); store<f32>(item + 4, <f32>load<f64>(p + 80)); store<f32>(item + 8, <f32>load<f64>(p + 88));
    n++;
  }
  store<u32>(smoke, n); store<u32>(smoke + 4, 0); store<u32>(smoke + 8, n);
  // the flames: each burning cell rises, roars and sinks to embers, the downwind front tallest, smoke rolling off
  let f: i32 = 0;
  if (on) {
    for (let cellIndex: i32 = 0; cellIndex < cells; cellIndex++) {
      if (<f64>load<f32>(modes + cellIndex * 4) != active) continue;
      const left = <f64>load<f32>(lifetimes + cellIndex * 4);
      const x = x0 + (<f64>(cellIndex % width) + 0.5) * cell, z = z0 + (Math.floor(<f64>cellIndex / <f64>width) + 0.5) * cell;
      const y = <f64>load<f32>(ground + cellIndex * 4) - sink;
      const heat = Math.min(1, (burn - left) / 0.9) * Math.min(1, left / 2.2);
      const i = <i32>Math.floor((x + windX * cell - x0) / cell), j = <i32>Math.floor((z + windZ * cell - z0) / cell);
      const downwind = i < 0 || j < 0 || i >= width || j >= depth ? -1 : j * width + i;
      const front: f64 = downwind >= 0 && <f64>load<f32>(modes + downwind * 4) == idle ? 1 : 0;
      if (f < flameCapacity) {
        const k = size * (front0 + front1 * front) * (heat0 + heat1 * heat), half = <f64>cellIndex * 0.7 / 2;
        compose(flames + 16 + f * 64, x + Math.sin(<f64>cellIndex * 3.1) * scatter, y, z + Math.cos(<f64>cellIndex * 2.3) * scatter, 0, Math.sin(half), 0, Math.cos(half), k * flameWidth, k, k * flameWidth);
        const item = flames + 16 + flameCapacity * 64 + f * 12, fraction = <f64>cellIndex * 0.618;
        store<f32>(item, <f32>heat); store<f32>(item + 4, <f32>front); store<f32>(item + 8, <f32>(fraction - Math.floor(fraction)));
        f++;
      }
      if (smokeCap > 0 && random() < dt * smokeRate * (0.4 + heat)) {
        const p = POOL + <usize>(next * PUFF * 8);
        next = (next + 1) % smokeCap;
        store<f64>(p, x + (random() - 0.5) * 2); store<f64>(p + 8, y + 1.2); store<f64>(p + 16, z + (random() - 0.5) * 2);
        store<f64>(p + 24, (random() - 0.5) * 0.6); store<f64>(p + 40, (random() - 0.5) * 0.6); store<f64>(p + 32, rise0 + random() * rise1);
        store<f64>(p + 48, 0); store<f64>(p + 56, life0 + random() * life1); store<f64>(p + 64, radius0 + random() * radius1);
        store<f64>(p + 72, (expansion0 + random() * expansion1) * (0.7 + 0.4 * heat)); store<f64>(p + 80, heat); store<f64>(p + 88, random()); store<f64>(p + 96, 1);
      }
    }
  }
  store<u32>(flames, f); store<u32>(flames + 4, 0); store<u32>(flames + 8, f);
  // this frame's burnt-out cells: a scorch decal each, lying on the slope (the ground grid's) and turned at random
  const burnt = <i32>Math.min(<f64>SCORCH, <f64>load<f32>(events));
  let written: i32 = 0;
  const first = scorched;
  const scorchLimit = <i32>Math.min(<f64>cells, <f64>scorchCap);
  for (let e: i32 = 0; e < burnt && scorched < scorchLimit; e++) {
    const index = <i32>load<f32>(events + 4 + e * 4);
    if (index < 0 || index >= cells) continue;
    const i = index % width, j = index / width;
    const x = x0 + (<f64>i + 0.5) * cell + (random() - 0.5) * jitter, z = z0 + (<f64>j + 0.5) * cell + (random() - 0.5) * jitter;
    const dx = (groundAt(ground, width, depth, i + 1, j) - groundAt(ground, width, depth, i - 1, j)) / (2 * cell);
    const dz = (groundAt(ground, width, depth, i, j + 1) - groundAt(ground, width, depth, i, j - 1)) / (2 * cell);
    const length = Math.sqrt(dx * dx + 1 + dz * dz), nx = -dx / length, ny = 1 / length, nz = -dz / length;
    // the tilt that turns up onto the normal, then a turn about up (three's setFromUnitVectors, then multiply)
    let ax = nz, az = -nx, aw = 1 + ny;
    const norm = Math.sqrt(ax * ax + az * az + aw * aw); ax /= norm; az /= norm; aw /= norm;
    const half = random() * 6.28 / 2, s = Math.sin(half), co = Math.cos(half);
    const qx = ax * co - az * s, qy = aw * s, qz = az * co + ax * s, qw = aw * co;
    const y = groundAt(ground, width, depth, i, j) + dx * (x - (x0 + (<f64>i + 0.5) * cell)) + dz * (z - (z0 + (<f64>j + 0.5) * cell)) + lift;
    const wide = scale0 + random() * scale1, deep = scale0 + random() * scale1;
    compose(scorch + 16 + written * 64, x, y, z, qx, qy, qz, qw, wide, 1, deep);
    written++; scorched++;
  }
  store<u32>(scorch, scorched); store<u32>(scorch + 4, first); store<u32>(scorch + 8, written);
  return fuel;
}
