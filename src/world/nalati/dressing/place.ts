/**
 * Where the Nalati dressing goes — pure, deterministic placement (seeded Rng / Noise2D + the active chunk's terrain
 * functions; nothing here touches the GPU). `planDressing(forest)` returns every instance of every scatter kind,
 * the static props (logs, stumps, driftwood, ovoo cairns, ribbon poles, camp clutter) and the colliders.
 *
 * The rules (docs/design/nalati/look-pass.md lever 6 — "something interesting every few metres"):
 *   · everything keeps out of the POI clearings (`clearings.ts`), off the road beds, out of the river water and the
 *     brook, off the snow (plants) and away from spruce trunks; big things keep out of each other (an occupancy hash)
 *   · boulders + slabs come in clusters (a big one, satellites, stones at the foot) — more on slopes, gully edges,
 *     river banks and round the Crags / SW spur, a few lone erratics on the open plateau
 *   · stones line both verges of every road; pebbles, cobbles and driftwood lie on the river's gravel bars
 *   · junipers on the rocky slopes, wild rose on the valley meadows and road verges, dwarf willow on the banks
 *   · flower drifts where the grass field's own flower patches are (`flowerPatchAt`), so the 3D clumps and the grass
 *     carpet's flower dots agree: purple sage / lupin drifts, white edelweiss + yellow buttercup drifts
 *   · reeds in the shallow margins of the Kunes and along the brook
 *   · fallen logs + stumps round the spruce, ovoo cairns and ribbon poles at the viewpoints, loose clutter at the camps
 *   · each instance carries its own draw distance: small things go early, and inside a drift the outer clumps go
 *     before the heart, so a drift shrinks to its core with distance instead of vanishing at a ring
 */
import { Rng } from '../../../core/rng';
import { Noise2D, smoothstep, clamp, lerp } from '../../../core/noise';
import { heightAt, normalAt, trailDistance, inChunk, TRAILS } from '../../Heightfield';
import { grassBaseHeightAt, grassToneAt, flowerPatchAt } from '../../GrassField';
import { RIVER, riverMask, BROOK, CRAGS, WEST_CRAGS, SNOW_LINE, KURGANS, CAMP, SUMMER_YURTS, SKY_ROAD, CAMP_SPUR, zoneAt, snowValleyX, snowValleyHalf, glacierMask } from '../../../chunks/nalati-grasslands';
import { inPoiClearing } from '../clearings';
import type { Forest } from '../../Forest';
import type { Collider } from '../../../player/Player';
import type { Inst } from './layer';

const SEED = 0x4a1a ^ 0xd7e5;

export interface LogSpec { ax: number; az: number; bx: number; bz: number; r: number; drift: boolean }
export interface Spot { x: number; z: number; s: number }

export interface DressPlan {
  boulder: Inst[]; slab: Inst[]; stone: Inst[];
  juniper: Inst[]; rose: Inst[]; willow: Inst[];
  lupin: Inst[]; daisy: Inst[]; reed: Inst[];
  logs: LogSpec[]; stumps: Spot[];
  ovoos: Spot[]; poles: Spot[];
  /** split-rail guard fences on the downhill verge of the sky road's legs, and the timber gateway where it tops out */
  fences: [number, number][][]; gates: { x: number; z: number; yaw: number }[];
  /** flower-drift hearts (butterflies hang round them) */
  drifts: { x: number; y: number; z: number; r: number }[];
  colliders: Collider[];
}

// ── terrain queries ─────────────────────────────────────────────────────────────────────────────────

