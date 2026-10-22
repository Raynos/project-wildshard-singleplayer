// G600 L8: the balbals' crack glow and height and the golden eagle's flight height as a SCRIPT-ABI v2 view module (lane 3),
// moved out of species/balbal.ts and species/eagle.ts. Its one binding's current sample columns (generators/creatureViews.ts):
// the balbal and eagle slot counts, then each pool's block, per slot: present, x, y, z, yaw, alive, the ground under it,
// then its fields (balbal: field, has:rise, rise, attackPhase, seed, scale, has:floorY, floorY; eagle: seed, has:altY,
// altY, altS). Each slot keeps its own death clock, sink and smoothed altitude here, reset when its actor changes (its
// seed) or, for a balbal, while it lives. The channel bank: per balbal slot its crack colour gain and height offset, then
// per eagle slot its height offset.

const IO: i32 = 1024;
const HEADER: i32 = 128;
const ENTRY: i32 = 24;
const SAMPLE_DIRECTORY: i32 = 15;
const CHANNELS: i32 = 18;
const SLOTS: i32 = 64;
const BALBAL: i32 = 15;
const EAGLE: i32 = 11;

// per slot, four f64: a balbal's death clock, time dead and seed; an eagle's smoothed altitude, last seen altS, seed, seen
const BALBALS: usize = memory.data(2048);
const EAGLES: usize = memory.data(2048);
let clock: f64 = 0;

export function ws_abi(): i32 { return 2; }
export function ws_io(): i32 { return IO; }
export function ws_init(lo: i32, hi: i32, fuel: i32): i32 {
  clock = 0;
  for (let i: i32 = 0; i < SLOTS * 4; i++) { store<f64>(BALBALS + <usize>(i * 8), 0); store<f64>(EAGLES + <usize>(i * 8), 0); }
  return fuel;
}

function entry(kind: i32): i32 { return IO + HEADER + (kind - 1) * ENTRY; }
function region(kind: i32): i32 { return IO + load<i32>(entry(kind) + 4); }
function smooth01(x: f64): f64 { if (x <= 0) return 0; if (x >= 1) return 1; return x * x * (3 - 2 * x); }

export function ws_view(dt: f64, alpha: f64, fuel: i32): i32 {
  const stamp = region(SAMPLE_DIRECTORY), out = region(CHANNELS);
  clock += dt;
  let written: i32 = 0;
  if (load<i32>(stamp + 4) != 0) {
    let c = IO + load<i32>(stamp + 20);
    const balbals = <i32>load<f64>(c), eagles = <i32>load<f64>(c + 8);
    c += 16;
    for (let slot: i32 = 0; slot < balbals; slot++) {
      const at = BALBALS + <usize>(slot * 32);
      let glow: f64 = 0, lift: f64 = 0;
      if (load<f64>(c) > 0.5) {
        const alive = load<f64>(c + 40) > 0.5, ground = load<f64>(c + 48), field = load<f64>(c + 56);
        const rise = load<f64>(c + 64) > 0.5 ? load<f64>(c + 72) : 1.0, attack = load<f64>(c + 80), seed = load<f64>(c + 88);
        const scale = load<f64>(c + 96), floored = load<f64>(c + 104) > 0.5, floorY = load<f64>(c + 112);
        if (alive || load<f64>(at + 16) != seed) { store<f64>(at, -1); store<f64>(at + 8, 0); store<f64>(at + 16, seed); }
        if (!alive) {
          const death = load<f64>(at);
          store<f64>(at, death < 0 ? 0 : Math.min(1, death + dt / 0.8)); store<f64>(at + 8, load<f64>(at + 8) + dt);
        }
        const atk: f64 = alive ? attack : -1.0, death = load<f64>(at);
        const wind: f64 = atk >= 0 ? smooth01(atk / 0.52) : 0, flash: f64 = atk >= 0 ? Math.max(0, 1 - Math.abs(atk - 0.55) * 14) : 0;
        const dead: f64 = death >= 0 ? smooth01(death) : 0, rising: f64 = field == 1 ? 1 - rise : 0;
        glow = (0.9 + 0.25 * Math.sin(clock * 2.3 + seed) + 2.6 * wind * wind + 4 * flash + 1.5 * rising * (0.6 + 0.4 * Math.sin(clock * 17))) * (1 - dead * 0.85);
        const sink = Math.max(0, load<f64>(at + 8) - 0.9) * 1.1;
        lift = (field == 1 ? -(1 - smooth01(rise)) * 2.5 * scale : floored ? floorY - ground : 0) - sink;
      }
      store<f64>(out + written * 8, glow); store<f64>(out + written * 8 + 8, lift); written += 2;
      c += BALBAL * 8;
    }
    for (let slot: i32 = 0; slot < eagles; slot++) {
      const at = EAGLES + <usize>(slot * 32);
      let lift: f64 = 0;
      if (load<f64>(c) > 0.5) {
        const ground = load<f64>(c + 48), seed = load<f64>(c + 56), altS = load<f64>(c + 80);
        const alt: f64 = load<f64>(c + 64) > 0.5 ? load<f64>(c + 72) : ground + 20;
        if (load<f64>(at + 24) == 0 || load<f64>(at + 16) != seed) { store<f64>(at, alt); store<f64>(at + 8, altS); store<f64>(at + 16, seed); store<f64>(at + 24, 1); }
        // the brain snapping its smoothed altitude (a wind gust carries the bird) lands here as a jump in altS
        if (altS != load<f64>(at + 8)) { store<f64>(at, altS); store<f64>(at + 8, altS); }
        const smoothed = load<f64>(at) + (alt - load<f64>(at)) * Math.min(1, dt * 6);
        store<f64>(at, smoothed); lift = smoothed - ground;
      } else store<f64>(at + 24, 0);
      store<f64>(out + written * 8, lift); written += 1;
      c += EAGLE * 8;
    }
  }
  store<i32>(entry(CHANNELS) + 16, written); store<i32>(IO + 76, written);
  return fuel;
}
