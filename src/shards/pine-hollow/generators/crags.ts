/**
 * The Ridge's granite placed and its face skin built (PINE-HOLLOW-REMASTER PH-B2; G285: an offline bake). Build-time only:
 * `src/shards/pine-hollow/generators/bake-pine-crags.mjs` runs `bakePineCrags` over Pine Hollow's baked terrain (the page's own grid), the kit's
 * module footprints (crags.glb + crags-b.glb) and the forest's trunks (the physics bake's `trees`), and writes every
 * placement and each tier's skin tiles to `../data/crags.json` + `public/assets/pine-hollow/baked/crags.<tier>.bin` (zlib);
 * the page draws them (../world/cragBake.ts, ../world/crags.ts) and never runs this. test/shards/pine-hollow/crag-bake.test.ts
 * is the stale gate.
 *
 * `placeCrags` lays the kit over the heightfield: cliff modules on every steep face of the Ridge, the pass and the Den's
 * walls, fronts turned down the slope and sunk into it; tors along the crest; talus below each cliff where the slope eases
 * (boulders and scree fans). `skinTile` re-draws the heightfield's steep faces as stepped granite bands, a tile at a time.
 *
 * E322 F-L2 (Jake picked B; the old crags and their Debug ▸ Look ▸ Crags row went): the face skin's ledges stepped
 * outward (true risers and treads; the old skin folded back on itself); the big modules fused and weathered (crags-b.glb
 * over crags.glb), turned, rolled and sunk more freely, boulders in their joints, the lookout's hero crag.
 */
import type * as THREE from 'three';
import { DEN, LOOKOUT, ZIPLINE, WATERFALL, RIDGE_STREAM, POND, RIDGE, CABIN_SITES, ridgeFootZ, nearestOnPolyline, type XZ } from '../layout';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import type { Tier } from '@wildshard/engine/core/tier';
import { normalAt, trailDistance, cabinMask, inChunk } from '@wildshard/engine/world/Heightfield';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { CRAG_HERO, CRAG_IDS, SKIN_STEPS, SKIN_TILE, caveLocal, skinBytes, type CragId, type CragPlace, type CragSize, type CragSizes } from '../world/cragBake';

/** the placement's own stream (it never read the level seed: the terrain it stands on is the level's) */
export const CRAG_SEED = 0x5ca1ab1e;

/** a skin tile's blocks: world positions, the vertex AO, the triangles */
export interface SkinBlocks { pos: Float32Array; ao: Float32Array; index: Uint16Array }

/**
 * The hero crag: a ~21 m granite tower on the Ridge's crest 80 m east of the fire lookout, the landmark of its east
 * catwalk's view and on the skyline over the face from the Hollow's trails; its front turned toward the tower
 */
export const CRAG_HERO_SPOT = { x: -42, z: 227, sink: 2.5 };
const CLIFFS: readonly CragId[] = ['cliff-a', 'cliff-b', 'cliff-c', 'cliff-a', 'cliff-b', 'cliff-c', 'buttress', 'slab'];
const TORS: readonly CragId[] = ['tor-a', 'tor-b'];
const BOULDERS: readonly CragId[] = ['boulder-a', 'boulder-b', 'boulder-c'];
const SCREES: readonly CragId[] = ['scree-a', 'scree-b'];

// ─────────────────────────────── placement ───────────────────────────────

const ss = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** metres from (x, z) to the segment a–b */
function segDist(x: number, z: number, a: XZ, b: XZ): number { return nearestOnPolyline([a, b], x, z).d; }

/**
 * Where nothing of the kit may stand (a footprint of radius `r` centred at x, z): the trails, the lookout and the zipline
 * under its cable, the waterfall and the stream that feeds it, the pond, the cabins, the Den's floor, the cave's hood,
 * the slab's edge.
 */
