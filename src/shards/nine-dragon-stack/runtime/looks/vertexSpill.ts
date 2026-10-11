import { workSlice } from '@wildshard/engine/core/workSlice';
// Vertex light spill (SHARD-PLATFORM M3): everything that glows (signs, lanterns, lit shopfronts) is an emitter, and its
// SPILL is baked once at build time into a per-vertex attribute (`aSpill`) of merged geometry: no per-pixel light loop.
// Spill = Σ colour × strength / (1 + r² / R²), R = 2.2 · max(w, h) + 1.5, cut at 3R, via a spatial grid.
import { BufferAttribute, type BufferGeometry, type Color, Float32BufferAttribute, type Vector3 } from 'three';

export interface Emitter {
  at: Vector3;
  /** linear colour (the saturated hue) */
  color: Color;
  /** size of the glowing face, metres */
  w: number;
  h: number;
  /** reflection strength (streak cards) */
  power: number;
  /** spill strength on walls and ground (0 = none) */
  spill: number;
}

const CELL = 2;
// Array lengths/counts are safe integers. This finite bound preserves every input
// element; cooperative workSlice checks below bound the work between drawn frames.
const MAX_ITEMS = 9007199254740991;

/** Bakes the per-vertex light spill while keeping phone WebKit's page thread responsive. */
export async function bakeSpill(geos: readonly BufferGeometry[], emitters: readonly Emitter[]): Promise<void> {
  interface Light { x: number; y: number; z: number; r2: number; invR2: number; r: number; g: number; b: number; spill: number }
  interface Cell {
    minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number;
    lights: Light[];
  }
  const grid = new Map<number, Map<number, Map<number, Cell>>>();
  const slice = workSlice();
  // Index only occupied fine cells. The old broad cubes materialized millions of empty
  // bins, then made each vertex test lights anywhere in an 8 m cell. Neither is needed
  // to preserve the cutoff or the original emitter accumulation order.
  for (let gi = 0; gi < Math.min(geos.length, MAX_ITEMS); gi++) {
    const g = geos[gi];
    if (g === undefined) continue;
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
    if (!(pos instanceof BufferAttribute) || !(nor instanceof BufferAttribute)) continue;
    const pa = pos.array;
    for (let i = 0; i < Math.min(pos.count, MAX_ITEMS); i++) {
      const o = i * 3, px = pa[o] ?? 0, py = pa[o + 1] ?? 0, pz = pa[o + 2] ?? 0;
      const x = Math.floor(px / CELL), y = Math.floor(py / CELL), z = Math.floor(pz / CELL);
      let rows = grid.get(x);
      if (rows === undefined) { rows = new Map(); grid.set(x, rows); }
      let columns = rows.get(y);
      if (columns === undefined) { columns = new Map(); rows.set(y, columns); }
      const cell = columns.get(z);
      if (cell === undefined) {
        columns.set(z, { minX: px, minY: py, minZ: pz, maxX: px, maxY: py, maxZ: pz, lights: [] });
      } else {
        cell.minX = Math.min(cell.minX, px); cell.maxX = Math.max(cell.maxX, px);
        cell.minY = Math.min(cell.minY, py); cell.maxY = Math.max(cell.maxY, py);
        cell.minZ = Math.min(cell.minZ, pz); cell.maxZ = Math.max(cell.maxZ, pz);
      }
      if ((i & 511) === 511 && slice.due()) await slice.yield();
    }
    if (slice.due()) await slice.yield();
  }
  interface Row { y: number; columns: { z: number; cell: Cell }[] }
  const axes: { x: number; rows: Row[] }[] = [];
  const xs = Array.from(grid).sort((a, b) => a[0] - b[0]);
  for (let xi = 0; xi < Math.min(xs.length, MAX_ITEMS); xi++) {
    const x = xs[xi];
    if (x === undefined) continue;
    const rows: Row[] = [], ys = Array.from(x[1]).sort((a, b) => a[0] - b[0]);
    for (let yi = 0; yi < Math.min(ys.length, MAX_ITEMS); yi++) {
      const y = ys[yi];
      if (y === undefined) continue;
      const columns = Array.from(y[1], ([z, cell]) => ({ z, cell })).sort((a, b) => a.z - b.z);
      rows.push({ y: y[0], columns });
      if (slice.due()) await slice.yield();
    }
    axes.push({ x: x[0], rows });
    if (slice.due()) await slice.yield();
  }
  function lowerBound<T>(entries: readonly T[], coordinate: (entry: T) => number, min: number): number {
    let low = 0, high = entries.length;
    for (let attempt = 0; attempt < 53; attempt++) {
      if (low >= high) break;
      const mid = Math.floor((low + high) / 2), entry = entries[mid];
      if (entry !== undefined && coordinate(entry) < min) low = mid + 1;
      else high = mid;
    }
    return low;
  }
  const axisX = (entry: (typeof axes)[number]): number => entry.x;
  const axisY = (entry: (typeof axes)[number]['rows'][number]): number => entry.y;
  const axisZ = (entry: (typeof axes)[number]['rows'][number]['columns'][number]): number => entry.z;
  for (let ei = 0; ei < Math.min(emitters.length, MAX_ITEMS); ei++) {
    const e = emitters[ei];
    if (e === undefined) continue;
    if (slice.due()) await slice.yield();
    if (e.spill <= 0) continue;
    const R = 2.2 * Math.max(e.w, e.h) + 1.5;
    const reach = Math.ceil((3 * R) / 8);
    if (reach < 0) continue;
    const r2 = R * R;
    const light: Light = { x: e.at.x, y: e.at.y, z: e.at.z, r2, invR2: 1 / r2, r: e.color.r, g: e.color.g, b: e.color.b, spill: e.spill };
    // These bounds are conservative only. Every candidate still evaluates the exact old
    // d2 > 9*r2 expression below; padded bounds keep roundoff at tangencies from pruning it.
    const radius = 3 * Math.abs(R) + Math.max(1, Math.abs(e.at.x), Math.abs(e.at.y), Math.abs(e.at.z), R) * 1e-12;
    // Fine cells divide the old 8 m bins exactly, including negative coordinates.
    // Intersect its cube as well, preserving even zero/negative authored-radius cases.
    const extent = (at: number): readonly [number, number] => [
      Math.max(Math.floor((at - radius) / CELL), (Math.floor(at / 8) - reach) * 4),
      Math.min(Math.floor((at + radius) / CELL), (Math.floor(at / 8) + reach + 1) * 4 - 1),
    ];
    const [minX, maxX] = extent(e.at.x), [minY, maxY] = extent(e.at.y), [minZ, maxZ] = extent(e.at.z);
    const cutoff = 9 * r2, paddedCutoff = cutoff + Math.max(1, cutoff) * 1e-12;
    const xStart = lowerBound(axes, axisX, minX);
    for (let xi = 0; xi < Math.min(axes.length - xStart, MAX_ITEMS); xi++) {
      const column = axes[xStart + xi];
      if (column === undefined || column.x > maxX) break;
      const yStart = lowerBound(column.rows, axisY, minY);
      for (let yi = 0; yi < Math.min(column.rows.length - yStart, MAX_ITEMS); yi++) {
        const row = column.rows[yStart + yi];
        if (row === undefined || row.y > maxY) break;
        const zStart = lowerBound(row.columns, axisZ, minZ);
        for (let zi = 0; zi < Math.min(row.columns.length - zStart, MAX_ITEMS); zi++) {
          const entry = row.columns[zStart + zi];
          if (entry === undefined || entry.z > maxZ) break;
          const cell = entry.cell;
          const dx = Math.max(cell.minX - light.x, 0, light.x - cell.maxX);
          const dy = Math.max(cell.minY - light.y, 0, light.y - cell.maxY);
          const dz = Math.max(cell.minZ - light.z, 0, light.z - cell.maxZ);
          if (dx * dx + dy * dy + dz * dz <= paddedCutoff) cell.lights.push(light);
          if ((zi & 127) === 127 && slice.due()) await slice.yield();
        }
        if (slice.due()) await slice.yield();
      }
    }
  }
  for (let gi = 0; gi < Math.min(geos.length, MAX_ITEMS); gi++) {
    const g = geos[gi];
    if (g === undefined) continue;
    if (slice.due()) await slice.yield();
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    if (!(pos instanceof BufferAttribute) || !(nor instanceof BufferAttribute)) continue;
    const pa = pos.array, na = nor.array;
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < Math.min(pos.count, MAX_ITEMS); i++) {
      const o = i * 3;
      const px = pa[o] ?? 0, py = pa[o + 1] ?? 0, pz = pa[o + 2] ?? 0;
      const list = grid.get(Math.floor(px / CELL))?.get(Math.floor(py / CELL))?.get(Math.floor(pz / CELL))?.lights;
      let r = 0, gg = 0, b = 0;
      if (list !== undefined) for (let li = 0; li < Math.min(list.length, MAX_ITEMS); li++) {
        const e = list[li];
        if (e === undefined) continue;
        const dx = e.x - px, dy = e.y - py, dz = e.z - pz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 9 * e.r2) continue;
        const dot = (na[o] ?? 0) * dx + (na[o + 1] ?? 0) * dy + (na[o + 2] ?? 0) * dz;
        const facing = Math.max(dot / Math.sqrt(Math.max(d2, 1e-4)), 0) * 0.75 + 0.25;
        const k = (e.spill * facing) / (1 + d2 * e.invR2);
        r += e.r * k;
        gg += e.g * k;
        b += e.b * k;
      }
      out[o] = r;
      out[o + 1] = gg;
      out[o + 2] = b;
      if ((i & 511) === 511 && slice.due()) await slice.yield();
    }
    g.setAttribute('aSpill', new Float32BufferAttribute(out, 3));
  }
}
