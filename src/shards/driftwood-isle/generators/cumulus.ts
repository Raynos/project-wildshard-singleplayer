import { Rng } from '@wildshard/engine/core/rng';

/**
 * Driftwood's cumulus ring layout, baked to data/cumulusPuffs.json (SHARD-PLATFORM C2): 22 clusters of 6–11 puffs on a
 * ring 900–1700 m out, bigger and lower toward the horizon, a few riding high. Each row is one puff
 * `[x, y, z, radius, puff, cluster, baseY]`: its centre (m, the dome's frame), its icosahedron radius, its index in its
 * cluster and the cluster's (the lumps' phases), and the height its base is cut flat at. The sky graph (data/skyLook.ts)
 * lumps, squashes and flattens one shared icosahedron per row. Regenerate with
 *   node --experimental-transform-types --import ./scripts/bake-loader.mjs src/sdk/bake/json.mjs \
 *     src/shards/driftwood-isle/generators/cumulus.ts cumulusPuffs src/shards/driftwood-isle/data/cumulusPuffs.json
 */
export const CUMULUS_SEED = 0xc10d;

const round = (v: number): number => Math.round(v * 1000) / 1000;

/** The puff rows of the ring (the layout the runtime once rolled at boot, from the same seed and draws). */
export function cumulusPuffs(): number[][] {
  const rng = new Rng(CUMULUS_SEED);
  const rows: number[][] = [];
  const clusters = 22;
  for (let k = 0; k < clusters; k++) {
    const az = (k / clusters) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const dist = rng.range(900, 1700);
    const elev = rng.range(0.05, 0.22) * (k % 3 === 0 ? 1.9 : 1);                // a few ride high in the sky
    const baseY = Math.tan(elev) * dist * 0.75;
    const cx = Math.cos(az) * dist, cz = Math.sin(az) * dist;
    const tx = -Math.sin(az), tz = Math.cos(az);                                    // along the ring (the cluster spreads sideways)
    const size = rng.range(1.1, 2.1) * (dist / 1000);
    const puffs = rng.int(6, 12);
    for (let i = 0; i < puffs; i++) {
      const along = rng.range(-1, 1) * 110 * size;
      const mid = 1 - Math.abs(along) / (170 * size);                              // the middle puffs are the big, tall ones
      const r = rng.range(26, 58) * size * mid;
      const px = cx + tx * along + rng.range(-20, 20) * size, pz = cz + tz * along + rng.range(-20, 20) * size;
      const py = baseY + r * rng.range(0.35, 0.8) + mid * mid * rng.range(0, 55) * size;   // towers
      rows.push([round(px), round(py), round(pz), round(Math.max(8, r)), i, k, round(baseY)]);
    }
  }
  return rows;
}

/**
 * G685 B: the toon cel cumulus layout, baked to data/cumulusToonPuffs.json (same row shape and graph inputs as the ring
 * above). Jake's board (art/clouds/round-1-three-styles, A) has fewer, bigger, rounder clouds riding higher: 16 clusters
 * 800–1500 m out, their flat bases 5–20° above the horizon, each a broad base of wide puffs under a domed crown that
 * climbs toward the middle. Regenerate as the ring, with `toonCumulusPuffs` and data/cumulusToonPuffs.json.
 */
export function toonCumulusPuffs(): number[][] {
  const rng = new Rng(CUMULUS_SEED ^ 0x7007);
  const rows: number[][] = [];
  const clusters = 16;
  for (let k = 0; k < clusters; k++) {
    const az = (k / clusters) * Math.PI * 2 + rng.range(-0.12, 0.12);
    const dist = rng.range(800, 1500);
    const elev = rng.range(0.09, 0.35);
    const baseY = Math.tan(elev) * dist;
    const cx = Math.cos(az) * dist, cz = Math.sin(az) * dist;
    const tx = -Math.sin(az), tz = Math.cos(az), rx = Math.cos(az), rz = Math.sin(az);
    const size = rng.range(1.2, 2) * (dist / 1000);
    const puffs = rng.int(9, 15);
    for (let i = 0; i < puffs; i++) {
      const along = rng.range(-1, 1) * 120 * size;
      const mid = Math.max(0, 1 - Math.abs(along) / (150 * size));                   // the crown rises toward the middle
      const r = rng.range(34, 56) * size * (0.6 + 0.4 * mid);
      const deep = rng.range(-30, 30) * size;
      const px = cx + tx * along + rx * deep, pz = cz + tz * along + rz * deep;
      const py = baseY + r * rng.range(0.25, 0.5) + mid * mid * rng.range(20, 75) * size;
      rows.push([round(px), round(py), round(pz), round(Math.max(10, r)), i, k, round(baseY)]);
    }
  }
  return rows;
}