function segD(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? clamp(((px - ax) * vx + (pz - az) * vz) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}
/** metres to the meltwater stream's centreline (Snow Lotus Valley; `BROOK`) */
export function brookDistance(x: number, z: number): number {
  if (z > -80 || z < -256 || x < -70 || x > 25) return Infinity;
  let best = Infinity;
  for (let i = 0; i + 1 < BROOK.length; i++) {
    const a = BROOK[i], b = BROOK[i + 1];
    if (a && b) best = Math.min(best, segD(x, z, a[0], a[1], b[0], b[1]));
  }
  return best;
}
const slopeAt = (x: number, z: number): number => 1 - normalAt(x, z, 0.8)[1];
/** in the river's water (or so close to it that the waterline would cut the model) */
function wet(x: number, z: number, h: number, pad = 0.15): boolean { return riverMask(x, z) > 0.2 && h < RIVER.level + pad; }
function onKurgan(x: number, z: number, pad = 0): boolean {
  for (const k of KURGANS) { const dx = x - k.x, dz = z - k.z, r = k.r + pad; if (dx * dx + dz * dz < r * r) return true; }
  return false;
}

/** the common keep-out: slab edge, POIs, road beds, water, brook bed */
function blocked(x: number, z: number, h: number, o: { road?: number; poi?: number; brook?: number; edge?: number } = {}): boolean {
  if (!inChunk(x, z, o.edge ?? 3)) return true;
  if (inPoiClearing(x, z, o.poi ?? 2)) return true;
  if (trailDistance(x, z) < (o.road ?? 3.6)) return true;
  if (wet(x, z, h)) return true;
  if (brookDistance(x, z) < (o.brook ?? 2.6)) return true;
  return false;
}

/** a coarse occupancy hash of discs: big things (boulders, shrubs, logs) don't intersect */
class Occupancy {
  private cells = new Map<number, number[]>();
  private key(ix: number, iz: number): number { return (ix + 200) * 1000 + (iz + 200); }
  free(x: number, z: number, r: number): boolean {
    const ix = Math.floor(x / 4), iz = Math.floor(z / 4);
    for (let a = ix - 2; a <= ix + 2; a++) for (let b = iz - 2; b <= iz + 2; b++) {
      const list = this.cells.get(this.key(a, b));
      if (!list) continue;
      for (let i = 0; i + 2 < list.length; i += 3) { const dx = x - (list[i] ?? 0), dz = z - (list[i + 1] ?? 0), rr = r + (list[i + 2] ?? 0); if (dx * dx + dz * dz < rr * rr) return false; }
    }
    return true;
  }
  add(x: number, z: number, r: number): void {
    const k = this.key(Math.floor(x / 4), Math.floor(z / 4));
    let list = this.cells.get(k); if (!list) this.cells.set(k, (list = []));
    list.push(x, z, r);
  }
}

/** lean an instance into the slope (a fraction of the normal), in the instance's own yawed frame (Euler YXZ) */
function lean(inst: Inst, x: number, z: number, amount: number): void {
  const [nx, ny, nz] = normalAt(x, z, 1.2);
  const c = Math.cos(inst.yaw), s = Math.sin(inst.yaw);
  const lx = nx * c - nz * s, lz = nx * s + nz * c;
  inst.tiltX = Math.atan2(lz, ny) * amount;
  inst.tiltZ = -Math.asin(clamp(lx, -1, 1)) * amount;
}

const col = (c: [number, number, number]): { r: number; g: number; b: number } => ({ r: c[0], g: c[1], b: c[2] });
const grey = (rng: Rng, lo: number, hi: number): [number, number, number] => { const k = rng.range(lo, hi); return [k, k, k]; };

// ── the plan ────────────────────────────────────────────────────────────────────────────────────────

/** the whole plan, one pass after another; `yieldTask` (e.g. boot's `macrotask`) runs between passes so a slow phone
 *  never sees one long task */
export async function planDressing(forest: Forest | null, yieldTask: () => Promise<void> = () => Promise.resolve()): Promise<DressPlan> {
  const plan: DressPlan = { boulder: [], slab: [], stone: [], juniper: [], rose: [], willow: [], lupin: [], daisy: [], reed: [], logs: [], stumps: [], ovoos: [], poles: [], fences: [], gates: [], drifts: [], colliders: [] };
  const occ = new Occupancy();
  // (forest.nearby() is a generous broad phase — it pads by the trunk radius + 3 m — so test the real distance)
  const nearTree = (x: number, z: number, r: number): boolean => (forest ? forest.nearby(x, z, r).some((t) => Math.hypot(t.x - x, t.z - z) < r + t.r) : false);

  campAndBanks(plan, occ, nearTree);
  rocks(plan, occ, nearTree); await yieldTask();
  scree(plan, occ); await yieldTask();
  roadStones(plan);
  gravelBars(plan); await yieldTask();
  shrubs(plan, occ, nearTree); await yieldTask();
  flowers(plan, occ, nearTree); await yieldTask();
  reeds(plan);
  woods(plan, occ, forest);
  landmarks(plan, occ);
  roadFences(plan);
  return plan;
}

// ── the camp's edges and the river banks by it (round-4 camp 9-angle, gap #10) ────────────────────────

/**
 * Mossy boulders with shrubs round them along both banks of the Kunes from the bridge to past the camp (the FP-left
 * and god views look straight down this reach), and a loose ring of rocks + rose / juniper clumps round the camp just
 * outside its clearing — the mockups frame the yard with them. Runs first, so the general passes fill in round it.
 */
function campAndBanks(plan: DressPlan, occ: Occupancy, nearTree: (x: number, z: number, r: number) => boolean): void {
  const rng = new Rng(SEED + 5);
  const mossy = (): { r: number; g: number; b: number } => { const k = rng.range(0.86, 1.05); return { r: k * 0.94, g: k, b: k * 0.86 }; };
  const rock = (x: number, z: number, r: number): boolean => {
    const h = heightAt(x, z);
    if (blocked(x, z, h, { road: 3.4 + r, poi: 1 + r }) || h < RIVER.level + 0.25 || nearTree(x, z, r + 0.4) || !occ.free(x, z, r)) return false;
    occ.add(x, z, r);
    const into = rng.next() < 0.75 ? plan.boulder : plan.slab;
    addRock(plan, rng, into, x, z, h, r, into === plan.slab);
    const last = into[into.length - 1];
    if (last) Object.assign(last, mossy());
    return true;
  };
  const shrub = (x: number, z: number, kind: 'willow' | 'rose' | 'juniper', size: number): void => {
    const h = heightAt(x, z), foot = size * (kind === 'juniper' ? 0.95 : 0.6);
    if (blocked(x, z, h, { road: 3.8 + foot * 0.5, poi: 1 + foot }) || h < RIVER.level + 0.3 || nearTree(x, z, foot) || !occ.free(x, z, foot)) return;
    occ.add(x, z, foot * 0.8);
    const tone = rng.range(0.9, 1.08);
    const inst: Inst = { x, y: h - 0.08 * size, z, yaw: rng.range(0, Math.PI * 2), sx: size * rng.range(0.9, 1.15), sy: size * rng.range(0.85, 1.1), sz: size * rng.range(0.9, 1.15), far: 170 + size * 50, r: tone, g: tone, b: tone };
    lean(inst, x, z, 0.35);
    plan[kind].push(inst);
  };
  // the banks: a group every ~9 m, on the grass lip just above the gravel, a boulder or two + shrubs tucked against them
  for (let x = -40; x < 200; x += rng.range(6, 12)) {
    if (Math.abs(x) < 16) continue; // the bridge ramps
    for (const side of [1, -1]) {
      if (rng.next() < 0.3) continue;
      const off = RIVER.half(x) + rng.range(0.5, 6);
      const cx = x + rng.range(-2, 2), cz = RIVER.z(cx) + side * off;
      const big = 0.55 + rng.next() ** 1.8 * 1.1;
      const placed = rock(cx, cz, big);
      if (placed && rng.next() < 0.6) { const a = rng.range(0, Math.PI * 2); rock(cx + Math.cos(a) * big * 1.7, cz + Math.sin(a) * big * 1.7, big * rng.range(0.35, 0.6)); }
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const a = rng.range(0, Math.PI * 2), d = big + rng.range(0.8, 2.5);
        shrub(cx + Math.cos(a) * d, cz + Math.sin(a) * d, rng.next() < 0.6 ? 'willow' : rng.next() < 0.5 ? 'rose' : 'juniper', rng.range(0.8, 1.4));
      }
    }
  }
  // the camp's edges: rocks + rose / juniper clumps in a loose ring 31–46 m out (the slab's north lip at z 245 bounds it)
  for (let i = 0, got = 0; i < 400 && got < 30; i++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(31, 46);
    const x = CAMP.x + Math.cos(a) * d, z = CAMP.z + Math.sin(a) * d;
    if (z > 243 || Math.hypot(x - (CAMP.x + 27), z - (CAMP.z + 9)) < 14) continue;
    if (rng.next() < 0.45) { if (rock(x, z, 0.45 + rng.next() ** 2 * 0.9)) got++; }
    else { shrub(x, z, rng.next() < 0.65 ? 'rose' : 'juniper', rng.range(0.8, 1.3)); got++; }
  }
}