function blocked(x: number, z: number, r: number, trailPad: number): boolean {
  if (!inChunk(x, z, 4 + r * 0.5)) return true;
  if (trailDistance(x, z) < r * 0.75 + trailPad) return true;
  if (Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < LOOKOUT.r + 10 + r * 0.6) return true;
  if (z > 120 && segDist(x, z, [ZIPLINE.from.x, ZIPLINE.from.z], [ZIPLINE.to.x, ZIPLINE.to.z]) < 7 + r * 0.6) return true;
  if (segDist(x, z, [WATERFALL.lip.x, WATERFALL.lip.z], [WATERFALL.foot.x, WATERFALL.foot.z]) < 12 + r * 0.6) return true;
  if (nearestOnPolyline(RIDGE_STREAM, x, z).d < 7 + r * 0.6) return true;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 6 + r * 0.5) return true;
  for (const c of CABIN_SITES) if (Math.hypot(x - c.x, z - c.z) < 16 + r * 0.5) return true;
  if (cabinMask(x, z) > 0.05) return true;
  if (Math.hypot(x - DEN.x, z - DEN.z) < DEN.r - 6) return true;
  const [lx, lz] = caveLocal(x, z);
  if (lz > -9 - r && lz < 20 + r && Math.abs(lx) < 10 + r) return true;
  return false;
}

/** the crag country: the Ridge from a little below its foot, the pass, and the Den's walls */
function cragCountry(x: number, z: number): boolean {
  if (z > ridgeFootZ(x) - 12) return true;
  return Math.hypot(x - DEN.x, z - DEN.z) < DEN.r + 40 && (z > DEN.z + 4 || x > DEN.x + 4);
}

/** the terrain's slope angle (radians) at (x, z) and its downhill heading (the yaw whose front faces down the slope) */
function slopeAt(x: number, z: number): { a: number; yaw: number } {
  const [nx, ny, nz] = normalAt(x, z, 1.5);
  return { a: Math.acos(Math.min(1, Math.max(-1, ny))), yaw: Math.atan2(nx, nz) };
}

export interface PlaceOpts {
  sizes: CragSizes;
  /** the forest's trunks: nothing is set on one (the kit steps round them) */
  trees?: readonly { x: number; z: number }[];
  seed?: number;
}

/**
 * The kit over the heightfield. Cliffs on every steep face of the crag country (greedy, steepest first, spaced by their
 * footprints), their fronts down the slope, their base sunk ~1 m below the ground at the front so the back is buried in
 * the slope; tors on the crest; under each cliff a talus fan: boulders and scree where the slope below it eases.
 */
