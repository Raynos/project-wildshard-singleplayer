import foliage from '../data/foliagePlacements.generated.json' with { type: 'json' };
import physics from '../data/physics.generated.json' with { type: 'json' };
import { terrainTileHeight } from '@wildshard/format/terrainTileBytes';
import { driftwoodGroundSampler } from './groundSampling';
import { Rng } from '@wildshard/engine/core/rng';
import { sampleCreatureGroup, selectCreatureSites } from '@wildshard/game/plugin/brain';
import { ENEMY_COUNTS } from './fauna';

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
    const s = inputs.crabSites[k], n = rng.int(...ENEMY_COUNTS.tidepool), herd = herds++;
    if (s === undefined || n > MAX_GROUP) throw new Error('Driftwood crab group exceeds its bound');
    at.push({ x: s.x, z: s.z });kinds.push('crab');
    out.push(...sampleCreatureGroup({ kind: 'crab', count: n, herd, variant: 'small', firstVariant: 'big',
      source: { kind: 'radial', centre: s, radius: [1.2, 2.8], firstAtCentre: true }, accept: { minHeight: inputs.waterLevel + .15 } }, rng, { heightAt: inputs.heightAt }));
  }
  if(practice!==null){out.push({ kind: 'crab', variant: 'small', x: practice.x, z: practice.z, yaw: 0, herd: herds++, practice: true });
  at.push({ x: practice.x, z: practice.z });kinds.push('crab');}
  const centres = selectCreatureSites(palms, { count: troops, separation: 45 }, p => {
    if (Math.hypot(p.x - spawn.x, p.z - spawn.z) < 60 || Math.hypot(p.x - WRECK_SITE.x, p.z - WRECK_SITE.z) < 30) return null;
    const density = palms.filter(q => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 10).length;
    return density >= 3 ? density : null;
  }).map(row => row.site);
  for (let k = 0; k < Math.min(centres.length, troops, MAX_GROUP); k++) {
    const c = centres[k]; if (c === undefined) continue;
    const grove = palms.filter((p) => Math.hypot(p.x - c.x, p.z - c.z) < 10);
    const n = Math.min(grove.length, rng.int(...ENEMY_COUNTS.grove)), herd = herds++;
    at.push({ x: c.x, z: c.z });kinds.push('monkey');
    out.push(...sampleCreatureGroup({ kind: 'monkey', count: n, herd, variant: null, source: { kind: 'indexed', points: grove } }, rng));
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

/** Offline policy execution only; play consumes rows and the post-placement RNG continuation. */
type ColdPlacement = Omit<ReturnType<typeof placeEnemies>, 'stream'> & { stream: ReturnType<Rng['snapshot']> };
export function enemyPlacements(): { seed: number; practice: typeof PRACTICE_AT; hold: ReturnType<typeof holdCentre>; page: Record<'phone' | 'desktop', ColdPlacement>; native: ColdPlacement } {
  const seed = foliage.seed, waterLevel = 0;
  const pack = (inputs: EnemyPlacementInputs) => {
    const { stream, ...rows } = placeEnemies(inputs);
    return { ...rows, stream: stream.snapshot() };
  };
  const extra = physics.habitat.perchBases.slice(foliage.tiers.phone.palms.specs.length);
  if (extra.length !== 24) throw new Error('Enemy placement requires the authored Blender palms');
  const heightAt = driftwoodGroundSampler();
  const page = (tier: 'phone' | 'desktop') => pack({ seed, waterLevel, heightAt,
    crabSites: physics.habitat.crabSites, palms: [...foliage.tiers[tier].palms.specs, ...extra] });
  const bytes = Uint8Array.from(atob(physics.ground.heights), byte => byte.codePointAt(0) ?? 0);
  const heights = new Float32Array(bytes.buffer);
  const nativeHeight = (x: number, z: number): number => terrainTileHeight({ resolution: 256, x: -250, z: -250, size: 500, heights }, x, z,
    { layout: 'column-major', boundary: 'clamp' });
  return { seed, practice: PRACTICE_AT, hold: holdCentre(), page: { phone: page('phone'), desktop: page('desktop') },
    native: pack({ seed, waterLevel, heightAt: nativeHeight, crabSites: physics.habitat.crabSites, palms: physics.habitat.perchBases }) };
}