// ── rocks ───────────────────────────────────────────────────────────────────────────────────────────

function rocks(plan: DressPlan, occ: Occupancy, nearTree: (x: number, z: number, r: number) => boolean): void {
  const rng = new Rng(SEED + 11), clump = new Noise2D(SEED + 12);
  const N = 60000;
  for (let i = 0; i < N; i++) {
    const x = rng.range(-247, 247), z = rng.range(-247, 247);
    // cheap first: the clumping field and a coin (≤ 1 in 3 candidates reaches the terrain queries)
    const cl = 0.2 + 1.4 * smoothstep(-0.25, 0.55, clump.fbm(x * 0.012, z * 0.012, 2));
    const coin = rng.next();
    if (coin > cl * 0.3) continue;
    const h = heightAt(x, z), s = slopeAt(x, z);
    // where rocks gather: slopes and gully walls, the river banks, the massifs' feet; erratics everywhere
    const rm = riverMask(x, z);
    const edge = Math.abs(z - RIVER.z(x)) - RIVER.half(x);
    const bank = rm < 0.6 && edge > -2 && edge < 10 ? 0.45 : 0;
    const dCr = Math.hypot(x - CRAGS.x, z - CRAGS.z), dSw = Math.hypot(x - WEST_CRAGS.x, z - WEST_CRAGS.z);
    const massif = smoothstep(170, 90, dCr) * 0.7 + smoothstep(130, 70, dSw) * 0.6 + zoneAt(x, z)[2] * 0.45;
    if (glacierMask(x, z) > 0.2) continue;
    // off the snow ring the green slopes stay mostly turf: a rock on every slope read as brown lumps pasted over the
    // escarpment from the valley (the final look round); the ring's feet and the banks keep theirs
    const ringZ = zoneAt(x, z)[2];
    const p = Math.min(1, 0.1 * (0.5 + 0.5 * ringZ) + smoothstep(0.06, 0.3, s) * (0.2 + 0.35 * ringZ) + bank + massif);
    if (coin > cl * 0.3 * p) continue;
    if (s > 0.6) continue; // a boulder glued to a cliff face reads as floating
    if (s > 0.17 && ringZ > 0.5) continue; // the snow ring's faces carry their own rock (src/nalati/cragRock.ts): boulders only at their feet
    const big = 0.4 + rng.next() ** 2.2 * (s > 0.2 || massif > 0.3 ? 2.1 : 1.5);
    if (blocked(x, z, h, { road: 4.5 + big, poi: 3 + big, brook: 3 + big })) continue;
    if (onKurgan(x, z, 2)) continue;
    if (nearTree(x, z, big + 0.6)) continue;
    if (!occ.free(x, z, big * 1.05)) continue;
    occ.add(x, z, big * 1.05);
    const useSlab = s > 0.22 || (massif > 0.25 && rng.next() < 0.5) || rng.next() < 0.15;
    addRock(plan, rng, useSlab ? plan.slab : plan.boulder, x, z, h, big, useSlab);
    // satellites, then fieldstones at the foot
    const sats = rng.int(1, 4);
    for (let k = 0; k < sats; k++) {
      const a = rng.range(0, Math.PI * 2), d = big * rng.range(1.15, 2.1), r = big * rng.range(0.25, 0.55);
      const sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d, sh = heightAt(sx, sz);
      if (r < 0.3 || blocked(sx, sz, sh, { road: 3.5 + r, poi: 2 + r })) continue;
      if (nearTree(sx, sz, r + 0.4) || !occ.free(sx, sz, r)) continue;
      occ.add(sx, sz, r);
      addRock(plan, rng, rng.next() < 0.7 ? plan.boulder : plan.slab, sx, sz, sh, r, false);
    }
    const stones = rng.int(2, 7);
    for (let k = 0; k < stones; k++) {
      const a = rng.range(0, Math.PI * 2), d = big * rng.range(1.0, 2.6);
      const sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d, sh = heightAt(sx, sz);
      if (blocked(sx, sz, sh, { road: 3, poi: 1 })) continue;
      addStone(plan, rng, sx, sz, sh, rng.range(0.1, 0.32), rng.range(55, 95), grey(rng, 0.85, 1.1));
    }
  }
}