export function placeCrags(o: PlaceOpts): CragPlace[] {
  const rng = new Rng(o.seed ?? CRAG_SEED);
  const out: CragPlace[] = [];
  const trees = o.trees ?? [];
  const treeGrid = new Map<string, { x: number; z: number }[]>();
  for (const t of trees) { const k = `${Math.floor(t.x / 8)},${Math.floor(t.z / 8)}`; const l = treeGrid.get(k) ?? []; l.push(t); treeGrid.set(k, l); }
  const treeNear = (x: number, z: number, r: number): boolean => {
    for (let i = Math.floor((x - r) / 8); i <= Math.floor((x + r) / 8); i++) for (let j = Math.floor((z - r) / 8); j <= Math.floor((z + r) / 8); j++) {
      for (const t of treeGrid.get(`${i},${j}`) ?? []) if ((t.x - x) ** 2 + (t.z - z) ** 2 < r * r) return true;
    }
    return false;
  };
  const size = (id: CragId): CragSize => (id === CRAG_HERO ? o.sizes.hero ?? { hw: 10, hd: 7, h: 24 } : o.sizes[id]);
  const big: { x: number; z: number; r: number }[] = [];
  const clear = (x: number, z: number, r: number, k: number): boolean => big.every((b) => Math.hypot(b.x - x, b.z - z) > (b.r + r) * k);

  // ── the hero crag first (the cliffs keep clear of it) ──
  if (o.sizes.hero) {
    const hs = size(CRAG_HERO), { x, z, sink } = CRAG_HERO_SPOT;
    const [nx, , nz] = normalAt(x, z, 6);
    // its front half-way between down the slope and toward the lookout
    const down = Math.atan2(nx, nz), look = Math.atan2(LOOKOUT.x - x, LOOKOUT.z - z);
    const yaw = down + Math.atan2(Math.sin(look - down), Math.cos(look - down)) * 0.5;
    const scale = 1.0;
    out.push({ id: CRAG_HERO, x, y: heightAt(x, z) - sink, z, yaw, scale, tiltX: -0.08, tiltZ: 0.03 });
    big.push({ x, z, r: Math.hypot(hs.hw, hs.hd) * scale * 0.8 });
  }

  // ── cliffs on the steep faces ──
  const cands: { x: number; z: number; a: number; yaw: number; w: number }[] = [];
  const step = 3.2;
  for (let x = -CHUNK_HALF + 6; x < CHUNK_HALF - 6; x += step) for (let z = 110; z < CHUNK_HALF - 6; z += step) {
    const jx = x + rng.range(-1.2, 1.2), jz = z + rng.range(-1.2, 1.2);
    if (!cragCountry(jx, jz)) continue;
    const s = slopeAt(jx, jz);
    if (s.a < 0.62) continue;                                      // ≥ 35.5°: a face
    cands.push({ x: jx, z: jz, a: s.a, yaw: s.yaw, w: s.a + rng.range(0, 0.35) });
  }
  cands.sort((p, q) => q.w - p.w);
  for (const c of cands) {
    // the plateau behind the crest is rugged, not a cliff: only its steepest knuckles take a module, spaced wider
    const plateau = c.z > ridgeFootZ(c.x) + RIDGE.climb + 4 && Math.hypot(c.x - DEN.x, c.z - DEN.z) > DEN.r + 30;
    if (plateau && (c.a < 0.8 || rng.next() < 0.45)) continue;
    const id = CLIFFS[rng.int(0, CLIFFS.length - 1)] ?? 'cliff-a';
    const sz = size(id);
    const scale = plateau ? rng.range(0.8, 1.2) : rng.range(1.0, 1.9);
    const r = Math.hypot(sz.hw, sz.hd) * scale;
    // turned well off the fall line: at ±0.22 rad, side by side, the modules showed the same face in a row (the blocks)
    const yaw = c.yaw + rng.range(-0.55, 0.55);
    // on a steep face the module leans back with the slope (a little less than it: the columns stand steeper than the
    // ground, the top buried, the foot out) and sits into the face along its normal — a vertical box on a 55° face was
    // buried to the eaves or hung its base over the drop
    const lean = plateau ? 0 : Math.min(0.8, Math.max(0, c.a - 0.32));
    const [nx, ny, nz] = normalAt(c.x, c.z, 2.5);
    const sink = (plateau ? 0.6 : 2.1) * scale;
    const x = c.x - nx * sink, z = c.z - nz * sink;
    if (!clear(x, z, r, plateau ? 0.8 : 0.75)) continue;
    if (blocked(x, z, r, 5)) continue;
    if (treeNear(x, z, r * 0.5)) continue;
    const y = heightAt(c.x, c.z) - ny * sink - (plateau ? 0.4 : 1.7) * scale;
    // rolled too (the bands don't run level from module to module), its lean varied
    out.push({ id, x, y, z, yaw, scale, tiltX: -lean + rng.range(-0.12, 0.08), tiltZ: rng.range(-0.16, 0.16) });
    big.push({ x, z, r });
  }
  const cliffs = out.length;

  // ── tors on the crest and the plateau behind it ──
  for (let x = -CHUNK_HALF + 14; x < 150; x += rng.range(24, 40)) {
    const z = ridgeFootZ(x) + RIDGE.climb + rng.range(-4, 16);
    if (!inChunk(x, z, 10)) continue;
    const s = slopeAt(x, z);
    if (s.a > 0.5) continue;
    const id = TORS[rng.int(0, 1)] ?? 'tor-a';
    const sz = size(id), scale = rng.range(0.9, 1.4), r = Math.hypot(sz.hw, sz.hd) * scale;
    if (!clear(x, z, r, 0.8) || blocked(x, z, r, 6) || treeNear(x, z, r * 0.6)) continue;
    out.push({ id, x, y: heightAt(x, z) - 0.6 * scale, z, yaw: rng.range(0, Math.PI * 2), scale, tiltX: rng.range(-0.05, 0.05), tiltZ: rng.range(-0.05, 0.05) });
    big.push({ x, z, r });
  }

  // ── talus: below each cliff, where the slope eases ──
  const small: { x: number; z: number; r: number }[] = [];
  // a boulder half-buried in the joint between two neighbouring cliffs (their seam, where two modules meet)
  for (let i = 0; i < cliffs; i++) for (let j = i + 1; j < cliffs; j++) {
    const a = out[i], b = out[j];
    if (!a || !b || a.id === CRAG_HERO || b.id === CRAG_HERO) continue;
    const ra = Math.hypot(size(a.id).hw, size(a.id).hd) * a.scale, rb = Math.hypot(size(b.id).hw, size(b.id).hd) * b.scale;
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d > (ra + rb) * 1.1) continue;
    const t = ra / (ra + rb), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    const id = BOULDERS[rng.int(0, 2)] ?? 'boulder-a';
    const scale = rng.range(1.0, 1.6), r = Math.hypot(size(id).hw, size(id).hd) * scale;
    if (blocked(x, z, r, 2.5) || !small.every((q) => Math.hypot(q.x - x, q.z - z) > (q.r + r) * 0.8)) continue;
    out.push({ id, x, y: heightAt(x, z) - 0.45 * scale, z, yaw: rng.range(0, Math.PI * 2), scale, tiltX: rng.range(-0.3, 0.3), tiltZ: rng.range(-0.3, 0.3) });
    small.push({ x, z, r });
  }
  for (let i = 0; i < cliffs; i++) {
    const c = out[i];
    if (!c || c.id === CRAG_HERO) continue;
    const sz = size(c.id);
    const n = rng.int(2, 4);
    for (let k = 0; k < n; k++) {
      const yaw = c.yaw + rng.range(-0.6, 0.6);
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      // walk down the fall line from the cliff's front until the ground eases below ~34°
      let d = sz.hd * c.scale + rng.range(0.5, 2.5), x = c.x + fx * d, z = c.z + fz * d;
      for (let g = 0; g < 14 && slopeAt(x, z).a > 0.6; g++) { d += 1.6; x = c.x + fx * d; z = c.z + fz * d; }
      d += rng.range(0, 5); x = c.x + fx * d; z = c.z + fz * d;
      const scree = rng.next() < 0.45;
      const id = scree ? (SCREES[rng.int(0, 1)] ?? 'scree-a') : (BOULDERS[rng.int(0, 2)] ?? 'boulder-a');
      const bs = size(id), scale = scree ? rng.range(0.8, 1.25) : rng.range(0.7, 1.3), r = Math.hypot(bs.hw, bs.hd) * scale;
      if (slopeAt(x, z).a > 0.72) continue;
      if (blocked(x, z, r, scree ? 1.5 : 2.5) || treeNear(x, z, scree ? 0.9 : r * 0.7)) continue;
      if (!small.every((b) => Math.hypot(b.x - x, b.z - z) > (b.r + r) * 0.7) || !clear(x, z, r, 0.45)) continue;
      const s = slopeAt(x, z);
      // scree lies with the ground (its fan down the fall line); a boulder settles with a little of the slope
      const lie = scree ? 1 : 0.35, tilt = s.a * lie;
      out.push({ id, x, y: heightAt(x, z) - (scree ? 0.05 : 0.25 * scale), z, yaw: scree ? s.yaw : rng.range(0, Math.PI * 2), scale, tiltX: tilt, tiltZ: 0 });
      small.push({ x, z, r });
      if (scree) out[out.length - 1] = { ...(out[out.length - 1] as CragPlace), yaw: s.yaw };
    }
  }
  return out;
}

