import { Color } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import authoredCoverLook from '../data/groundCover.json' with { type: 'json' };
import { facetColour } from './facetedGround';
import { DENSITY, beach, type Site } from './coverSites';
import { coverAvoid, type AuthorCoverGrid } from './coverGrid';

const { GROUND_COVER } = authoredCoverLook;

/**
 * Driftwood's streamed ground cover, its plants baked per cell at build (SHARD-PLATFORM W2 C2, G467): every 16 m cell's
 * candidates (data/coverLook.ts `candidates`) run the placement rules once here, exactly as the page ran them per cell
 * at load (the cell's hashed Rng, the site read once per point, a density lottery per kind, its jitter, scale, tint,
 * yaw), and each plant's ground (the cover grid's side, the facet colour, the cover's jittered rgb and top) is written
 * beside it. The page (runtime/looks/streamedCover.ts) only slices the file per cell.
 *
 * The file (little-endian; runtime/looks/streamedCover.ts `decodeCoverCell` reads it): u32 magic 'WSCC', version, cell
 * size, x0 + 2^15, z0 + 2^15 (cell coordinates), width, height (cells), kinds, the tinted kinds (a bit per kind); then per cell (row by row) per kind its
 * plant count (u16); then the plants, cell by cell, kind by kind, PLANT bytes each: u16 x, z (in the cell ± 0.5 m),
 * y ((y + 16) × 512), yaw (/ 2π); u8 scale (in the kind's range), tint rgb (/ 2); i8 normal x, z; u8 cover side,
 * ground rgb, cover rgb, top.
 */
export const COVER_CELLS_MAGIC = 0x43435357;
export const COVER_CELLS_VERSION = 1;
const STRIDE = 19, HEAD = 9, PLANT = 22;

type Tint = (h: number, rng: Rng, out: Color) => void;
/** the tinted kinds' per-instance tint (multiplies the vertex colours) */
const TINT: Readonly<Record<string, Tint>> = {
  tuft: (h, r, out) => { const b = beach(h); out.setRGB(1 + b * 0.35 + r.range(-0.08, 0.08), 1 + b * 0.12 + r.range(-0.06, 0.06), 1 - b * 0.35); },
  shells: (_h, r, out) => { const v = r.next(); out.setRGB(v < 0.3 ? 1.0 : 1.05, v < 0.3 ? 0.85 : 1.0, 0.95); },
  starfish: (_h, r, out) => { const v = r.next(); if (v < 0.25) out.setRGB(0.55, 0.45, 1.3); else if (v < 0.5) out.setRGB(1.05, 0.95, 0.6); else out.setRGB(1, 1, 1); },
};

/** ×0.88 … ×1.12 per point, a hash of where it is (the facets of covered ground keep their light / dark mosaic). */
export const coverJitter = (x: number, z: number): number => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return 0.88 + (h - Math.floor(h)) * 0.24; };

interface Ground {
  heightAt: (x: number, z: number) => number;
  normalAt: (x: number, z: number, eps: number) => [number, number, number];
  trailDistance: (x: number, z: number) => number;
}

/** Every cell's plants over the island (see the module comment): `grid` the tier's full cover grid, `palms` its palms,
 *  `area` the Blender island's (its own cover dresses it). */