function addRock(plan: DressPlan, rng: Rng, into: Inst[], x: number, z: number, h: number, r: number, slab: boolean): void {
  const sy = r * rng.range(0.9, 1.3), sx = r * rng.range(0.85, 1.2), sz = r * rng.range(0.85, 1.2);
  // bury the bottom a quarter so it sits in the ground, deeper on a slope (the downhill side must not float)
  const s = slopeAt(x, z);
  const inst: Inst = { x, y: h - sy * (0.12 + s * 0.5), z, yaw: rng.range(0, Math.PI * 2), sx, sy, sz, far: 90 + r * 110, ...col(grey(rng, 0.86, 1.12)) };
  lean(inst, x, z, slab ? 0.8 : 0.45);
  into.push(inst);
  if (r > 0.75) {
    const ext = slab ? 1.3 : 0.85;
    plan.colliders.push({ x, z, hw: sx * ext * 0.8, hd: sz * 0.8, rot: -inst.yaw, yBottom: h - 2, yTop: h + sy * 0.55 });
  }
}

function addStone(plan: DressPlan, rng: Rng, x: number, z: number, h: number, r: number, far: number, c: [number, number, number]): void {
  const sy = r * rng.range(0.6, 1.0);
  const inst: Inst = { x, y: h - sy * 0.25, z, yaw: rng.range(0, Math.PI * 2), sx: r * rng.range(0.85, 1.3), sy, sz: r * rng.range(0.8, 1.2), far: far * (0.6 + r * 1.4), ...col(c) };
  lean(inst, x, z, 0.6);
  plan.stone.push(inst);
}


// ── scree: Snow Lotus Valley's floor and fans (layout v2) ─────────────────────────────────────────────

/** grey stones strewn thick over the snow valley's floor and the fans at the foot of its walls, boulders among them */
function scree(plan: DressPlan, occ: Occupancy): void {
  const rng = new Rng(SEED + 17), fan = new Noise2D(SEED + 18);
  for (let i = 0; i < 26000; i++) {
    const z = rng.range(-247, -58), xv = snowValleyX(z), hw = snowValleyHalf(z) + 34;
    const x = xv + rng.range(-hw, hw);
    // fans: denser toward the walls (where the scree runs out) and in noise lobes
    const edge = Math.abs(x - xv) / hw, f = smoothstep(-0.2, 0.5, fan.fbm(x * 0.03, z * 0.03, 2));
    if (rng.next() > 0.25 + edge * 0.45 + f * 0.3) continue;
    const h = heightAt(x, z);
    if (h > SNOW_LINE + 4 || blocked(x, z, h, { road: 3.2, poi: 1, brook: 1.6 }) || glacierMask(x, z) > 0.1) continue;
    if (slopeAt(x, z) > 0.17) continue; // not on the walls (a stone on a 40° face reads pasted on): the floor and the fans
    const big = rng.next() < 0.04 + edge * 0.05;
    if (big) {
      const r = 0.5 + rng.next() ** 2 * 1.4;
      if (!occ.free(x, z, r)) continue;
      occ.add(x, z, r);
      addRock(plan, rng, rng.next() < 0.5 ? plan.slab : plan.boulder, x, z, h, r, false);
    } else addStone(plan, rng, x, z, h, rng.range(0.08, 0.34), rng.range(45, 85), grey(rng, 0.9, 1.15));
  }
}

// ── stones along the roads ──────────────────────────────────────────────────────────────────────────

function roadStones(plan: DressPlan): void {
  const rng = new Rng(SEED + 21);
  for (const trail of TRAILS) {
    for (let i = 0; i + 1 < trail.length; i++) {
      const a = trail[i], b = trail[i + 1];
      if (!a || !b) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      for (let d = rng.range(0, 2); d < len; d += rng.range(1.3, 3.2)) {
        const cx = a[0] + ux * d, cz = a[1] + uz * d;
        for (const side of [-1, 1]) {
          if (rng.next() > 0.62) continue;
          const off = rng.range(2.1, 3.6);
          const x = cx - uz * off * side, z = cz + ux * off * side, h = heightAt(x, z);
          if (!inChunk(x, z, 1) || inPoiClearing(x, z, -4) || wet(x, z, h, 0.6)) continue;
          // a hairpin's inner verge can be another leg's road bed
          if (trailDistance(x, z) < 1.9) continue;
          const big = rng.next() < 0.15;
          addStone(plan, rng, x, z, h, big ? rng.range(0.4, 0.62) : rng.range(0.16, 0.38), big ? 130 : 90, grey(rng, 0.88, 1.12));
          if (rng.next() < 0.3) {
            const x2 = x + rng.range(-0.6, 0.6), z2 = z + rng.range(-0.6, 0.6);
            addStone(plan, rng, x2, z2, heightAt(x2, z2), rng.range(0.08, 0.16), 60, grey(rng, 0.85, 1.1));
          }
        }
        // pebbles in the ruts
        if (rng.next() < 0.28) {
          const off = rng.range(-1.8, 1.8), x = cx - uz * off, z = cz + ux * off, h = heightAt(x, z);
          if (!wet(x, z, h, 0.6) && !inPoiClearing(x, z, -6)) addStone(plan, rng, x, z, h, rng.range(0.05, 0.11), 45, [1.05, 0.98, 0.9]);
        }
      }
    }
  }
}

// ── the river's gravel bars ─────────────────────────────────────────────────────────────────────────

