/**
 * The lagoon reef's scatter, baked (SHARD-PLATFORM W2 C2; it was runtime/looks/reefBed.ts's `scatterReefBed` and
 * world/Seabed.ts's lagoon ground, moved verbatim): where the water is shallow enough, noise-clustered reefs of one kind,
 * beds of another and a scatter of a third, from the shard's numbers (LAGOON_REEF below), and a school of fish over the
 * densest reef with each fish's tint and swim seeds. The driftwood-reef job writes the layout (data/reefLayout.generated.json)
 * on the bound native ground and welds the reef from the same layout; the runtime only reads it.
 */
import { CHUNK_HALF, ROAD_WIDTH } from '@wildshard/engine/core/config';
import { Noise2D } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import { normalAt, inChunk } from '@wildshard/engine/world/Heightfield';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { OCEAN } from '../world/sites';
import { REEF_FISH_COLOURS } from '../runtime/models/reefFish';

/** One scattered copy: its kind (the row's names), where, size, turn about +Y and which tint (0‥1). */
export interface ReefCopy { kind: string; x: number; z: number; s: number; rot: number; v: number }
/** One fish: its tint and swim seeds (phase, speed, ring offset). */
export interface ReefFish { colour: number; ph: number; spd: number; off: number }
/** The school's centre, radius, count and fish. */
export interface ReefSchoolLayout { x: number; z: number; y: number; r: number; n: number; fish: ReefFish[] }
/** A scatter: its copies and the school over the densest reef. */
export interface ReefLayout { items: ReefCopy[]; school?: ReefSchoolLayout | undefined }

/** One noise field: its seed (added to the shard's), frequency, octaves and x offset. */
interface ReefNoiseRow { readonly seed: number; readonly freq: number; readonly octaves: number; readonly offset: number }

/** The scatter's numbers as data. */
interface ReefScatterRow {
  /** the scatter's rng salt (xor the shard's seed), tries per copy and the margin kept from the chunk's edge (m) */
  readonly salt: number;
  readonly tries: number;
  readonly margin: number;
  /** water depth range (m) and the ground's least normal y (sampled `normalReach` m wide) */
  readonly depth: readonly [number, number];
  readonly normalReach: number;
  readonly minNy: number;
  readonly reefNoise: ReefNoiseRow;
  readonly bedNoise: ReefNoiseRow;
  /** the reef kind: where the reef noise is over `above` and the roll under `roll`, kept with p = (noise − above) × gain +
   *  base, `spacing` m apart, sized `scale` × (1 + max(0, noise) × grow) */
  readonly reef: { readonly kind: string; readonly above: number; readonly roll: number; readonly gain: number; readonly base: number; readonly spacing: number; readonly scale: readonly [number, number]; readonly grow: number };
  /** the bed kind: likewise on the bed noise, sized `scale` × (from + min(1, depth / full) × grow) */
  readonly bed: { readonly kind: string; readonly above: number; readonly roll: number; readonly gain: number; readonly base: number; readonly spacing: number; readonly scale: readonly [number, number]; readonly from: number; readonly full: number; readonly grow: number };
  /** the scattered kind: a roll past the bed's, kept with p = `chance` */
  readonly scatter: { readonly kind: string; readonly chance: number; readonly spacing: number; readonly scale: readonly [number, number] };
  /** the school: over the reef copy with the most reef copies within `radius`, at depth share `depthShare` (at most
   *  `maxDepth` m down), swimming a loop of radius `r`, `n` fish */
  readonly school: { readonly radius: number; readonly depthShare: number; readonly maxDepth: number; readonly r: number; readonly n: number };
  /** the weld's and the school's rng seeds */
  readonly buildSeed: number;
  readonly schoolSeed: number;
}

/**
 * Lagoon rule: the sand shelf 1.5–8 m under the surface, on gentle slopes (normal y ≥ 0.86 over 1.5 m), 14 m inside the
 * chunk; corals in noise-clustered reefs (denser toward a reef's heart, bigger where the noise is high), seaweed in beds
 * (taller in deeper water), a starfish here and there. The school: 28 fish over the coral with the most corals within 12 m,
 * at 55 % of the water's depth (3 m down at most), on a 7 m loop. The weld and its school are named in data/seabedLook.ts.
 */
export const LAGOON_REEF: ReefScatterRow = {
  salt: 0x5eab,
  tries: 60,
  margin: 14,
  depth: [1.5, 8],
  normalReach: 1.5,
  minNy: 0.86,
  reefNoise: { seed: 51, freq: 0.02, octaves: 2, offset: 0 },
  bedNoise: { seed: 52, freq: 0.03, octaves: 2, offset: 7 },
  reef: { kind: 'coral', above: 0.12, roll: 0.75, gain: 2.2, base: 0.25, spacing: 1.6, scale: [0.6, 1.5], grow: 0.6 },
  bed: { kind: 'weed', above: 0.05, roll: 0.92, gain: 2.6, base: 0.2, spacing: 1.2, scale: [0.7, 1.4], from: 0.7, full: 4, grow: 0.5 },
  scatter: { kind: 'star', chance: 0.5, spacing: 2.5, scale: [0.5, 0.9] },
  school: { radius: 12, depthShare: 0.55, maxDepth: 3, r: 7, n: 28 },
  // one stream through every copy, in scatter order, across the kinds (the old loop's 0x5ea1 ^ 0xc0)
  buildSeed: 0x5e61,
  schoolSeed: 0xf15c,
};

/** The ground the scatter reads. */
interface ReefGround {
  readonly level: number;
  readonly heightAt: (x: number, z: number) => number;
  readonly normalY: (x: number, z: number, reach: number) => number;
  readonly clear: (x: number, z: number) => boolean;
}

