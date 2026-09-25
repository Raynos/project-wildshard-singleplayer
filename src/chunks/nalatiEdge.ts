/**
 * N23 — hide the slab's edge (the user's pick, NALATI-FINISH B6): a natural rise along the slab's edges, so the end of
 * the 3D world is always behind a skyline of real 3D things — a grassy berm / low ridge, spruce lines and granite on its
 * crest — and the painted panorama starts above and behind that skyline. Where the ground at the edge is low and open
 * (the Kunes valley in the north, the valley's west and east ends, the E / W / S gate valleys, the W and E shoulders over
 * the bowl) the berm stands 7–21 m over the ground inside (a low 3–9 m bank by the camp and the pasture, where the valley
 * floor already climbs to the edge: the painted range stays over it); on the snow ring's crags it fades out (they are
 * the skyline).
 *
 *   · its crest runs along the edge itself (1–3.5 m in), so nothing past the crest is ever the slab: the slab's rock
 *     wall (Terrain.buildPainterlySlab) drops away under it into the cloud deck
 *   · the inner face is a smootherstep: a rounded crest, a long gentle grassy toe, and half way down a band past the
 *     player's 40° (43–52°; the face's width follows the height that stands, so a low bank is as steep) — nobody walks
 *     up the face (a 1 m flood fill of the ≤ 40° ground finds no climb onto the crest from inside); granite (src/nalati/outcrops.ts)
 *     and the spruce lines (the def's `forest.mask`) stand on the crest
 *   · cut where the four entry roads meet the edge at y = 0 (the engine rule): a notch the road's width, spruce and the
 *     berm either side; where the Kunes leaves the slab the gorge narrows to a ~12 m slot by the south bank; it keeps
 *     back from the camp, the corral and the pasture
 *
 * A Look Lab variant (Settings `edge`, `?edge=1`; pause ▸ Settings ▸ Debug ▸ Look lab ▸ Edge, on the next load): the
 * height field is baked, so the variant is a second bake — public/assets/baked/nalati-grasslands/terrain.edge.bin and
 * navmesh.edge.bin (scripts/bake-chunk.mjs / bake-navmesh.mjs bake both), picked at load (ChunkDef.bakeVariant →
 * BakedTerrain.ts, physics/navmesh.ts). The def adds the rise on top of buildTerrain's field (nalati-grasslands.ts
 * TERRAIN). Off = today's slab, byte for byte. Read once at module load, like the def it shapes.
 */
import { Noise2D, smoothstep, clamp } from '../core/noise';
import { CHUNK_HALF, ROAD_WIDTH } from '../core/config';
import { setting } from '../ui/Settings';
import { CAMP, PASTURE, riverZAt, riverHalfAt } from './nalatiLayout';

/** the variant is on for this page (the saved Look Lab pick, the URL's `?edge=` over it) */
export const EDGE_ON: boolean = setting('edge') === 'on';
/** the bake file suffix of the variant (`terrain${EDGE_BAKE}.bin`, `navmesh${EDGE_BAKE}.bin`) */
export const EDGE_BAKE = EDGE_ON ? '.edge' : '';

const bn = new Noise2D(0x4a1a + 313), bn2 = new Noise2D(0x4a1a + 317);
const ROAD_HALF = ROAD_WIDTH / 2;

/** the places the berm keeps back from: its toe may reach a few metres into them (a gentle rise), no further */
const KEEP: { x: number; z: number; r: number }[] = [
  { x: CAMP.x, z: CAMP.z, r: 27 },
  { x: CAMP.x + 27, z: CAMP.z + 9, r: 11 }, // the corral
  { x: PASTURE.x, z: PASTURE.z, r: PASTURE.r + 1 },
];

/**
 * One edge's berm at `d` metres in from it, `s` along it, `k` = which edge (its own noise), `m` = how much of its height
 * stands here (the place's own scale: lower by the camp, faded on the crags, cut at the road and the river) — the rise.
 * The face's width follows the height that stands (1.45 … 1.8 × it), so a lower bank is as steep as a high one: the
 * smootherstep face's steepest band, half way down, is 43 … 52° (past the player's 40°), a rounded crest, a gentle toe.
 */