function gravelBars(plan: DressPlan): void {
  const rng = new Rng(SEED + 31), nz = new Noise2D(SEED + 32);
  const lvl = RIVER.level;
  let drift = 0;
  for (let i = 0; i < 26000; i++) {
    const x = rng.range(-249, 249), zc = RIVER.z(x), half = RIVER.half(x);
    const z = zc + rng.range(-half - 2, half + 2);
    if (riverMask(x, z) < 0.5 || Math.abs(x) < 9) continue;   // not under the bridge
    const h = heightAt(x, z);
    if (h < lvl - 0.08 || h > lvl + 1.6) continue;
    // pebbles gather in bands (the bar heads), thin out on the high bar
    const band = smoothstep(-0.3, 0.5, nz.get(x * 0.08, z * 0.08));
    if (rng.next() > 0.12 + band * 0.55) continue;
    const wetK = smoothstep(lvl + 0.35, lvl - 0.05, h);             // darker, bluer at the waterline
    const cobble = rng.next() < 0.12;
    const r = cobble ? rng.range(0.2, 0.42) : rng.range(0.05, 0.16);
    const tone = rng.range(0.85, 1.2);
    const c: [number, number, number] = [tone * lerp(1.05, 0.62, wetK), tone * lerp(1.02, 0.66, wetK), tone * lerp(0.96, 0.72, wetK)];
    addStone(plan, rng, x, z, h, r, cobble ? 110 : 55, c);
    if (drift < 46 && rng.next() < 0.0035 && h > lvl + 0.25) {
      drift++;
      const a = rng.range(0, Math.PI * 2), L = rng.range(1.2, 3.4);
      plan.logs.push({ ax: x - Math.cos(a) * L / 2, az: z - Math.sin(a) * L / 2, bx: x + Math.cos(a) * L / 2, bz: z + Math.sin(a) * L / 2, r: rng.range(0.05, 0.13), drift: true });
    }
  }
}

// ── shrubs ──────────────────────────────────────────────────────────────────────────────────────────

function shrubs(plan: DressPlan, occ: Occupancy, nearTree: (x: number, z: number, r: number) => boolean): void {
  const rng = new Rng(SEED + 41), nz = new Noise2D(SEED + 42);
  const patch = (x: number, z: number) => smoothstep(-0.25, 0.45, nz.fbm(x * 0.02, z * 0.02, 2));
  const put = (kind: 'willow' | 'juniper' | 'rose', x: number, z: number, h: number, size: number): boolean => {
    const foot = kind === 'juniper' ? size * 0.95 : size * 0.6;
    if (blocked(x, z, h, { road: 4.2 + foot * 0.5, poi: 2 + foot, brook: 2.4 })) return false;
    if (onKurgan(x, z) || nearTree(x, z, foot + 0.3) || !occ.free(x, z, foot)) return false;
    occ.add(x, z, foot * 0.8);
    const tone = rng.range(0.88, 1.1);
    const inst: Inst = { x, y: h - 0.08 * size, z, yaw: rng.range(0, Math.PI * 2), sx: size * rng.range(0.9, 1.15), sy: size * rng.range(0.8, 1.1), sz: size * rng.range(0.9, 1.15), far: 150 + size * 50, r: tone, g: tone, b: tone };
    lean(inst, x, z, 0.35);
    plan[kind].push(inst);
    return true;
  };
  // dwarf willow: thickets along both banks of the Kunes, and the brook
  for (let x = -247; x < 247; x += rng.range(1.5, 4)) {
    for (const side of [-1, 1]) {
      if (rng.next() > 0.25 + patch(x, side * 40) * 0.6) continue;
      const off = RIVER.half(x) + rng.range(-1.5, 12);
      const z = RIVER.z(x) + side * off, h = heightAt(x, z);
      if (h < RIVER.level + 0.35 || Math.abs(x) < 14) continue;
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const x2 = x + rng.range(-1.6, 1.6), z2 = z + rng.range(-1.6, 1.6), h2 = heightAt(x2, z2);
        if (h2 < RIVER.level + 0.35) continue;
        put('willow', x2, z2, h2, rng.range(0.8, 1.7));
      }
    }
  }
  for (let i = 0; i + 1 < BROOK.length; i++) {
    const a = BROOK[i], b = BROOK[i + 1];
    if (!a || !b) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    for (let d = 0; d < len; d += rng.range(3, 8)) {
      const side = rng.next() < 0.5 ? -1 : 1, off = rng.range(3, 6);
      const x = a[0] + ux * d - uz * off * side, z = a[1] + uz * d + ux * off * side;
      if (rng.next() < 0.55) put('willow', x, z, heightAt(x, z), rng.range(0.7, 1.3));
    }
  }
  // juniper on the rocky slopes, the massifs' feet and scattered over the plateau; wild rose on the valley meadows + verges
  for (let i = 0; i < 60000; i++) {
    const x = rng.range(-247, 247), z = rng.range(-247, 247);
    // cheap first: the patch field and a coin (the densest case accepts ≤ 0.12 × 1.65)
    const pk = patch(x, z), coin = rng.next();
    if (coin > (0.15 + pk * 1.5) * 0.2) continue;
    const h = heightAt(x, z);
    if (h > SNOW_LINE - 6 || rng.next() < zoneAt(x, z)[2] * 0.75) continue;
    const s = slopeAt(x, z);
    const dCr = Math.hypot(x - CRAGS.x, z - CRAGS.z), dSw = Math.hypot(x - WEST_CRAGS.x, z - WEST_CRAGS.z);
    const rocky = smoothstep(0.08, 0.3, s) + smoothstep(170, 90, dCr) * 0.7 + smoothstep(130, 70, dSw) * 0.6;
    if (rocky > 0.35 || h > 22) {
      const p = Math.min(1, 0.05 + rocky * 0.35);
      if (coin < (0.15 + pk * 1.5) * 0.12 * p) put('juniper', x, z, h, rng.range(0.7, 1.7));
    } else {
      const td = trailDistance(x, z);
      const verge = smoothstep(10, 5.5, td) * smoothstep(4.2, 5.4, td);
      const p = Math.min(1, (h < -4 ? 0.35 : 0.15) + verge * 1.2);
      if (coin < (0.15 + pk * 1.5) * 0.05 * p) put('rose', x, z, h, rng.range(0.7, 1.25));
    }
  }
}

