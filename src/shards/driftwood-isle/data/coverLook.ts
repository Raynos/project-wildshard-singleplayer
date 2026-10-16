// SHARD-PLATFORM M3 (look-family rows): Driftwood's streamed ground cover as data (world/GroundCover.ts builds it through
// runtime/looks/streamedCover.ts): its cells, reaches, caps, upload budget, slope reach and kinds, and the material graphs
// its plants wear (SHARD-PLATFORM W2 C2: the shardfile's `look.materials`, compiled by the hybrid runtime; W2c: their
// graphs are authored graph JSON, data/lookGraphs.json). The kinds' densities and tints stay code.
import type { StreamedCoverRow } from './lookRows';

/**
 * The cover's numbers. 16 m cells of 520 candidates, refilled every 4 m; the desktop reaches 1.25× further (E117) with
 * 3× the instance caps (the phone 1.8×); a plant grows over a quarter of its (far − near). The far set rebuilds every 8 m
 * with 16 m of slack within 1.5 ms (desktop 2 ms) a frame and grows in over 0.8 s where it lands somewhere new. E186: the
 * whole cover uploads at most 256 KB a frame and the near set starts 1 m early. E156 C: plants on sloping ground (slope
 * 0.01 ≈ 8° … 0.08 ≈ 23°) keep their reach × up to 1.7, fading out 5 … 14 m over the ground (Explore's height).
 *
 * The kinds (E43 the beach, E117 the far models of 3–8 triangles: the near model's silhouette from 25 m on, its flowers
 * as flat chips; for tufts only 60 % of them get one): tufts, ferns, hibiscus, daisies and pebbles on the grass, shells and
 * starfish on the sand, bushes along the sand → grass edge.
 */
export const GROUND_COVER: StreamedCoverRow = {
  cell: 16,
  refill: 4,
  candidates: 520,
  cacheMin: 96,
  reachK: { phone: 1, desktop: 1.25 },
  capK: { phone: 1.8, desktop: 3 },
  growShare: 0.25,
  farRefill: 8,
  farSlack: 16,
  farBudgetMs: { phone: 1.5, desktop: 2 },
  farIn: 0.8,
  eyeSlack: 2,
  uploadBytes: 262144,
  nearLag: 1,
  sink: 0.02,
  slopeReach: { up: 1.7, lo: 0.01, hi: 0.08, fadeFrom: 5, fadeTo: 14 },
  look: 'driftwood-cover',
  meshPrefix: 'ground-cover-',
  kinds: [
    { name: 'tuft', geometry: 'tuft', cap: 5200, reach: [14, 34], scale: [0.9, 1.5], far: { geometry: 'tuftFar', reach: [26, 60], cap: 16000, keep: 0.6 } },
    { name: 'fern', geometry: 'fern', cap: 1400, reach: [14, 34], scale: [0.7, 1.4], far: { geometry: 'fernFar', reach: [26, 60], cap: 4400, keep: 1 } },
    { name: 'hibiscus', geometry: 'hibiscus', cap: 900, reach: [14, 34], scale: [0.8, 1.3], far: { geometry: 'hibiscusFar', reach: [26, 64], cap: 3200, keep: 1 } },
    { name: 'daisy', geometry: 'daisy', cap: 800, reach: [9, 22], scale: [0.8, 1.4], far: { geometry: 'daisyFar', reach: [16, 40], cap: 1600, keep: 1 } },
    { name: 'pebble', geometry: 'pebble', cap: 400, reach: [9, 22], scale: [0.7, 1.5] },
    { name: 'shells', geometry: 'shells', cap: 1600, reach: [10, 26], scale: [1.3, 2.3] },
    { name: 'starfish', geometry: 'starfish', cap: 300, reach: [8, 20], scale: [1.1, 1.8] },
    { name: 'bush', geometry: 'bush', cap: 900, reach: [16, 38], scale: [0.8, 1.6], far: { geometry: 'bushFar', reach: [30, 76], cap: 4000, keep: 1 } },
  ],
};

/** the look.materials id a kind's near (`far` false) or far model wears */
const coverLookId = (kind: string, far: boolean): string => `${GROUND_COVER.look}-${kind}${far ? '-far' : ''}`;

/** every cover look id, a near model's per kind and a far model's per kind that has one (the hybrid runtime compiles them;
 *  their graphs: data/lookGraphs.json) */
export const COVER_LOOKS: readonly string[] = GROUND_COVER.kinds.flatMap((k) =>
  k.far === undefined ? [coverLookId(k.name, false)] : [coverLookId(k.name, false), coverLookId(k.name, true)]);
