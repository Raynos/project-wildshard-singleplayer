/**
 * The lagoon reef's scatter, baked (SHARD-PLATFORM W2 C2; it was runtime/looks/reefBed.ts's `scatterReefBed` and
 * world/Seabed.ts's lagoon ground, moved verbatim): where the water is shallow enough, noise-clustered reefs of one kind,
 * beds of another and a scatter of a third, from the shard's numbers (data/seabedLook.ts), and a school of fish over the
 * densest reef with each fish's tint and swim seeds. The driftwood-reef job writes the layout (data/reefLayout.generated.json)
 * on the bound native ground and welds the reef from the same layout; the runtime only reads it.
 */
import { CHUNK_HALF, ROAD_WIDTH } from '@wildshard/engine/core/config';
import { Noise2D } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import { normalAt, inChunk } from '@wildshard/engine/world/Heightfield';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { ReefBedRow } from '../data/lookRows';
import { SEABED } from '../data/seabedLook';
import { OCEAN } from '../world/sites';
import { REEF_FISH_COLOURS } from '../models/reefFish';

/** One scattered copy: its kind (the row's names), where, size, turn about +Y and which tint (0‥1). */
export interface ReefCopy { kind: string; x: number; z: number; s: number; rot: number; v: number }
/** One fish: its tint and swim seeds (phase, speed, ring offset). */
export interface ReefFish { colour: number; ph: number; spd: number; off: number }
/** The school's centre, radius, count and fish. */
export interface ReefSchoolLayout { x: number; z: number; y: number; r: number; n: number; fish: ReefFish[] }
/** A scatter: its copies and the school over the densest reef. */
export interface ReefLayout { items: ReefCopy[]; school?: ReefSchoolLayout | undefined }

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
    if (!inChunk(x, z, SEABED.margin)) return false;
    if (Math.abs(x) < ROAD_WIDTH / 2 + 5 && Math.abs(z) > CHUNK_HALF - 75) return false; // the S / N jetties' sandbars
    if (Math.abs(z) < ROAD_WIDTH / 2 + 5 && Math.abs(x) > CHUNK_HALF - 120) return false; // the W / E ones (the E jetty runs on into the cove)
    return true;
  },
};

/** The reef's rule: copies where the water is `depth` deep on gentle slopes, `avoid` kept clear; the school over the densest reef. */
function scatterReefBed(row: ReefBedRow, ground: ReefGround, seed: number, count: number, avoid: readonly { x: number; z: number; r: number }[] = []): ReefLayout {
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

/** Lagoon rule (data/seabedLook.ts): corals in noise-clustered reefs, seaweed in beds, a starfish here and there; `avoid`
 *  clears the wreck. */
export function scatterLagoon(seed: number, count: number, avoid: readonly { x: number; z: number; r: number }[]): ReefLayout {
  return scatterReefBed(SEABED, LAGOON, seed, count, avoid);
}

/** The layout as the committed JSON (one copy per line). */
export function reefLayoutJson(layout: ReefLayout): string {
  return `{"items":[\n${layout.items.map((p) => JSON.stringify(p)).join(',\n')}\n],"school":${JSON.stringify(layout.school ?? null)}}\n`;
}
