import { PineSeedStream } from './seedStream';
import { pineTrailDistance } from './cragGround';
import { SPAWN, CABIN_SITES, POND, HAMLET, KINGS_CLEARING, DEN } from '../data/layout';
import { ridgeFootZ } from '../behaviour/layout';

interface HerdFact { kind: string; count: number; canopy: boolean; trailBand: [number, number]; anchor: { x: number; z: number; rMin: number; rMax: number }; variants?: string[] | undefined }
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
  const rng = new PineSeedStream((o.seed ^ 0x5eed) >>> 0);
  const usable = 2 * (o.half - margin);
  const n = Math.max(1, Math.floor(usable / spacing) + 1);
  const start = -((n - 1) * spacing) / 2;
  const roll = (td: number, allowEmpty: boolean, r: number): FaunaGroup | null => {
    const rows = o.groups.map(group => ({ group, weight: group.weight * (group.prefer?.(td) ?? 1) }));
    const total = rows.reduce((sum, row) => sum + Math.max(0, row.weight), 0) + (allowEmpty ? emptyW : 0);
    let remaining = r * total;
    for (const row of rows) { remaining -= Math.max(0, row.weight); if (remaining <= 0) return row.group; }
    return allowEmpty ? null : rows.at(-1)?.group ?? null;
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
    c.count = g ? g.count[0] + Math.floor((draws[i] ?? 0) * (g.count[1] - g.count[0] + 1)) : 0;
    out.push(c);
  });
  return out;
}

/** The generated HerdPlans (empty cells omitted). */
export function layoutFauna(o: FaunaLayoutOpts): HerdFact[] {
  const ring = o.ring ?? 20;
  const plans: HerdFact[] = [];
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

function pineHerdFacts(): HerdFact[] { return [
  ...layoutFauna({
    seed: 1337, half: 250, margin: 25, spacing: 56, jitter: 15, ring: 20,
    trailDistance: pineTrailDistance,
    avoid: [
      { x: POND.x, z: POND.z, r: POND.r + 12 },                          // the pond and its shore
      ...CABIN_SITES.map((c) => ({ x: c.x, z: c.z, r: 35 })),           // cabin pads (the manager's cabinMask reaches ~30 m)
      { x: SPAWN.x, z: SPAWN.z - 5, r: 60 },                              // the south-gate spawn
      { x: HAMLET.x, z: HAMLET.z, r: HAMLET.blend },                      // the mill hamlet
      { x: KINGS_CLEARING.x, z: KINGS_CLEARING.z, r: KINGS_CLEARING.blend }, // the King's arena (his thralls come at night)
      { x: DEN.x, z: DEN.z, r: 55 },                                      // bear country: the Den keeps its own
      ...[-215, -155, -95, -35, 25, 85, 135].map((x) => ({ x, z: ridgeFootZ(x) + 52, r: 34 })), // the ridge's crags
    ],
    emptyWeight: 10,
    groups: [
      { kind: 'deer', weight: 36, count: [3, 4], canopy: false, trailBand: [10, 25] },
      { kind: 'boar', weight: 32, count: [2, 3], canopy: true, trailBand: [12, 40] },
      { kind: 'elk', weight: 18, count: [2, 4], canopy: false, trailBand: [15, 40], prefer: (td) => (td >= 15 && td <= 40 ? 1.8 : 0.8) },
    ],
  }),
  // ── bears ── all three live in the Den (NW corner, layout v2; v1 had them at (−150, −150) = SE and (+150, −150) = SW):
  // the two black bears on the bowl's floor in front of the cave, the lone brown bear at its mouth toward the path.
  // Bears hunt you (see bear.ts).
  { kind: 'bear', count: 2, anchor: { x: DEN.x + 6, z: DEN.z + 6, rMin: 0, rMax: 10 }, canopy: false, trailBand: [18, 220], variants: ['black', 'black-blaze', 'black-old'] },
  { kind: 'bear', count: 1, anchor: { x: DEN.x - 8, z: DEN.z - 14, rMin: 0, rMax: 10 }, canopy: false, trailBand: [18, 220], variants: ['brown', 'brown-old'] },
]; }

/** Emit typed literal plans; native herd placement still owns every live actor. */
export function pineFaunaFiles(): Map<string, Uint8Array> {
  const rows = pineHerdFacts();
  const declaration = 'export const PINE_FAUNA: { kind: string; count: number; canopy: boolean; trailBand: [number, number]; anchor: { x: number; z: number; rMin: number; rMax: number }; variants?: string[] | undefined }[] = ';
  return new Map([['data/fauna.generated.ts', new TextEncoder().encode(`${declaration}${JSON.stringify(rows)};\n`)]]);
}