export function bakeCoverCells(grid: AuthorCoverGrid, palms: readonly { x: number; z: number }[], ground: Ground, seed: number, area: { x0: number; x1: number; z0: number; z1: number }): Uint8Array {
  const row = GROUND_COVER, CELL = row.cell, kinds = row.kinds, nk = kinds.length, sea = 0, { avoid, shrine: SHRINE } = coverAvoid();
  const palmGrid = new Map<string, { x: number; z: number }[]>();
  for (const p of palms) { const k = `${Math.floor(p.x / 8)},${Math.floor(p.z / 8)}`, list = palmGrid.get(k); if (list) list.push(p); else palmGrid.set(k, [p]); }
  const ss = (e0: number, e1: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const nearPalm = (x: number, z: number): number => {
    let best = 0;
    const gx = Math.floor(x / 8), gz = Math.floor(z / 8);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (const p of palmGrid.get(`${gx + dx},${gz + dz}`) ?? []) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < 3.5) best = Math.max(best, 1 - ss(1.0, 3.5, d));
    }
    return best;
  };
  const site: Site = { h: 0, slope: 0, nx: 0, ny: 1, nz: 0, td: 0, sd: 0, palm: 0 };
  const sampleSite = (x: number, z: number): boolean => {
    if (avoid.some((a) => (x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r)) return false;
    if (x > area.x0 && x < area.x1 && z > area.z0 && z < area.z1) return false;
    const h = ground.heightAt(x, z) - sea;
    if (h < 0.4) return false;
    const [nx, ny, nz] = ground.normalAt(x, z, 0.6), slope = 1 - ny;
    if (slope > 0.3) return false;
    site.h = h; site.slope = slope; site.nx = nx; site.ny = ny; site.nz = nz;
    site.td = ground.trailDistance(x, z); site.sd = Math.hypot(x - SHRINE.x, z - SHRINE.z); site.palm = nearPalm(x, z);
    return true;
  };
  const density = kinds.map((k) => DENSITY[k.name] ?? (() => 0)), tint = kinds.map((k) => TINT[k.name] ?? null);
  const col = new Color(), c = new Color(), cv = { r: 0, g: 0, b: 0, top: 0, side: 0 }, out = new Float32Array(STRIDE);
  // every cell of the chunk (the page finds none outside it)
  const x0 = Math.floor(-CHUNK_HALF / CELL), x1 = Math.ceil(CHUNK_HALF / CELL) - 1, z0 = x0, z1 = x1;
  const width = x1 - x0 + 1, height = z1 - z0 + 1, counts = new Uint16Array(width * height * nk), plants: number[] = [];
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
    const rng = new Rng(seed ^ Math.imul(cx + 1013, 73856093) ^ Math.imul(cz + 2027, 19349663));
    const perKind: number[][] = kinds.map(() => []);
    for (let i = 0; i < row.candidates; i++) {
      const x = (cx + rng.next()) * CELL, z = (cz + rng.next()) * CELL;
      if (!sampleSite(x, z)) continue;
      for (let ki = 0; ki < nk; ki++) {
        const k = kinds[ki], list = perKind[ki];
        if (k === undefined || list === undefined) continue;
        if (rng.next() * 2 > (density[ki] ?? (() => 0))(site)) continue;
        const jx = x + rng.range(-0.3, 0.3), jz = z + rng.range(-0.3, 0.3), sc = rng.range(k.scale[0], k.scale[1]);
        const t = tint[ki] ?? null;
        if (t !== null) t(site.h, rng, col); else col.setRGB(1, 1, 1);
        const yaw = rng.range(0, Math.PI * 2), y = ground.heightAt(jx, jz);
        facetColour(c, y - sea, site.slope, jx, jz);
        grid.sample(jx, jz, cv);
        const j = coverJitter(jx, jz);
        out.set([jx, y - row.sink, jz, yaw, sc, col.r, col.g, col.b, site.nx, site.ny, site.nz, cv.side, c.r, c.g, c.b, cv.r * j, cv.g * j, cv.b * j, cv.top]);
        for (const v of out) list.push(v);
      }
    }
    const cell = ((cz - z0) * width + (cx - x0)) * nk;
    perKind.forEach((list, ki) => { counts[cell + ki] = list.length / STRIDE; for (const v of list) plants.push(v); });
  }
  const nPlants = plants.length / STRIDE, body = (HEAD * 4 + counts.length * 2 + 3) & ~3;
  const bytes = new Uint8Array(body + nPlants * PLANT), view = new DataView(bytes.buffer);
  [COVER_CELLS_MAGIC, COVER_CELLS_VERSION, CELL, x0 + 2 ** 15, z0 + 2 ** 15, width, height, nk, tint.reduce((m, t, ki) => (t === null ? m : m | (1 << ki)), 0)].forEach((v, i) => { view.setUint32(i * 4, v, true); });
  counts.forEach((v, i) => { view.setUint16(HEAD * 4 + i * 2, v, true); });
  const u8 = (v: number, k = 1): number => Math.round(Math.min(1, Math.max(0, v / k)) * 255), u16 = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 65535);
  let o = body, p = 0;
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) for (let ki = 0; ki < nk; ki++) {
    const k = kinds[ki], n = counts[((cz - z0) * width + (cx - x0)) * nk + ki] ?? 0;
    if (k === undefined) continue;
    for (let e = 0; e < n; e++, p += STRIDE, o += PLANT) {
      const v = (i: number): number => plants[p + i] ?? 0;
      view.setUint16(o, u16((v(0) - cx * CELL + 0.5) / (CELL + 1)), true); view.setUint16(o + 2, u16((v(2) - cz * CELL + 0.5) / (CELL + 1)), true);
      view.setUint16(o + 4, u16((v(1) + 16) / 128), true); view.setUint16(o + 6, u16(v(3) / (Math.PI * 2)), true);
      bytes[o + 8] = u8((v(4) - k.scale[0]) / (k.scale[1] - k.scale[0]));
      bytes[o + 9] = u8(v(5), 2); bytes[o + 10] = u8(v(6), 2); bytes[o + 11] = u8(v(7), 2);
      view.setInt8(o + 12, Math.round(v(8) * 127)); view.setInt8(o + 13, Math.round(v(10) * 127));
      for (let i = 0; i < 8; i++) bytes[o + 14 + i] = u8(v(11 + i));
    }
  }
  return bytes;
}