// ── flowers ─────────────────────────────────────────────────────────────────────────────────────────

function flowers(plan: DressPlan, occ: Occupancy, nearTree: (x: number, z: number, r: number) => boolean): void {
  const rng = new Rng(SEED + 51);
  const okFlower = (x: number, z: number, h: number): boolean =>
    h < SNOW_LINE - 8 && rng.next() > zoneAt(x, z)[2] * 0.8 && !blocked(x, z, h, { road: 2.9, poi: 0.5, brook: 1.8 }) && slopeAt(x, z) < 0.42 && !nearTree(x, z, 0.8) && occ.free(x, z, 0.15);
  const clump = (x: number, z: number, h: number, lupin: boolean, far: number, sz: number): void => {
    // stand above the grass round it (the clumps are the flowers the carpet's dots can't be at 60 m)
    const gh = grassBaseHeightAt(x, z);
    const tall = lupin ? Math.max(1, (gh + 0.2) / 0.62) : Math.max(1, (gh + 0.1) / 0.36);
    const s = sz * rng.range(0.85, 1.2);
    const tone = rng.range(0.9, 1.1);
    const warm = lupin ? rng.range(-0.08, 0.08) : 0;
    const inst: Inst = { x, y: h - 0.02, z, yaw: rng.range(0, Math.PI * 2), sx: s, sy: s * Math.min(tall, 1.9), sz: s, far, r: tone * (1 + warm), g: tone, b: tone * (1 - warm * 0.5) };
    lean(inst, x, z, 0.6);
    (lupin ? plan.lupin : plan.daisy).push(inst);
  };
  // drifts: hearts where the grass field's flower patches peak
  for (let i = 0; i < 9000; i++) {
    const x = rng.range(-245, 245), z = rng.range(-245, 245);
    const fp = flowerPatchAt(x, z);
    if (rng.next() > smoothstep(0.35, 0.85, fp) * 0.5) continue;
    const h = heightAt(x, z);
    if (!okFlower(x, z, h)) continue;
    const tone = grassToneAt(x, z);
    // mostly white edelweiss + yellow buttercup with purple patches (round-4 camp targets: the lupins were too many)
    const lupin = rng.next() < (tone > 0.5 ? 0.3 : 0.2);
    const R = rng.range(2.5, 8), n = Math.round(R * R * rng.range(0.7, 1.2));
    let placed = 0;
    for (let k = 0; k < n; k++) {
      const a = rng.range(0, Math.PI * 2), u = Math.sqrt(rng.next()), d = u * R;
      const cx = x + Math.cos(a) * d * 1.3, cz = z + Math.sin(a) * d * 0.8;
      const ch = heightAt(cx, cz);
      if (!okFlower(cx, cz, ch)) continue;
      // the heart outlives the edges with distance; a few of the other kind mixed in
      const far = lerp(160, 45, u) * rng.range(0.8, 1.1);
      clump(cx, cz, ch, rng.next() < (lupin ? 0.9 : 0.95) ? lupin : !lupin, far, lerp(1.15, 0.85, u));
      placed++;
    }
    if (placed > 4) plan.drifts.push({ x, y: h, z, r: R });
  }
  // sparse singles through the meadows
  for (let i = 0; i < 9000; i++) {
    const x = rng.range(-245, 245), z = rng.range(-245, 245);
    const h = heightAt(x, z);
    if (!okFlower(x, z, h)) continue;
    if (rng.next() > 0.3 + flowerPatchAt(x, z) * 0.4) continue;
    clump(x, z, h, rng.next() < 0.15, rng.range(40, 70), rng.range(0.8, 1.0));
  }
}

// ── reeds ───────────────────────────────────────────────────────────────────────────────────────────

function reeds(plan: DressPlan): void {
  const rng = new Rng(SEED + 61);
  const lvl = RIVER.level;
  const put = (x: number, z: number, h: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const x2 = x + rng.range(-1.4, 1.4), z2 = z + rng.range(-1.4, 1.4), h2 = heightAt(x2, z2);
      if (inPoiClearing(x2, z2, -2) || trailDistance(x2, z2) < 3) continue;
      const s = rng.range(0.75, 1.2), tone = rng.range(0.88, 1.1);
      const inst: Inst = { x: x2, y: Math.min(h2, h) - 0.05, z: z2, yaw: rng.range(0, Math.PI * 2), sx: s, sy: s * rng.range(0.85, 1.2), sz: s, far: 110, r: tone, g: tone, b: tone };
      plan.reed.push(inst);
    }
  };
  // the Kunes' margins: the wet edge just in and out of the water
  for (let i = 0; i < 14000; i++) {
    const x = rng.range(-249, 249), zc = RIVER.z(x), half = RIVER.half(x);
    const z = zc + rng.range(-half - 1, half + 1);
    if (Math.abs(x) < 12 || riverMask(x, z) < 0.3) continue;
    const h = heightAt(x, z);
    if (h < lvl - 0.35 || h > lvl + 0.3) continue;
    if (rng.next() > 0.14) continue;
    put(x, z, h, rng.int(2, 6));
  }
  // the brook
  for (let i = 0; i + 1 < BROOK.length; i++) {
    const a = BROOK[i], b = BROOK[i + 1];
    if (!a || !b) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    for (let d = 0; d < len; d += rng.range(3, 7)) {
      const side = rng.next() < 0.5 ? -1 : 1, off = rng.range(1.4, 2.6);
      const x = a[0] + ux * d - uz * off * side, z = a[1] + uz * d + ux * off * side;
      if (z > -34) continue; // not over the waterfall lip
      put(x, z, heightAt(x, z), rng.int(1, 4));
    }
  }
}

