import { Rng } from '@wildshard/sdk/random';

/**
 * Driftwood's toon cel cumulus layout (G685 / G750, Jake's pick A on art/clouds/round-1-three-styles), baked to
 * data/cumulusPuffs.json: fewer, bigger, rounder clouds riding higher, 16 clusters 800–1500 m out, their flat bases
 * 5–20° above the horizon, each a broad base of wide puffs under a domed crown that climbs toward the middle. Each row is
 * one puff `[x, y, z, radius, puff, cluster, baseY]`: its centre (m, the dome's frame), its icosahedron radius, its index
 * in its cluster and the cluster's (the lumps' phases), and the height its base is cut flat at. The sky graph
 * (generators/skyLook.ts) lumps, squashes and flattens one shared icosahedron per row. Regenerate with
 *   node --experimental-transform-types --import ./scripts/bake-loader.mjs src/sdk/bake/json.mjs \
 *     src/shards/driftwood-isle/generators/cumulus.ts cumulusPuffs src/shards/driftwood-isle/data/cumulusPuffs.json
 */
export const CUMULUS_SEED = 0xc10d;

const round = (v: number): number => Math.round(v * 1000) / 1000;

/** The puff rows of the toon cumulus. */
export function cumulusPuffs(): number[][] {
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
