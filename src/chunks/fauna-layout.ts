import { Rng } from '../core/rng';
import type { HerdPlan } from './ChunkDef';

/**
 * Fauna layout — MANY SMALL GROUPS SPREAD OVER THE WHOLE SHARD, instead of a few big herds.
 *
 * The user's complaint: "triple the enemies" once became nine boars in one clearing and nothing for 200 m
 * around it. So a shard's `fauna` block is generated: a grid of anchor cells ~`spacing` m apart covers the
 * chunk (`margin` m inside the edge), cells over water / cabin pads / the spawn gate are dropped (`avoid`),
 * each cell is jittered by ±`jitter` m with the shard seed, and each gets ONE small group by a weighted roll
 * over `groups` (or stays empty with `emptyWeight`). A group's `prefer(trailDist)` can bias the roll by the
 * cell's distance to the nearest trail (elk like the clearings 15–40 m off a trail).
 *
 * Every group becomes an anchored HerdPlan (ring 0..`ring` m around the cell): the AnimalManager still does
 * the fine placement (clearing vs canopy, dry ground, off the trail) and spaces anchored herds by that ring
 * (20 m) rather than the 60 m it keeps between free-roaming plans. The group's `trailBand` semantics stay:
 * its lower bound holds (nothing spawns ON a trail), the upper bound is widened to reach the cell when the
 * cell sits far from every trail, so the corners of the shard are populated too.
 *
 *   fauna: [
 *     ...layoutFauna({ seed, half: CHUNK_HALF, trailDistance: TERRAIN.trailDistance, avoid: [...], groups: [...] }),
 *     // fixed dens / special herds appended by hand
 *   ]
 */

export interface FaunaGroup {
  kind: string;
  /** relative roll weight (any positive number) */
  weight: number;
  /** animals per group, inclusive [min, max] */
  count: [number, number];
  canopy: boolean;
  trailBand: [number, number];
  variants?: string[];
  /** optional multiplier on `weight` from the cell's distance to the nearest trail (1 = no preference) */
  prefer?: (trailDist: number) => number;
}

export interface FaunaLayoutOpts {
  seed: number;
  /** half the chunk size (CHUNK_HALF) */
  half: number;
  /** metres inside the chunk edge the grid stays (default 25) */
  margin?: number;
  /** metres between grid cells (default 60) */
  spacing?: number;
  /** ± metres of seeded jitter per cell (default 15) */
  jitter?: number;
  /** the HerdPlan anchor ring the manager searches around the cell (default 20) */
  ring?: number;
  /** discs no cell may fall in: the pond, cabin pads, the spawn gate */
  avoid?: { x: number; z: number; r: number }[];
  trailDistance: (x: number, z: number) => number;
  groups: FaunaGroup[];
  /** weight of "nothing here" in the roll (default 0) */
  emptyWeight?: number;
}

/** One cell of the layout — returned by `layoutFaunaCells` for tests / the dev overlay. */
export interface FaunaCell { x: number; z: number; trailDist: number; group: FaunaGroup | null; count: number }

export function layoutFaunaCells(o: FaunaLayoutOpts): FaunaCell[] {
  const margin = o.margin ?? 25, spacing = o.spacing ?? 60, jitter = o.jitter ?? 15, emptyW = o.emptyWeight ?? 0;
  const rng = new Rng((o.seed ^ 0x5eed) >>> 0);
  const usable = 2 * (o.half - margin);
  const n = Math.max(1, Math.floor(usable / spacing) + 1);
  const start = -((n - 1) * spacing) / 2;
  const roll = (td: number, allowEmpty: boolean, r: number): FaunaGroup | null => {
    const weights = o.groups.map((g) => Math.max(0, g.weight * (g.prefer ? g.prefer(td) : 1)));
    const total = weights.reduce((a, b) => a + b, 0) + (allowEmpty ? emptyW : 0);
    let acc = r * total;
    for (let i = 0; i < o.groups.length; i++) { acc -= weights[i]; if (acc <= 0) return o.groups[i]; }
    return null;
  };
  const cells: (FaunaCell | null)[] = [];   // null = skipped (in an avoid disc)
  const draws: number[] = [];
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    // every cell draws the same number of random values whether it is used or not, so an avoid-disc
    // change does not reshuffle the rest of the shard
    const x = start + ix * spacing + rng.range(-jitter, jitter);
    const z = start + iz * spacing + rng.range(-jitter, jitter);
    const r = rng.next(), cnt = rng.next();
    draws.push(cnt);
    if (o.avoid?.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) { cells.push(null); continue; }
    const td = o.trailDistance(x, z);
    const group = roll(td, true, r);
    cells.push({ x, z, trailDist: td, group, count: 0 });
  }
  // no holes: an empty cell next to another empty (or skipped) cell would leave a ~200 m stretch of nothing,
  // which is exactly the "empty forest" complaint — such a cell gets a group after all (rolled without 'empty')
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const c = cells[iz * n + ix];
    if (!c || c.group) continue;
    const gap = (jx: number, jz: number) => jx < 0 || jz < 0 || jx >= n || jz >= n ? false : !cells[jz * n + jx]?.group;
    if (gap(ix - 1, iz) || gap(ix + 1, iz) || gap(ix, iz - 1) || gap(ix, iz + 1)) c.group = roll(c.trailDist, false, rng.next());
  }
  const out: FaunaCell[] = [];
  cells.forEach((c, i) => {
    if (!c) return;
    const g = c.group;
    c.count = g ? g.count[0] + Math.floor(draws[i] * (g.count[1] - g.count[0] + 1)) : 0;
    out.push(c);
  });
  return out;
}

/** The generated HerdPlans (empty cells omitted). */
export function layoutFauna(o: FaunaLayoutOpts): HerdPlan[] {
  const ring = o.ring ?? 20;
  const plans: HerdPlan[] = [];
  for (const c of layoutFaunaCells(o)) {
    if (!c.group || c.count <= 0) continue;
    const g = c.group;
    plans.push({
      kind: g.kind, count: c.count, canopy: g.canopy, variants: g.variants,
      anchor: { x: Math.round(c.x), z: Math.round(c.z), rMin: 0, rMax: ring },
      // keep the group off the trail (lower bound) but let it reach a cell that sits far from every trail
      trailBand: [g.trailBand[0], Math.max(g.trailBand[1], Math.ceil(c.trailDist + ring + 10))],
    });
  }
  return plans;
}
