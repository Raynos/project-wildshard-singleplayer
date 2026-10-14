import { zlibSync } from 'fflate';
import { ISLES, KNOLLS } from '../data/layout';
import PLACEMENTS from '../data/placements.json' with { type: 'json' };
import dressing from '../data/dressing.json' with { type: 'json' };
import { MEADOW, MEADOW_BLADES, SWARD } from '../data/meadowLook';
import { ISLE_RIM, playableIsleRims } from './isleRim';

/**
 * Build-time only (SHARD-PLATFORM M3): the near meadow's blades, baked (data/meadowLook.ts; world/meadow.ts draws them).
 * The old program grew one 8 m tile of seeded blades round the camera and threw most away on every vertex (off an island,
 * in a hole, on a worn path, thinned by the keep share); this runs the same placement once, over every 8 m tile that
 * touches an island, and keeps only the blades that survive, each with what its place decided (knoll height, final height,
 * grass, tone, flower) and how far it may be shifted without crossing a rim, a hole, a rock or a steep slope (the near
 * copies' room, flagged when the rim is what cuts it short). The rim is the island mesh's own (generators/isleRim.ts): every
 * blade and copy stands `RIM_INSET` inside the curve the island draws, so none hangs over the void. The phone's blades (the first `MEADOW.phone` of a tile's seeded set) lead each chunk, so the phone draws
 * a prefix. Layout (deflated): u32 chunk count; per chunk f32 x, z, y (its corner and base height), u32 blades, u32 phone
 * blades; then 8 bytes a blade (`MEADOW_BLADES`).
 */

const fract = (x: number): number => x - Math.floor(x);
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const mh = (x: number, y: number): number => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function mn(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return mix(mix(mh(ix, iy), mh(ix + 1, iy), ux), mix(mh(ix, iy + 1), mh(ix + 1, iy + 1), ux), uy);
}
const mfbm = (x: number, y: number): number => mn(x, y) * 0.55 + mn(x * 2.1 + 7.3, y * 2.1 + 7.3) * 0.3 + mn(x * 4.3 - 3.1, y * 4.3 - 3.1) * 0.15;
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax, aby = by - ay, t = Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / Math.max(abx * abx + aby * aby, 1e-4)));
  return Math.hypot(px - ax - abx * t, py - ay - aby * t);
}
/** the rises' height (data/layout.ts KNOLLS: sphere caps) */
function knoll(x: number, z: number): number {
  let y = 0;
  for (const k of KNOLLS) { const R = (k.base * k.base + k.h * k.h) / (2 * k.h), d = Math.hypot(x - k.x, z - k.z); if (d < k.base) y += Math.sqrt(R * R - d * d) - (R - k.h); }
  return y;
}

/** how far inside the island mesh's drawn rim a blade, or a near copy of it, may stand (metres) */
const RIM_INSET = 0.15;
/** An island's drawn rim as its points round its centre (generators/isleRim.ts), for the blades' inside test and room. */
interface Rim { x: number; z: number; y: number; id: string; reach: number; px: Float64Array; pz: Float64Array }
function islandRims(): Rim[] {
  const rims = playableIsleRims();
  return ISLES.map((s) => {
    const radii = rims.get(s.id) ?? [], px = new Float64Array(ISLE_RIM), pz = new Float64Array(ISLE_RIM);
    radii.forEach((r, i) => { const a = (i / ISLE_RIM) * Math.PI * 2; px[i] = Math.cos(a) * r; pz[i] = Math.sin(a) * r; });
    return { x: s.x, z: s.z, y: s.y, id: s.id, reach: Math.max(0, ...radii), px, pz };
  });
}
/** Where a point (lx, lz, from the island's centre, at angle `ang`) meets the rim: the rim's radius that way (its chord
 *  between the two points either side), and the point's distance to the rim (only when within `near` of it, else `near`). */
function rimAt(rim: Rim, lx: number, lz: number, ang: number, near: number): { radius: number; dist: number } {
  const u = ((ang / (Math.PI * 2)) * ISLE_RIM + ISLE_RIM) % ISLE_RIM, i = Math.floor(u) % ISLE_RIM, j = (i + 1) % ISLE_RIM;
  const ax = rim.px[i] ?? 0, az = rim.pz[i] ?? 0, bx = rim.px[j] ?? 0, bz = rim.pz[j] ?? 0, dx = Math.cos(ang), dz = Math.sin(ang);
  const radius = (ax * (bz - az) - az * (bx - ax)) / (dx * (bz - az) - dz * (bx - ax)), d = Math.hypot(lx, lz);
  if (d < radius - near) return { radius, dist: near };
  let dist = near;
  for (let k = 0; k < ISLE_RIM; k++) dist = Math.min(dist, segDist(lx, lz, rim.px[k] ?? 0, rim.pz[k] ?? 0, rim.px[(k + 1) % ISLE_RIM] ?? 0, rim.pz[(k + 1) % ISLE_RIM] ?? 0));
  return { radius, dist };
}

