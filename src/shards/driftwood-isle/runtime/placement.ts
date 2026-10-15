import { Rng } from '@wildshard/engine/core/rng';
import { enemyCount } from '../creatures/tables';

/** manifest.ts's `WRECK` site and heading, `PRACTICE_CRAB` and the troops' default keep-away point (creatures/Enemies.ts),
 *  spelled here because the manifest imports views; test/shards/driftwood-isle/physics-bake.test.ts holds them equal. */
export const WRECK_SITE = { x: 153, z: 2, heading: 2.7 } as const;
export const PRACTICE_AT = { x: -7, z: -143 } as const;
const TROOP_SPAWN = { x: 0, z: -235 } as const, TROOPS = 3;
/** the loops' static bounds (runtime-performance): far above the island's 2 sites, 228 palms and 3–5 per group */
const MAX_SITES = 16, MAX_PALMS = 1024, MAX_GROUP = 16;

/** One enemy as `creatures/Enemies.ts` places it: kind, variant (null: the manager rolls it), point, yaw, herd slot. */
export interface EnemyPlacement {
  readonly kind: 'crab' | 'monkey' | 'sailor';
  readonly variant: string | null;
  readonly x: number; readonly z: number; readonly yaw: number;
  /** index into this placement's herds (crab groups, the practice crab, troops); −1: none (the sailor) */
  readonly herd: number;
  readonly practice?: true;
}
export interface EnemyPlacementInputs {
  /** level seed (the engine's SEED for this level: the manifest's `seed`) */
  readonly seed: number;
  /** Cove.forIsland().crabSites */
  readonly crabSites: readonly { readonly x: number; readonly z: number }[];
  /** every palm's base, in Palms order (the monkey perches' bases) */
  readonly palms: readonly { readonly x: number; readonly z: number }[];
  /** the ground and the still sea: a crab whose point is not 0.15 m above the sea is skipped */
  readonly heightAt: (x: number, z: number) => number;
  readonly waterLevel: number;
  /** Page content may omit the practice crab or sailor; native defaults retain the full island. */
  readonly practice?: { readonly x:number;readonly z:number } | null;
  readonly spawn?: { readonly x:number;readonly z:number };
  readonly troops?: number;
  readonly sailor?: boolean;
}

/**
 * Driftwood's enemies placed exactly as `creatures/Enemies.ts` `build()` places them, renderer-free (SF72): the crab
 * groups at the tidepools (one big, the rest small, `enemyCount('tidepool')`), the lone practice crab, the monkey troops in
 * the densest palm groves (≥ 60 m from the spawn, ≥ 30 m from the wreck, ≥ 45 m apart) and the sailor in the wreck's
 * hold, all from the placement stream `Rng(SEED ^ 0xe11e)`. The bodies' own draws (scale, seeds, variants) are the
 * creature manager's stream, not this one. `centres` is each herd's `addHerd` point (the tidepool, the practice spot, the
 * troop's grove palm). `stream` is the placement stream past placement, which spins each thrown coconut (Enemies.ts draws its own copy of it).
 */
