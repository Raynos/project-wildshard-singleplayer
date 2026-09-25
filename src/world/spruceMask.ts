/**
 * Where spruce grows — the `ChunkForest.mask` field for a spruce shard (Nalati, `src/world/Spruce.ts`).
 *
 * Pure (seeded Noise2D only, no three.js, no DOM): a chunk def imports it, and scripts/bake-chunk.mjs runs it in
 * Node (strip-only TypeScript — no parameter properties, no enums). `placeForest` (src/world/placement.ts) keeps a
 * candidate with this probability, after the clearing noise and before the trail / slope tests.
 *
 * The real Nalati escarpment is a north-facing slope cut by parallel gullies; Tian Shan spruce fills the shaded
 * gullies and the north faces, grass holds the spurs between them (docs/design/nalati/geography-and-map.md §1, §3).
 * So the field is:
 *   · each gully: a band `width` wide around a wobbling centreline x(z), feathered at its edges and at both ends of
 *     its z run — dense, dark, the trees touching (keep → `core`);
 *   · the north faces (optional `normalAt`): ground in the escarpment band that faces +z (north) keeps `northFace`;
 *   · everywhere else inside `lone.zMin…zMax`: `lone.p` — the scattered lone spruces of the valley and the spurs.
 *   · outside that band (the Sky Grassland plateau): nothing, the plateau stays empty (the forced-perspective rule).
 *
 *   forest: { …, spacing: 4.6, mask: spruceMask({ gullies: NALATI_GULLIES, normalAt: terrain.normalAt, seed }) }
 */
import { Noise2D, smoothstep } from '../core/noise';

/** One spruce gully: centreline at `x` (it wobbles ±`wobble` m), running from `zTop` (downhill, the valley end) to `zBottom` (the rim). */
export interface SpruceGully { x: number; zTop: number; zBottom: number; width: number; wobble?: number }

export interface SpruceMaskSpec {
  gullies: SpruceGully[];
  /** keep probability in the gully core (default 1) */
  core?: number;
  /** terrain normal: north-facing ground inside `escarpment` keeps `northFace` */
  normalAt?: (x: number, z: number) => [number, number, number];
  /** z band of the escarpment [zMin, zMax] where the north faces carry spruce (default: the gullies' own span) */
  escarpment?: [number, number];
  /** keep probability on a steep north face — steeper and more north-facing than the escarpment's own ~0.2 (default 0.12) */
  northFace?: number;
  /** scattered lone spruces: keep probability `p` for zMin ≤ z ≤ zMax (default p 0.012 over the escarpment + valley) */
  lone?: { p: number; zMin: number; zMax: number };
  seed: number;
}

/**
 * The map-01 gullies (docs/design/nalati/geography-and-map.md §3): x −170 (east), −60 (east-centre), +135 (west),
 * from the valley foot (z +135) up to the rim (z −15). Engine axes: +z north, −x east.
 */
export const NALATI_GULLIES: SpruceGully[] = [
  { x: -170, zTop: 138, zBottom: -18, width: 56, wobble: 9 },
  { x: -60, zTop: 135, zBottom: -15, width: 50, wobble: 8 },
  { x: 135, zTop: 138, zBottom: -20, width: 56, wobble: 10 },
];

export function spruceMask(spec: SpruceMaskSpec): (x: number, z: number) => number {
  const n = new Noise2D(spec.seed + 313);
  const core = spec.core ?? 1;
  const zs = spec.gullies.flatMap((g) => [g.zTop, g.zBottom]);
  const esc = spec.escarpment ?? [Math.min(...zs), Math.max(...zs)];
  const northFace = spec.northFace ?? 0.12;
  const lone = spec.lone ?? { p: 0.012, zMin: esc[0] - 10, zMax: 250 };
  const normalAt = spec.normalAt;
  return (x, z) => {
    let m = 0;
    for (const g of spec.gullies) {
      const zLo = Math.min(g.zTop, g.zBottom), zHi = Math.max(g.zTop, g.zBottom);
      if (z < zLo - 20 || z > zHi + 20) continue;
      const w = g.wobble ?? 0;
      const cx = g.x + n.get(z * 0.011, g.x * 0.01) * w;                      // the gully snakes a little
      const half = g.width * 0.5 * (1 + n.get(x * 0.03 + 11, z * 0.03) * 0.25); // ragged forest edge
      const across = 1 - smoothstep(half * 0.6, half, Math.abs(x - cx));
      const along = smoothstep(zLo - 12, zLo + 10, z) * (1 - smoothstep(zHi - 10, zHi + 12, z));
      m = Math.max(m, across * along * core);
    }
    if (m >= core) return m;
    if (z >= esc[0] && z <= esc[1] && normalAt) {
      const nz = normalAt(x, z)[2];
      // facing north (+z) more steeply than the escarpment itself (the gully walls, the spur ends): the shaded faces
      const face = smoothstep(0.3, 0.5, nz);
      m = Math.max(m, face * northFace * smoothstep(esc[0], esc[0] + 12, z) * (1 - smoothstep(esc[1] - 12, esc[1], z)));
    }
    if (z >= lone.zMin && z <= lone.zMax) m = Math.max(m, lone.p);
    return m;
  };
}