// ───────────────────────────────────── the face skin (the heightfield's steep faces as granite) ─────────────────────────

const fract = (v: number): number => v - Math.floor(v);
const hash1 = (n: number): number => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
function vnoise2(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const h = (a: number, b: number): number => hash1(a * 57 + b * 113);
  return (h(ix, iz) * (1 - ux) + h(ix + 1, iz) * ux) * (1 - uz) + (h(ix, iz + 1) * (1 - ux) + h(ix + 1, iz + 1) * ux) * uz;
}

/** how much of the face skin covers (x, z): 0 on gentle ground, 1 on the crag country's steep faces (from ~38° to ~46°) */
export function skinWeight(x: number, z: number): number {
  if (!cragCountry(x, z) || !inChunk(x, z, 3)) return 0;
  const s = slopeAt(x, z);
  let w = ss(0.64, 0.8, s.a);
  if (w <= 0) return 0;
  // not over the trails (the lookout's graded traverse, the N road's pass), the lookout's pad, the waterfall's lip, the cave's hood
  w *= ss(3, 7, trailDistance(x, z));
  w *= ss(LOOKOUT.r + 3, LOOKOUT.r + 8, Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z));
  w *= ss(5, 10, segDist(x, z, [WATERFALL.lip.x, WATERFALL.lip.z], [WATERFALL.foot.x, WATERFALL.foot.z]));
  const [lx, lz] = caveLocal(x, z);
  if (lz > -8 && lz < 18 && Math.abs(lx) < 9) w *= ss(9, 6, Math.abs(lx)) < 1 ? 1 - ss(9, 6, Math.abs(lx)) * ss(-8, -4, lz) * ss(18, 14, lz) : 0;
  return w;
}