export function placeEnemies(inputs: EnemyPlacementInputs): { enemies: EnemyPlacement[]; herds: number; centres: { x: number; z: number }[]; kinds: ('crab'|'monkey')[]; stream: Rng } {
  const rng = new Rng(inputs.seed ^ 0xe11e), out: EnemyPlacement[] = [], palms = inputs.palms, at: { x: number; z: number }[] = [];
  if (inputs.crabSites.length > MAX_SITES || palms.length > MAX_PALMS) throw new Error('Driftwood placement inputs exceed their bounds');
  let herds = 0;
  const kinds: ('crab'|'monkey')[] = [], practice=inputs.practice===undefined?PRACTICE_AT:inputs.practice;
  const spawn=inputs.spawn??TROOP_SPAWN, troops=inputs.troops??TROOPS;
  if(!Number.isSafeInteger(troops)||troops<0||troops>MAX_GROUP)throw new Error('Driftwood troop count exceeds its bound');
  for (let k = 0; k < Math.min(inputs.crabSites.length, MAX_SITES); k++) {
    const s = inputs.crabSites[k], n = enemyCount('tidepool', () => rng.next()), herd = herds++;
    if (s === undefined || n > MAX_GROUP) throw new Error('Driftwood crab group exceeds its bound');
    at.push({ x: s.x, z: s.z });kinds.push('crab');
    for (let i = 0; i < Math.min(n, MAX_GROUP); i++) {
      const ang = rng.range(0, Math.PI * 2), r = i === 0 ? 0 : rng.range(1.2, 2.8);
      const x = s.x + Math.cos(ang) * r, z = s.z + Math.sin(ang) * r;
      if (inputs.heightAt(x, z) < inputs.waterLevel + 0.15) continue;
      out.push({ kind: 'crab', variant: i === 0 ? 'big' : 'small', x, z, yaw: rng.range(0, Math.PI * 2), herd });
    }
  }
  if(practice!==null){out.push({ kind: 'crab', variant: 'small', x: practice.x, z: practice.z, yaw: 0, herd: herds++, practice: true });
  at.push({ x: practice.x, z: practice.z });kinds.push('crab');}
  if (palms.length >= 4) {
    // grove density: neighbours within 10 m
    const score = palms.map((p) => palms.filter((q) => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 10).length);
    const order = palms.map((_, i) => i).filter((i) => (score[i] ?? 0) >= 3).sort((a, b) => (score[b] ?? 0) - (score[a] ?? 0));
    const centres: { x: number; z: number }[] = [];
    for (let k = 0; k < Math.min(order.length, MAX_PALMS); k++) {
      const p = palms[order[k] ?? -1];
      if (p === undefined) continue;
      if (centres.length >= troops) break;
      if (Math.hypot(p.x - spawn.x, p.z - spawn.z) < 60) continue;
      if (Math.hypot(p.x - WRECK_SITE.x, p.z - WRECK_SITE.z) < 30) continue;
      if (centres.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 45)) continue;
      centres.push(p);
    }
    for (let k = 0; k < Math.min(centres.length, troops, MAX_GROUP); k++) {
      const c = centres[k]; if (c === undefined) continue;
      const grove = palms.filter((p) => Math.hypot(p.x - c.x, p.z - c.z) < 10);
      const n = Math.min(grove.length, enemyCount('grove', () => rng.next())), herd = herds++;
      if (n > MAX_GROUP) throw new Error('Driftwood troop exceeds its bound');
      at.push({ x: c.x, z: c.z });kinds.push('monkey');
      for (let i = 0; i < Math.min(n, MAX_GROUP); i++) {
        const p = grove[i];
        if (p === undefined) continue;
        out.push({ kind: 'monkey', variant: null, x: p.x, z: p.z, yaw: rng.range(0, Math.PI * 2), herd });
      }
    }
  }
  // the hold (Wreck.ts hull frame: local x starboard, z stern): the sailor rises 2 m forward of the iron sword
  const h = WRECK_SITE.heading, cs = Math.cos(h), sn = Math.sin(h);
  if(inputs.sailor!==false)out.push({ kind: 'sailor', variant: 'sailor', x: WRECK_SITE.x + 0.5 * cs + 2.2 * sn, z: WRECK_SITE.z - 0.5 * sn + 2.2 * cs, yaw: h + Math.PI, herd: -1 });
  return { enemies: out, herds, centres: at, kinds, stream: rng };
}

/** The wreck hold's centre (Enemies.ts `habitat.hold`): local (0, 3.2) in the hull frame. */
export function holdCentre(): { x: number; z: number } {
  const h = WRECK_SITE.heading;
  return { x: WRECK_SITE.x + 3.2 * Math.sin(h), z: WRECK_SITE.z + 3.2 * Math.cos(h) };
}
