import type { TerrainNoise } from '@wildshard/engine/level/data';
import type { DuneFieldRow } from '../../data/duneField';

/**
 * A crescent dune field (SHARD-PLATFORM M3; ex a dune shard's landscape): a terrain height function from rows. Barchan-like
 * transverse crests run across the wind, bowed into crescents and wandering on the noise, each a convex windward (stoss)
 * rise to a knife-edge crest and a near-linear slip face (lee); phased so a crest runs through the spawn; their amplitude
 * varying along them and damped toward the square's edge and round a basin. Over the field: authored crest lines (a lift
 * along a segment, a steeper lee side and a trough behind), authored landforms (polyline crests that pull the field up by
 * their face profile, and cosine mounds by a max), flat spots levelled to their own dune height, and a sand bowl eased
 * over its rim. Nothing here knows a shard: every number is the row's.
 */

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
/** Stoss (windward) rise 0 → 1: eased out of the trough, still climbing at the crest so the crest is a knife edge. */
const stoss = (t: number): number => t * t * (2 - t);
/** Lee (slip face) fall 1 → 0: near-linear, so its steepest is only 1.15 × its mean. */
const lee = (s: number): number => 1 - (0.7 * s + 0.3 * smooth(s));

/** A crescent dune field's height function from its rows (cached per noise field). */
export function duneField(row: DuneFieldRow): (x: number, z: number, noise: TerrainNoise) => number {
  const W = row.wind, B = row.basin;
  const warped = (x: number, z: number, n: TerrainNoise['n']): number =>
    x * W.x + z * W.z + Math.cos((-x * W.z + z * W.x) * row.warp.bow) * row.warp.bowAmp + n.get(x * row.warp.noise, z * row.warp.noise) * row.warp.noiseAmp;
  const phases = new WeakMap<TerrainNoise['n'], number>();
  const phaseOf = (n: TerrainNoise['n']): number => {
    let p = phases.get(n); if (p === undefined) { p = warped(row.spawn.x, row.spawn.z, n) - row.spawnPhase * row.wave; phases.set(n, p); }
    return p;
  };
  const crestLines = (x: number, z: number): number => {
    let lift = 0;
    for (const c of row.crestLines) {
      const [ax, az] = c.a, [bx, bz] = c.b, dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
      const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2));
      const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
      const side = dx * (z - az) - dz * (x - ax), width = side > 0 ? c.lee : c.w;
      const ends = smooth(t / c.fade) * smooth((1 - t) / c.fade);
      const dip = side > 0 ? 0 : c.trough * Math.sin(Math.PI * Math.min(1, d / (2 * c.w))) ** 2;
      lift = Math.max(lift, c.lift * (1 - smooth(d / width)) * ends) - dip * ends;
    }
    return lift;
  };
  const landforms = (x: number, z: number, out: [number, number][]): number => {
    let h = -Infinity;
    for (const c of row.landforms.crests) {
      let best = Infinity, ch = 0, side = 0, along = 0, total = 0;
      const segLen: number[] = [];
      for (let i = 0; i + 1 < c.pts.length; i++) { const [ax, az] = c.pts[i] ?? [0, 0], [bx, bz] = c.pts[i + 1] ?? [0, 0]; segLen.push(Math.hypot(bx - ax, bz - az)); }
      for (const l of segLen) total += l;
      let run = 0;
      for (let i = 0; i + 1 < c.pts.length; i++) {
        const [ax, az, ah] = c.pts[i] ?? [0, 0, 0], [bx, bz, bh] = c.pts[i + 1] ?? [0, 0, 0], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
        const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
        if (d < best) { best = d; ch = ah + (bh - ah) * t; side = (dx * (z - az) - dz * (x - ax)) / Math.sqrt(l2); along = run + t * (segLen[i] ?? 0); }
        run += segLen[i] ?? 0;
      }
      const u = along / total, ends = smooth(u / c.fade) * smooth((1 - u) / c.fade);
      // a knife-edge crest: the windward face convex (eased), the slip face near-linear, blended over 16 m across the line
      const leeW = smooth(0.5 + c.leeSide * side / 16), kl = Math.min(1, best / c.lee), kw = Math.min(1, best / c.w);
      const prof = leeW * (1 - (0.75 * kl + 0.25 * smooth(kl))) + (1 - leeW) * (1 - smooth(kw) * (2 - smooth(kw)) * 0.5 - 0.5 * kw);
      // the field is pulled up to the crest by the face profile only, so past the faces the field keeps its own relief
      const weight = Math.max(0, prof) * ends;
      if (weight > 0) out.push([ch, weight]);
    }
    for (const m of row.landforms.mounds) {
      const r = Math.hypot(x - m.x, z - m.z); if (r >= m.r) continue;
      h = Math.max(h, m.h * (0.5 + 0.5 * Math.cos(Math.PI * r / m.r)));
    }
    return h;
  };
  const A = row.amp, D = row.damp, R = row.relief;
  const field = (x: number, z: number, n: TerrainNoise['n']): { h: number; amp: number } => {
    const u0 = x * W.x + z * W.z, v = -x * W.z + z * W.x;
    const w = (warped(x, z, n) - phaseOf(n)) / row.wave, p = w - Math.floor(w);
    const ridge = p < 1 - row.lee ? stoss(p / (1 - row.lee)) : lee((p - (1 - row.lee)) / row.lee);
    const edge = Math.max(Math.abs(x), Math.abs(z));
    const db = Math.hypot(x - B.x, z - B.z);
    const damp = (1 - D.edge[2] * smooth((edge - D.edge[0]) / D.edge[1])) * (1 - D.basin[1] * (1 - smooth((db - B.r) / D.basin[0])));
    const amp = Math.min(row.ampMax, A.base + A.noise * n.get(v * A.v[0] + A.v[1], u0 * A.u[0] + A.u[1])) * damp;
    return { h: row.floor + amp * ridge + R.amp * n.get(x * R.scale + R.x, z * R.scale + R.z) * damp + crestLines(x, z), amp };
  };
  const spotLevels = new WeakMap<TerrainNoise['n'], number[]>();
  return (x, z, { n }) => {
    let { h } = field(x, z, n);
    const crestShapes: [number, number][] = [];
    const mound = landforms(x, z, crestShapes);
    for (const [crest, weight] of crestShapes) h += Math.max(0, crest - h) * weight;
    h = Math.max(h, mound);
    let levels = spotLevels.get(n);
    if (levels === undefined) { levels = row.spots.map((p) => { const cs: [number, number][] = [], m = landforms(p.x, p.z, cs); let lh = field(p.x, p.z, n).h; for (const [sh, w] of cs) lh += Math.max(0, sh - lh) * w; return Math.max(lh, m) + p.lift; }); spotLevels.set(n, levels); }
    for (const [i, p] of row.spots.entries()) {
      const d = Math.hypot(x - p.x, z - p.z); if (d > p.r + p.ease) continue;
      h += ((levels[i] ?? h) - h) * (1 - smooth((d - p.r) / p.ease));
    }
    const db = Math.hypot(x - B.x, z - B.z);
    if (db < B.r + row.bowlEase) h += (row.basinFloor - h) * (1 - smooth((db - B.floor) / (B.r + row.bowlEase - B.floor)));
    return h;
  };
}