function edgeProfile(d: number, s: number, k: number, m: number): number {
  if (d > 60 || m <= 0) return 0;
  const u = s * 0.013 + k * 37.1;
  // the height over the ground inside: long swells 7 … 18 m (a knoll to ~20 here and there), a bump every ~25 m
  const H = clamp(10.5 + bn.fbm(u, 3.7, 3) * 13 + Math.max(0, bn2.get(s * 0.006 + k * 2.1, 4.4)) * 6 + bn2.get(s * 0.04 + k * 9, 1.3) * 1.8, 7, 21) * m;
  const crest = 1 + 2.5 * (0.5 + 0.5 * bn2.get(s * 0.03 + k * 5.5, 7.1));
  const W = Math.max(1.5, H * (1.62 + 0.18 * bn.get(s * 0.02 + k * 3.3, 11.9)));
  if (d <= crest) return H;
  const t = Math.min(1, (d - crest) / W);
  return H * (1 - t * t * t * (t * (t * 6 - 15) + 10));
}

/**
 * The berm's rise at (x, z) over the finished field's height `h` there (buildTerrain's, the entry roads already at y = 0 at
 * the edge): the highest of the four edges' profiles — faded out on high ground (the crags), cut at the roads and the
 * river, kept back from the camp and the pasture and lower by them — roughened. 0 when the variant is off.
 */
export function edgeRise(x: number, z: number, h: number): number {
  if (!EDGE_ON) return 0;
  const dN = CHUNK_HALF - z, dS = z + CHUNK_HALF, dW = CHUNK_HALF - x, dE = x + CHUNK_HALF;
  if (Math.min(dN, dS, dW, dE) > 60) return 0;
  // the crags are their own skyline: none on high ground (the snow ring's walls), a little on the shoulders
  let m = smoothstep(64, 44, h);
  // the Kunes leaves the slab through a gorge (W and E ends): the berm falls away to the gravel's edge, and in the last
  // ~40 m the gorge narrows to a ~12 m slot hugging the south bank (the berm's feet stand in the gravel), so the valley
  // never looks out through it
  const rz = riverZAt(x), rh = riverHalfAt(x);
  const slot = smoothstep(45, 6, Math.min(dW, dE));
  const gz = rz - 5 * slot, gh = rh + 2 + (6 - rh - 2) * slot;
  m *= smoothstep(gh, gh + 18 - 10 * slot, Math.abs(z - gz));
  for (const c of KEEP) m *= smoothstep(c.r - 6, c.r + 6, Math.hypot(x - c.x, z - c.z));
  // lower by the camp and the pasture (the valley floor already climbs ~8 m to the edge there): a low grassy bank the
  // spruce and the granite stand on, the painted range still over it — full height 120 m away
  const near = Math.min(Math.hypot(x - CAMP.x, z - CAMP.z), Math.hypot(x - PASTURE.x, z - PASTURE.z));
  m *= 0.42 + 0.58 * smoothstep(45, 120, near);
  if (m <= 0) return 0;
  let rise = 0;
  const edges: [number, number, number][] = [[dN, x, 0], [dS, -x, 1], [dW, -z, 2], [dE, z, 3]];
  for (const [d, s, k] of edges) {
    // the entry road on this edge (its midpoint: across = |s|): a notch the road's width through a saddle
    const across = Math.abs(s);
    const cut = smoothstep(ROAD_HALF + 1.5, ROAD_HALF + 8, across) * (0.8 + 0.2 * smoothstep(10, 45, across));
    rise = Math.max(rise, edgeProfile(d, s, k, m * cut));
  }
  if (rise <= 0) return 0;
  // lumps and hollows in the turf (small against the face's slope: the steep band stays steep)
  return rise * (1 + 0.1 * bn2.fbm(x * 0.045, z * 0.045, 3)) + bn.fbm(x * 0.11 + 5, z * 0.11, 2) * 0.5 * smoothstep(0, 3, rise);
}

/** metres in from the nearest slab edge */
export function edgeDistance(x: number, z: number): number {
  return CHUNK_HALF - Math.max(Math.abs(x), Math.abs(z));
}

/** 0..1: the spruce lines on the berm's crest and upper face — clustered along the edge, gaps between (the def's forest mask) */
export function edgeSpruceMask(x: number, z: number, rise: number): number {
  if (!EDGE_ON || rise < 3) return 0;
  const d = edgeDistance(x, z);
  const band = smoothstep(30, 6, d);
  const s = Math.abs(x) > Math.abs(z) ? z : x;
  const clump = smoothstep(-0.25, 0.3, bn.fbm(s * 0.02 + 51.3, x * 0.004 - z * 0.004, 2));
  return band * (0.35 + 0.65 * clump) * smoothstep(3, 8, rise);
}