// ── logs + stumps round the spruce ──────────────────────────────────────────────────────────────────

function woods(plan: DressPlan, occ: Occupancy, forest: Forest | null): void {
  if (!forest) return;
  const rng = new Rng(SEED + 71);
  let logs = 0, stumps = 0;
  for (const t of forest.trees) {
    const roll = rng.next();
    if (roll < 0.05 && stumps < 90) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(2.2, 4.5), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d, h = heightAt(x, z);
      if (blocked(x, z, h, { road: 3.8, poi: 2 }) || forest.nearby(x, z, 1).some((q) => Math.hypot(q.x - x, q.z - z) < 1 + q.r) || !occ.free(x, z, 0.6)) continue;
      occ.add(x, z, 0.6); stumps++;
      plan.stumps.push({ x, z, s: rng.range(0.22, 0.4) });
    } else if (roll > 0.955 && logs < 70) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(3, 6), cx = t.x + Math.cos(a) * d, cz = t.z + Math.sin(a) * d;
      const ya = rng.range(0, Math.PI * 2), L = rng.range(3.5, 7.5), r = rng.range(0.16, 0.3);
      const ax = cx - Math.cos(ya) * L / 2, az = cz - Math.sin(ya) * L / 2, bx = cx + Math.cos(ya) * L / 2, bz = cz + Math.sin(ya) * L / 2;
      const ha = heightAt(ax, az), hb = heightAt(bx, bz);
      if (Math.abs(ha - hb) > L * 0.45) continue;
      if (blocked(ax, az, ha, { road: 4 }) || blocked(bx, bz, hb, { road: 4 }) || blocked(cx, cz, heightAt(cx, cz), { road: 4 })) continue;
      if (forest.nearby(cx, cz, L / 2).some((q) => segD(q.x, q.z, ax, az, bx, bz) < q.r + r + 0.2)) continue;
      if (!occ.free(cx, cz, L / 2)) continue;
      occ.add(cx, cz, L * 0.4); logs++;
      plan.logs.push({ ax, az, bx, bz, r, drift: false });
      const hc = heightAt(cx, cz);
      plan.colliders.push({ x: cx, z: cz, hw: r + 0.05, hd: L / 2, rot: -Math.atan2(bx - ax, bz - az), yBottom: hc - 1, yTop: hc + r * 1.6 });
    }
  }
}

// ── ovoo cairns + ribbon poles at the viewpoints ────────────────────────────────────────────────────

/** hand-picked view spots (engine coords, layout v2); each is nudged off the road / POIs if it has to be */
const OVOOS: [number, number][] = [
  [72, 100],      // where the sky road tops out on the north rim, looking back down the valley
  [150, 106],     // the north rim, west
  [-128, 112],    // the north rim above the kurgan field
  [34, -54],      // the bowl's south rim over the head of Snow Lotus Valley
  [104, -58],     // the south rim, west
  [-196, -44],    // the east rim by the watchtower
  [198, -8],      // the W road's crest beyond Eagle Rock
  [2, -128],      // Snow Lotus Valley's floor, the stream beside it
  [-12, -214],    // the valley's mouth above the S gate
];
const POLES: [number, number][] = [[-10, 150], [44, 96], [-40, 14], [112, -66], [-24, -186], [158, 44], [-150, 40]];

function landmarks(plan: DressPlan, occ: Occupancy): void {
  const rng = new Rng(SEED + 81);
  const settle = (x0: number, z0: number, r: number): Spot | null => {
    for (let k = 0; k < 40; k++) {
      const a = rng.range(0, Math.PI * 2), d = k === 0 ? 0 : rng.range(1, 3 + k * 0.4);
      const x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d, h = heightAt(x, z);
      if (blocked(x, z, h, { road: 4 + r, poi: 2 + r }) || slopeAt(x, z) > 0.3 || !occ.free(x, z, r)) continue;
      occ.add(x, z, r);
      return { x, z, s: 1 };
    }
    return null;
  };
  for (const [x, z] of OVOOS) {
    const sp = settle(x, z, 2.2);
    if (!sp) continue;
    sp.s = rng.range(0.8, 1.15);
    plan.ovoos.push(sp);
    const h = heightAt(sp.x, sp.z);
    plan.colliders.push({ x: sp.x, z: sp.z, hw: 1.3 * sp.s, hd: 1.3 * sp.s, rot: 0, yBottom: h - 1, yTop: h + 1.1 * sp.s });
  }
  for (const [x, z] of POLES) { const sp = settle(x, z, 0.6); if (sp) plan.poles.push(sp); }
}

// ── the sky road's guard fences + the gateway on the rim ─────────────────────────────────────────────

function roadFences(plan: DressPlan): void {
  // every leg between two hairpins: a fence 4.6 m off the centreline on the downhill (north) side, stopping short of
  // the turns (a posts-and-rails run that reads as a road built into a hillside)
  for (let i = 1; i + 2 < SKY_ROAD.length; i += 2) {
    const a = SKY_ROAD[i], b = SKY_ROAD[i + 1];
    if (!a || !b) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 20) continue;
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    let nx = -uz, nz = ux;
    if (nz < 0) { nx = -nx; nz = -nz; }
    const run: [number, number][] = [];
    for (let d = 6; d <= len - 6; d += Math.max(4, (len - 12) / 6)) {
      const x = a[0] + ux * d + nx * 4.6, z = a[1] + uz * d + nz * 4.6;
      if (trailDistance(x, z) < 3.8 || inPoiClearing(x, z)) { if (run.length > 1) plan.fences.push(run.splice(0)); else run.length = 0; continue; }
      run.push([x, z]);
    }
    if (run.length > 1) plan.fences.push(run);
  }
  // the gateway where the sky road comes over the rim onto the Sky Grassland
  const a = SKY_ROAD[SKY_ROAD.length - 2], b = SKY_ROAD[SKY_ROAD.length - 1];
  if (a && b) plan.gates.push({ x: a[0] + (b[0] - a[0]) * 0.55, z: a[1] + (b[1] - a[1]) * 0.55, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) });
}