/**
 * One tile of the face skin: the heightfield's steep faces re-drawn in granite at `step` m, pushed out along the slope's
 * horizontal normal into stepped bands — each band a near-vertical riser over a flat tread (the ledges: the moss and the
 * grit settle there), the bands' heights and offsets varying column by column (the vertical joints), a slow noise over
 * it all — and diving back under the ground where the slope eases, so the skin comes out of the terrain without an edge.
 * Null when the tile has no face. Its blocks become the drawn geometry in ../world/cragBake.ts `skinGeometry`.
 */
export function skinTile(x0: number, z0: number, size: number, step: number): SkinBlocks | null {
  const n = Math.round(size / step) + 1;
  const w = new Float32Array(n * n);
  let any = false;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = skinWeight(x0 + i * step, z0 + j * step); w[j * n + i] = v; if (v > 0) any = true; }
  if (!any) return null;
  const pos = new Float32Array(n * n * 3), ao = new Float32Array(n * n), keep = new Int32Array(n * n).fill(-1);
  const idx: number[] = [];
  const used = new Uint8Array(n * n);
  for (let j = 0; j + 1 < n; j++) for (let i = 0; i + 1 < n; i++) {
    const a = j * n + i;
    if ((w[a] ?? 0) + (w[a + 1] ?? 0) + (w[a + n] ?? 0) + (w[a + n + 1] ?? 0) <= 0) continue;
    used[a] = used[a + 1] = used[a + n] = used[a + n + 1] = 1;
  }
  let k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i;
    if (!used[a]) continue;
    const x = x0 + i * step, z = z0 + j * step, h = heightAt(x, z), ww = w[a] ?? 0;
    const [nx, ny, nz] = normalAt(x, z, 2.5);
    const hl = Math.hypot(nx, nz) || 1, ox = nx / hl, oz = nz / hl;
    const tan = Math.max(0.9, hl / Math.max(0.15, ny));
    // the column (a joint every ~3–5 m along the contour) sets its bands' height and phase
    const along = x * -oz + z * ox;
    const col = Math.floor(along / 5.5 + vnoise2(x * 0.06, z * 0.06) * 1.4);
    const H = 3.0 + hash1(col) * 3.5;
    // the column's phase, within 0.4 of a band (the joints step, they don't fold the skin)
    const t = fract((h + hash1(col + 7.3) * H * 0.4) / H + (vnoise2(x * 0.2, z * 0.2) - 0.5) * 0.1);
    const rough = (vnoise2(x * 0.22, z * 0.22 + h * 0.1) - 0.5) * 0.45 + (vnoise2(x * 0.9 + h * 0.5, z * 0.9) - 0.5) * 0.12;
    // the band's points pushed OUT along the downhill normal as they climb (t·k·H/tan cancels the slope's own run), so
    // each band is a riser ~80° steep standing on the slope, its foot on the ground, and the wrap (t 1 → 0) a tread
    // stepping back into the slope: a staircase that stays outside the terrain. The old skin pushed by (0.5 − t): its
    // bands ran at half the slope and folded back under themselves at the wrap (9.8 % of the skin's area faced back
    // into the slope; this 3.5 %). The wrap is a tread 40 % of a band wide (a hard wrap aliases on the grid and folds),
    // and the columns' phases stay within 0.4 of a band. Coarse steps (the far level) alias the bands into noise: there
    // the steps flatten toward their mean.
    const tw = 0.4, f = t < 1 - tw ? t / (1 - tw) : (1 - t) / tw;
    const kk = 0.8 * (1 - tw), amp = step > 1.5 ? 0.3 : 1, mean = 0.5 * kk * (H / tan);
    const riser = mean + (f * kk * (H / tan) - mean) * amp;
    const out = ww * (0.4 + riser + rough + hash1(col + 3.1) * 0.25) - (1 - ww) * 0.5;
    pos[k * 3] = x + ox * out; pos[k * 3 + 1] = h - (1 - ww) * 0.15; pos[k * 3 + 2] = z + oz * out;
    // AO: the foot of each riser (under the tread above) darker, the treads open
    ao[k] = 0.5 + 0.45 * Math.min(1, t * 1.6);
    keep[a] = k++;
  }
  for (let j = 0; j + 1 < n; j++) for (let i = 0; i + 1 < n; i++) {
    const a = keep[j * n + i] ?? -1, b = keep[(j + 1) * n + i] ?? -1, c = keep[(j + 1) * n + i + 1] ?? -1, d = keep[j * n + i + 1] ?? -1;
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    const wa = (w[j * n + i] ?? 0) + (w[(j + 1) * n + i] ?? 0) + (w[(j + 1) * n + i + 1] ?? 0) + (w[j * n + i + 1] ?? 0);
    if (wa <= 0) continue;
    idx.push(a, b, d, b, c, d);
  }
  if (idx.length === 0) return null;
  // the page's index is 16-bit (three picks it for fewer than 65 535 vertices): a tile is at most 93 × 93
  if (k >= 65535) throw new Error(`[crags] a skin tile of ${String(k)} vertices needs a 32-bit index`);
  return { pos: pos.slice(0, k * 3), ao: ao.slice(0, k), index: Uint16Array.from(idx) };
}