/** the lagoon's ground: the sea's level, the terrain, and off the four entry sandbars (the jetties) */
const LAGOON: ReefGround = {
  level: OCEAN.level,
  heightAt,
  normalY: (x, z, reach) => normalAt(x, z, reach)[1],
  clear: (x, z) => {
    if (!inChunk(x, z, LAGOON_REEF.margin)) return false;
    if (Math.abs(x) < ROAD_WIDTH / 2 + 5 && Math.abs(z) > CHUNK_HALF - 75) return false; // the S / N jetties' sandbars
    if (Math.abs(z) < ROAD_WIDTH / 2 + 5 && Math.abs(x) > CHUNK_HALF - 120) return false; // the W / E ones (the E jetty runs on into the cove)
    return true;
  },
};

/** The reef's rule: copies where the water is `depth` deep on gentle slopes, `avoid` kept clear; the school over the densest reef. */
function scatterReefBed(row: ReefScatterRow, ground: ReefGround, seed: number, count: number, avoid: readonly { x: number; z: number; r: number }[] = []): ReefLayout {
  const rng = new Rng(seed ^ row.salt), reefN = new Noise2D(seed + row.reefNoise.seed), bedN = new Noise2D(seed + row.bedNoise.seed);
  const level = ground.level, m = row.margin, R = row.reef, B = row.bed, S = row.scatter;
  const items: ReefCopy[] = [];
  let tries = 0;
  const ok = (x: number, z: number, minD: number) => {
    if (!ground.clear(x, z)) return false;
    if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) return false;
    return !items.some((p) => Math.hypot(p.x - x, p.z - z) < minD);
  };
  while (items.length < count && tries++ < count * row.tries) {
    const x = rng.range(-CHUNK_HALF + m, CHUNK_HALF - m), z = rng.range(-CHUNK_HALF + m, CHUNK_HALF - m);
    const d = level - ground.heightAt(x, z);
    if (d < row.depth[0] || d > row.depth[1]) continue;
    const ny = ground.normalY(x, z, row.normalReach);
    if (ny < row.minNy) continue;
    const rn = row.reefNoise, bn = row.bedNoise;
    const r = reefN.fbm(x * rn.freq + rn.offset, z * rn.freq, rn.octaves), b = bedN.fbm(x * bn.freq + bn.offset, z * bn.freq, bn.octaves);
    const roll = rng.next();
    if (r > R.above && roll < R.roll) {
      // a reef: denser toward the reef's heart
      if (rng.next() > (r - R.above) * R.gain + R.base) continue;
      if (!ok(x, z, R.spacing)) continue;
      items.push({ kind: R.kind, x, z, s: rng.range(R.scale[0], R.scale[1]) * (1 + Math.max(0, r) * R.grow), rot: rng.range(0, Math.PI * 2), v: rng.next() });
    } else if (b > B.above && roll < B.roll) {
      if (rng.next() > (b - B.above) * B.gain + B.base) continue;
      if (!ok(x, z, B.spacing)) continue;
      items.push({ kind: B.kind, x, z, s: rng.range(B.scale[0], B.scale[1]) * (B.from + Math.min(1, d / B.full) * B.grow), rot: rng.range(0, Math.PI * 2), v: rng.next() });
    } else if (roll >= B.roll && rng.next() < S.chance) {
      if (!ok(x, z, S.spacing)) continue;
      items.push({ kind: S.kind, x, z, s: rng.range(S.scale[0], S.scale[1]), rot: rng.range(0, Math.PI * 2), v: rng.next() });
    }
  }
  // the fish school: over the densest reef patch placed, at mid-depth
  const sc = row.school;
  let best: ReefCopy | undefined, bestN = -1;
  for (const p of items) {
    if (p.kind !== R.kind) continue;
    let n = 0; for (const q of items) if (q.kind === R.kind && Math.hypot(q.x - p.x, q.z - p.z) < sc.radius) n++;
    if (n > bestN) { bestN = n; best = p; }
  }
  if (best === undefined) return { items };
  // each fish's tint and swim seeds, from the school's own stream (the runtime school's old order)
  const fishRng = new Rng(row.schoolSeed), fish: ReefFish[] = [];
  for (let i = 0; i < sc.n; i++) {
    const colour = REEF_FISH_COLOURS[Math.floor(fishRng.next() * REEF_FISH_COLOURS.length)];
    if (colour === undefined) throw new Error('[reef] fish tint index out of range');
    fish.push({ colour, ph: fishRng.range(0, Math.PI * 2), spd: fishRng.range(0.6, 1), off: fishRng.range(-1, 1) });
  }
  return { items, school: { x: best.x, z: best.z, y: level - Math.min(sc.maxDepth, (level - ground.heightAt(best.x, best.z)) * sc.depthShare), r: sc.r, n: sc.n, fish } };
}

/** Lagoon rule (LAGOON_REEF): corals in noise-clustered reefs, seaweed in beds, a starfish here and there; `avoid`
 *  clears the wreck. */
export function scatterLagoon(seed: number, count: number, avoid: readonly { x: number; z: number; r: number }[]): ReefLayout {
  return scatterReefBed(LAGOON_REEF, LAGOON, seed, count, avoid);
}

/** The layout as the committed JSON (one copy per line). */
export function reefLayoutJson(layout: ReefLayout): string {
  return `{"items":[\n${layout.items.map((p) => JSON.stringify(p)).join(',\n')}\n],"school":${JSON.stringify(layout.school ?? null)}}\n`;
}
