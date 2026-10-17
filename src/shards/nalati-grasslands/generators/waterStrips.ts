/**
 * Nalati's water, baked (generators/bake-nalati-water.mjs): the braided Kunes (a strip over its gravel corridor) and the
 * meltwater brook in Snow Lotus Valley (a ribbon draped down its bed; the waterfall is cut, layout v2), one mesh on the
 * water-surface host (`surface`, worn as the 'nalati-water' graph of data/lookGraphs.json). Each vertex carries `aWater` =
 * (depth over the bed m, flow 0..1 along the stream, across −1..1, brook 0 | 1): the graph paints by depth (turquoise over
 * the bars → deep blue in the channels), scrolls its streaks along the flow and fades the brook out with distance.
 */
export interface WaterStripLaws {
  readonly heightAt: (x: number, z: number) => number;
  readonly river: { readonly level: number; readonly z: (x: number) => number; readonly half: (x: number) => number };
  readonly brook: readonly (readonly [number, number])[];
  readonly chunkHalf: number;
}
export interface WaterStrips { readonly surface: Readonly<Record<string, unknown>>; readonly position: number[]; readonly water: number[]; readonly index: number[] }

/** the drawn surface's row (`@wildshard/format/water#WaterSurfaceSchema`) */
const SURFACE = { look: 'nalati-water', name: 'nalati-water', renderOrder: 1, bind: { clock: 'time' } };
const round = (v: number): number => Math.round(v * 1e4) / 1e4;

export function bakeWaterStrips({ heightAt, river, brook, chunkHalf }: WaterStripLaws): WaterStrips {
  const position: number[] = [], water: number[] = [], index: number[] = [];
  const vertex = (x: number, y: number, z: number, depth: number, flow: number, across: number, isBrook: number): number => {
    position.push(round(x), round(y), round(z)); water.push(round(depth), round(flow), round(across), isBrook);
    return position.length / 3 - 1;
  };

  // the Kunes: a strip following the corridor's centreline, full width; only the wet channels get a surface (a cell
  // whose four corners all stand on dry gravel is left out, and so are the vertices only dry cells use)
  const nx = 256, nz = 32, x0 = -chunkHalf - 2, x1 = chunkHalf + 2, at = (i: number, j: number): number => i * (nz + 1) + j;
  const depth: number[] = [];
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx, zc = river.z(x), half = river.half(x) + 4;
    for (let j = 0; j <= nz; j++) depth.push(river.level - heightAt(x, zc + ((j / nz) * 2 - 1) * half));
  }
  const kept = new Map<number, number>();
  const keep = (i: number, j: number): number => {
    const k = at(i, j), have = kept.get(k);
    if (have !== undefined) return have;
    const x = x0 + ((x1 - x0) * i) / nx, u = (j / nz) * 2 - 1, v = vertex(x, river.level, river.z(x) + u * (river.half(x) + 4), depth[k] ?? 0, (x - x0) / (x1 - x0), u, 0);
    kept.set(k, v);
    return v;
  };
  const wet = (i: number, j: number): boolean => (depth[at(i, j)] ?? 0) > 0.02;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (!wet(i, j) && !wet(i, j + 1) && !wet(i + 1, j) && !wet(i + 1, j + 1)) continue;
    const a = keep(i, j), a1 = keep(i, j + 1), b = keep(i + 1, j), b1 = keep(i + 1, j + 1);
    index.push(a, a1, b, b, a1, b1);
  }

  // the plateau brook: a 3 m ribbon along its polyline, 0.25 m under the bed's lip
  const pts: [number, number][] = [];
  for (let i = 0; i < brook.length - 1; i++) {
    const a = brook[i], b = brook[i + 1];
    if (!a || !b) continue;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
    for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const last = brook[brook.length - 1];
  if (last) pts.push([last[0], last[1] - 2]); // to the lip of the fall
  // the melt comes out at the foot of the glacier's wall, not up it: the head of the polyline lies on the steep face
  // (the draped ribbon climbed it as a pale strip, E302, NALATI-FINISH B2), so it starts where the bed's grade over the
  // next ~9 m eases under 1 : 4, and fades in over its first few metres
  let head = 0;
  for (let i = 0; i + 3 < pts.length; i++) {
    const a = pts[i], b = pts[i + 3];
    if (!a || !b) continue;
    if ((heightAt(a[0], a[1]) - heightAt(b[0], b[1])) / Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1])) < 0.25) { head = i; break; }
  }
  pts.splice(0, head);
  const first = position.length / 3, half = 1.3;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    if (!p || !q || !o) continue;
    const tx = q[0] - o[0], tz = q[1] - o[1], tl = Math.hypot(tx, tz) || 1, sx = -tz / tl, sz = tx / tl;
    // draped: each vertex just over the ground under it (the 2 m terrain grid only half-resolves the bed, so a flat
    // surface at the bed's level would float over the rendered banks and read as a line across the hill)
    const yBed = heightAt(p[0], p[1]), fadeIn = Math.min(1, i / 3);
    for (const u of [-1, 0, 1]) {
      const x = p[0] + sx * half * u, z = p[1] + sz * half * u;
      vertex(x, Math.min(yBed + 0.45, heightAt(x, z) + 0.18), z, u === 0 ? 0.5 * fadeIn : 0.04 * fadeIn, (i / pts.length) * 0.35, u, 1);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < 2; j++) {
    const a = first + i * 3 + j, b = a + 3;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return { surface: SURFACE, position, water, index };
}