// ─────────────────────────────── the kit's footprints and the bake ───────────────────────────────

/** every module's footprint: its LOD0's box in its own frame (the kit's geometries as the page loads them, bounds computed) */
export function cragSizes(kit: ReadonlyMap<string, THREE.BufferGeometry>): CragSizes {
  const of = (id: CragId): CragSize => {
    const b = kit.get(id)?.boundingBox;
    return b ? { hw: Math.max(-b.min.x, b.max.x), hd: Math.max(-b.min.z, b.max.z), h: b.max.y } : { hw: 4, hd: 3, h: 8 };
  };
  const out = {} as CragSizes;
  for (const id of CRAG_IDS) out[id] = of(id);
  if (kit.has(CRAG_HERO)) out.hero = of(CRAG_HERO);
  return out;
}

/** one tier's skin: its binary (per tile, near then far: position, AO, index, each padded to 4 bytes) and its table */
export interface SkinBake { bin: Uint8Array; tiles: [number, number, number, number][] }

/** a tier's skin tiles at its two resolutions, in the page's order (a tile with no face at either is skipped) */
export function bakeSkin(tier: Tier): SkinBake {
  const [near, far] = SKIN_STEPS[tier];
  const tiles: [number, number, number, number][] = [], chunks: Uint8Array[] = [];
  let bytes = 0;
  const push = (b: SkinBlocks): void => {
    const size = skinBytes(b.ao.length, b.index.length), out = new Uint8Array(size);
    let at = 0;
    for (const block of [b.pos, b.ao, b.index]) { out.set(new Uint8Array(block.buffer, block.byteOffset, block.byteLength), at); at += Math.ceil(block.byteLength / 4) * 4; }
    chunks.push(out); bytes += size;
  };
  for (let tz = 96; tz < CHUNK_HALF; tz += SKIN_TILE) for (let tx = -CHUNK_HALF; tx < CHUNK_HALF; tx += SKIN_TILE) {
    const g0 = skinTile(tx, tz, SKIN_TILE, near), g1 = skinTile(tx, tz, SKIN_TILE, far);
    if (!g0 || !g1) continue;
    tiles.push([g0.ao.length, g0.index.length, g1.ao.length, g1.index.length]);
    push(g0); push(g1);
  }
  const bin = new Uint8Array(bytes);
  let at = 0;
  for (const c of chunks) { bin.set(c, at); at += c.length; }
  return { bin, tiles };
}

/** The binary as it ships: its 4-byte words' bytes in four lanes (../world/cragBake.ts `unshuffleLanes` undoes it). */
export function shuffleLanes(bin: Uint8Array): Uint8Array {
  if (bin.length % 4 !== 0) throw new Error('[crags] the skin bake is not whole words');
  const n = bin.length / 4, out = new Uint8Array(bin.length);
  for (let i = 0; i < n; i++) for (let b = 0; b < 4; b++) out[b * n + i] = bin[i * 4 + b] ?? 0;
  return out;
}

/**
 * The bake: every placement and both tiers' skins. Run with the Pine level selected and its baked terrain installed (the
 * page's heights and normals; the trails and pads are the level's own field).
 */
export function bakePineCrags(kit: ReadonlyMap<string, THREE.BufferGeometry>, trees: readonly { x: number; z: number }[]): { places: CragPlace[]; skin: Record<Tier, SkinBake> } {
  return { places: placeCrags({ sizes: cragSizes(kit), trees }), skin: { phone: bakeSkin('phone'), desktop: bakeSkin('desktop') } };
}