// ── camp clutter spots (loose things round the yurt rings; the POI agent builds the structures) ─────

/** true when (x, z) is within `m` metres of any oriented collider box (the POI set pieces, the outcrops …) */
function nearCollider(x: number, z: number, avoid: readonly Collider[], m: number): boolean {
  for (const c of avoid) {
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz > (c.hw + c.hd + m + 1) ** 2) continue;
    const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
    const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
    if (Math.abs(lx) < c.hw + m && Math.abs(lz) < c.hd + m) return true;
  }
  return false;
}

/** the camp spur's last leg (CAMP_SPUR): the track the camp approach looks along */
const SPUR_A: [number, number] = CAMP_SPUR[1] ?? [40, 204], SPUR_B: [number, number] = [CAMP.x - 14, CAMP.z];

/**
 * Loose-clutter anchors (kind 0 firewood · 1 dung cakes · 2 chopping block · 3 pots · 4 sacks · 5 felts · 6 kumis churn),
 * placed where the camp approach SEES them (round-4 camp 9-angle, gap #8), not behind the yurts:
 *   · the yard's open east mouth (between the yurts at 128° and 268°), 9–16 m out — the FP-front view's middle ground;
 *   · both verges of the spur track between the road and the yard, 3.8–7 m off it (the near field of FP front / back);
 *   · a few behind / between the yurts (the god views), and round the summer camp.
 * Every spot keeps 1 m off the POI agent's colliders (`avoid` = the player's colliders once the POIs are in), clear of the
 * hitching rail + its horses and the corral, and 2.4 m from the next.
 */
export function campClutterSpots(avoid: readonly Collider[] = []): { x: number; z: number; yaw: number; kind: number }[] {
  const rng = new Rng(SEED + 91);
  const out: { x: number; z: number; yaw: number; kind: number }[] = [];
  const corral = { x: CAMP.x + 27, z: CAMP.z + 9, r: 12 };
  const yurts = (cx: number, cz: number, angles: number[], d: number) => angles.map((a) => ({ x: cx + Math.cos((a * Math.PI) / 180) * d, z: cz + Math.sin((a * Math.PI) / 180) * d }));
  const campYurts = yurts(CAMP.x, CAMP.z, [128, 88, 46, 2, -44, -92], 13.8), summerYurts = yurts(SUMMER_YURTS.x, SUMMER_YURTS.z, [70, 175, -60], 9.2);
  const ok = (x: number, z: number, ys: { x: number; z: number }[], trackPad: number): boolean => {
    if (ys.some((y) => Math.hypot(x - y.x, z - y.z) < 4.8)) return false;
    if (Math.hypot(x - corral.x, z - corral.z) < corral.r) return false;
    if (x > CAMP.x - 24.5 && x < CAMP.x - 12 && z > CAMP.z - 4.5 && z < CAMP.z + 10.5) return false; // the hitching rail and its two horses
    if (trailDistance(x, z) < trackPad || wet(x, z, heightAt(x, z)) || nearCollider(x, z, avoid, 1.0)) return false;
    return !out.some((q) => Math.hypot(q.x - x, q.z - z) < 2.4);
  };
  const push = (x: number, z: number, kinds: number[]) => { out.push({ x, z, yaw: rng.range(0, Math.PI * 2), kind: kinds[rng.int(0, kinds.length - 1)] ?? 3 }); };
  // the yard mouth
  for (let i = 0, got = 0; i < 90 && got < 8; i++) {
    const a = rng.range(140, 255) * Math.PI / 180, d = rng.range(9, 16);
    const x = CAMP.x + Math.cos(a) * d, z = CAMP.z + Math.sin(a) * d;
    if (ok(x, z, campYurts, 2.6)) { push(x, z, [0, 2, 3, 4, 5, 6]); got++; }
  }
  // the spur track's verges
  const len = Math.hypot(SPUR_B[0] - SPUR_A[0], SPUR_B[1] - SPUR_A[1]), ux = (SPUR_B[0] - SPUR_A[0]) / len, uz = (SPUR_B[1] - SPUR_A[1]) / len;
  for (let i = 0, got = 0; i < 90 && got < 8; i++) {
    const t = rng.range(0.25, 1.05) * len, side = rng.next() < 0.5 ? -1 : 1, off = rng.range(3.8, 7);
    const x = SPUR_A[0] + ux * t - uz * off * side, z = SPUR_A[1] + uz * t + ux * off * side;
    if (ok(x, z, campYurts, 3.4)) { push(x, z, [0, 1, 3, 4, 6]); got++; }
  }
  // behind / between the yurts, and the summer camp
  const ring = (cx: number, cz: number, d0: number, d1: number, n: number, ys: { x: number; z: number }[]) => {
    for (let i = 0, got = 0; i < n * 10 && got < n; i++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(d0, d1);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (ok(x, z, ys, 3.2)) { push(x, z, [0, 1, 2, 3, 4, 5, 6]); got++; }
    }
  };
  ring(CAMP.x, CAMP.z, 17.5, 24, 7, campYurts);
  ring(SUMMER_YURTS.x, SUMMER_YURTS.z, 12.5, 17, 7, summerYurts);
  return out;
}