interface Blade { x: number; z: number; y: number; h: number; r: number; tone: number; code: number; safe: number; rimCut: boolean; phone: boolean }

/** The baked blades (see the module's comment), deflated. */
export function bakeMeadowBlades(): Uint8Array {
  const { tile, blades: perTile, phone } = MEADOW;
  const holes = [...PLACEMENTS.meadow.holes.map(([x = 0, z = 0, r = 0, w = 0]) => [x, z, r, w] as const), ...dressing.discs.map(([x = 0, z = 0, r = 0]) => [x, z, r, 1] as const)];
  const paths = PLACEMENTS.meadow.paths.map(([ax = 0, az = 0, bx = 0, bz = 0]) => [ax, az, bx, bz] as const);
  // the tile's seeded blades (the SDK tile field's order: x, z, r per card), the same for every tile
  let a = MEADOW.seed >>> 0;
  const rnd = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const seeds = Array.from({ length: perTile }, () => [rnd(), rnd(), rnd()] as const);
  const rims = islandRims();
  const tiles = new Map<string, readonly [number, number]>();
  for (const s of ISLES) for (let tx = Math.floor((s.x - s.r - 1) / tile); tx <= Math.floor((s.x + s.r + 1) / tile); tx++) for (let tz = Math.floor((s.z - s.r - 1) / tile); tz <= Math.floor((s.z + s.r + 1) / tile); tz++) tiles.set(`${String(tx)},${String(tz)}`, [tx, tz]);
  // every surviving blade, bucketed by the chunk it ends in (a tuft's lean can carry it over its tile's edge)
  const kept = new Map<string, Blade[]>();
  for (const [tx, tz] of tiles.values()) {
    const ox = tx * tile, oz = tz * tile;
    seeds.forEach(([jx, jz, r], b) => {
      let px = ox + jx * tile, pz = oz + jz * tile;
      // tufts: three blades in four lean in toward their cell's tuft centre, and each tuft has its own height
      const cx = Math.floor(px * 1.4), cz = Math.floor(pz * 1.4);
      const k = fract(r * 61.3) >= 0.25 ? 0.25 : 0;
      px = mix(px, (cx + 0.25 + 0.5 * mh(cx, cz)) / 1.4, k); pz = mix(pz, (cz + 0.25 + 0.5 * mh(cx + 7.1, cz + 7.1)) / 1.4, k);
      const tuftK = 0.7 + 0.7 * mh(cx + 3.3, cz + 3.3);
      let y = -1e4, rim = 1, tall = 1, keep = 1, rimRoom = 0;
      for (const s of rims) {
        const lx = px - s.x, lz = pz - s.z, d = Math.hypot(lx, lz);
        if (d >= s.reach) continue;
        // inside the island's drawn rim, and RIM_INSET short of it
        const { radius, dist } = rimAt(s, lx, lz, Math.atan2(lz, lx), MEADOW_BLADES.room + RIM_INSET + 0.5);
        if (d < radius && dist >= RIM_INSET) { y = s.y; rim = d / radius; const wild = smooth(0.55, 0.8, rim); tall = mix(MEADOW.grass[s.id] ?? 1, 1, wild); keep = mix(MEADOW.keep[s.id] ?? 1, 1, wild); rimRoom = dist - RIM_INSET; }
      }
      if (y < -1e3) return;
      y += knoll(px, pz);
      let clear = 1, worn = 1, holeRoom = Infinity;
      for (const [hx, hz, hr, hw] of holes) {
        const d = Math.hypot(px - hx, pz - hz), o = smooth(hr, hr + 0.6, d);
        clear = Math.min(clear, hw > 0.5 ? mix(0.3, 1, o) : o); holeRoom = Math.min(holeRoom, d - hr);
      }
      for (const [ax, az, bx, bz] of paths) worn = Math.min(worn, smooth(0.15, 0.7, segDist(px, pz, ax, az, bx, bz) + 0.3 * mn(px * 1.7, pz * 1.7)));
      const pt = mfbm(px * 0.23, pz * 0.23);
      const kdx = (knoll(px + 0.4, pz) - knoll(px - 0.4, pz)) / 0.8, kdz = (knoll(px, pz + 0.4) - knoll(px, pz - 0.4)) / 0.8, slope = Math.hypot(kdx, kdz);
      // three grasses by a noise field: the lawn on the rises' slopes and the worn ground, the wild grass toward the rims
      const spN = mfbm(px * 0.19 + 31, pz * 0.19 + 31) + 0.3 * (fract(r * 37.7) - 0.5) - 0.6 * Math.min(slope, 0.6) - 0.15 * (1 - worn) + 0.1 * smooth(0.8, 1, rim);
      const species = spN < SWARD.share[0] ? 0 : spN < SWARD.share[1] ? 1 : 2;
      const hr = species === 0 ? SWARD.height.lawn : species === 1 ? SWARD.height.broad : SWARD.height.wild;
      let h = mix(hr[0], hr[1], smooth(0.2, 0.8, pt) * 0.4 + r * 0.6) * mix(0.85, 1.15, mn(px * 0.37 + 11, pz * 0.37 + 11));
      h *= tall * mix(0.85, 1.15, (tuftK - 0.7) / 0.7) * (1 - 0.3 * smooth(0.85, 1, rim)) * clear * mix(0.8, 1, worn);
      if (h < 0.04 || fract(r * 53.1) > keep * mix(0.88, 1, worn)) return;
      // flowers: clustered drifts (daisies, buttercups, an orange wildflower), a few strays; never on a path
      const drift = smooth(0.55, 0.72, mfbm(px * 0.16 + 4, pz * 0.16 + 4)) * smooth(0.45, 0.65, mn(px * 0.9 + 2, pz * 0.9 + 2));
      const flower = fract(r * 91.7) <= (0.004 + 0.3 * drift * drift) * worn;
      const kind = !flower ? 0 : (mn(px * 0.45 + 20, pz * 0.45 + 20) + 0.35 * fract(r * 17.3)) > 0.82 ? (fract(r * 41.9) > 0.6 ? 3 : 2) : 1;
      // the near copies' room: inside the rim, clear of a hole's or rock's disc, and short on a slope (≤ 8 cm of rise)
      const other = Math.min(MEADOW_BLADES.room, holeRoom - 0.05, slope > 1e-4 ? 0.08 / slope : Infinity), safe = Math.max(0, Math.min(other, rimRoom));
      const key = `${String(Math.floor(px / tile))},${String(Math.floor(pz / tile))}`, list = kept.get(key) ?? [];
      list.push({ x: px, z: pz, y, h, r, tone: pt, code: species + 4 * kind, safe, rimCut: rimRoom < other, phone: b < phone }); kept.set(key, list);
    });
  }
  const chunks = [...kept.values()].map((blades) => {
    const first = blades[0], x = Math.floor((first?.x ?? 0) / tile) * tile, z = Math.floor((first?.z ?? 0) / tile) * tile;
    blades.sort((p, q) => Number(q.phone) - Number(p.phone) || Math.floor(p.z * 4) - Math.floor(q.z * 4) || p.x - q.x); // the phone's first; rows pack tighter
    return { x, z, y: Math.min(...blades.map((k) => k.y)), blades };
  }).sort((p, q) => p.z - q.z || p.x - q.x);
  const total = chunks.reduce((n, c) => n + c.blades.length, 0), head = 4 + chunks.length * 20, out = new Uint8Array(head + total * 8), view = new DataView(out.buffer);
  view.setUint32(0, chunks.length, true);
  const byte = (v: number, scale: number): number => { const q = Math.round(v * scale); if (q < 0 || q > 255) throw new Error(`meadow blades: ${String(v)} out of range`); return q; };
  let at = head;
  chunks.forEach((c, i) => {
    const o = 4 + i * 20;
    view.setFloat32(o, c.x, true); view.setFloat32(o + 4, c.z, true); view.setFloat32(o + 8, c.y, true);
    view.setUint32(o + 12, c.blades.length, true); view.setUint32(o + 16, c.blades.filter((b) => b.phone).length, true);
    for (const b of c.blades) {
      out.set([byte((b.x - c.x) / tile, 255), byte((b.z - c.z) / tile, 255), byte(b.y - c.y, 1 / MEADOW_BLADES.y), byte(b.h, 1 / MEADOW_BLADES.h),
        byte(b.r, 255), byte(b.tone, 255), b.code, byte(b.safe, 1 / MEADOW_BLADES.safe) + (b.rimCut ? MEADOW_BLADES.rimCut : 0)], at);
      at += 8;
    }
  });
  return zlibSync(out, { level: 9 });
}
