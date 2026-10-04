import { terrainFor, hitDamage } from '../src/game/shard/manifest';
// E294: Driftwood caps every enemy hit at 20 of the player's 100 health (ShardManifest.maxHitDamage → hitDamage), so any common
// enemy needs ~5 hits to kill you; the other shards stay uncapped. And the brown bear lives off the quest paths.
import { describe, expect, it } from 'vitest';
import { loadSpecies } from './species';
import { SHARDS } from '../src/shards.generated';
import { playable, findChunk } from '../src/game/shard/registry';
import { DRIFTWOOD_ISLE, PATHS, WRECK, SHRINE, HUT, LOOKOUT, OCEAN } from '../src/shards/driftwood-isle/manifest';
import { speciesDef, variantMods } from '../src/engine/entities/species/registry';

const PLAYABLE_SHARDS = SHARDS.filter(playable);

loadSpecies();
const HEALTH = 100;
/** every hit a Driftwood enemy can land: each variant's charge / swing / snap / bite */
const DRIFTWOOD_ENEMIES = ['boar', 'bear', 'crab', 'monkey', 'sailor', 'captain'];
/** kinds Driftwood lets past the cap (Jake, 2026-09-30: the Drowned Captain, the final boss) */
const EXEMPT = new Set(['captain']);
const hits = (kind: string): { id: string; dmg: number }[] => {
  const s = speciesDef(kind);
  return [...s.variants, ...(s.spawnOnly ?? [])].map((v) => ({ id: `${kind}/${v.id}`, dmg: variantMods(s, v).chargeDamage }));
};

describe('hitDamage (E294)', () => {
  it('caps at the shard maxHitDamage and passes a smaller hit through', () => {
    expect(hitDamage({ fight: { maxHitDamage: 20 } }, 45)).toBe(20);
    expect(hitDamage({ fight: { maxHitDamage: 20 } }, 14)).toBe(14);
    expect(hitDamage({}, 45)).toBe(45);
    expect(hitDamage({ fight: { maxHitDamage: 20, capExempt: ['captain'] } }, 24, 'captain')).toBe(24);
    expect(hitDamage({ fight: { maxHitDamage: 20, capExempt: ['captain'] } }, 45, 'bear')).toBe(20);
  });

  it('Driftwood: the Drowned Captain (the final boss) swings past the cap', () => {
    for (const h of hits('captain')) expect(hitDamage(DRIFTWOOD_ISLE, h.dmg, 'captain'), h.id).toBe(h.dmg);
  });

  it('Driftwood: no enemy hit takes more than 20 % of your health, so every enemy needs at least 5 hits', () => {
    expect(DRIFTWOOD_ISLE.fight?.maxHitDamage).toBe(20);
    for (const kind of DRIFTWOOD_ENEMIES) for (const h of hits(kind)) {
      if (EXEMPT.has(kind)) continue;
      const d = hitDamage(DRIFTWOOD_ISLE, h.dmg, kind);
      expect(d, h.id).toBeLessThanOrEqual(HEALTH * 0.2);
      expect(Math.ceil(HEALTH / d), h.id).toBeGreaterThanOrEqual(5);
    }
    // the audit's numbers: the brown bear 45 → 20, the boars 25 / 32 / 40 → 20, the drowned sailor's cutlass 14
    const bear = hits('bear').find((h) => h.id === 'bear/brown');
    expect(bear?.dmg).toBe(45);
    expect(hitDamage(DRIFTWOOD_ISLE, bear?.dmg ?? 0)).toBe(20);
    expect(hits('boar').map((h) => hitDamage(DRIFTWOOD_ISLE, h.dmg))).toEqual(hits('boar').map(() => 20));
    expect(hits('sailor').map((h) => hitDamage(DRIFTWOOD_ISLE, h.dmg))).toEqual([14]);
  });

  it('the other shards are not capped (a brown bear still hits Pine Hollow for 45)', () => {
    for (const c of PLAYABLE_SHARDS) if (c.slug !== 'driftwood-isle') expect(c.fight?.maxHitDamage, c.slug).toBeUndefined();
    const pine = findChunk('pine-hollow');
    expect(pine).toBeDefined();
    if (pine) expect(hitDamage(pine, 45)).toBe(45);
  });
});

describe('the brown bear (E294)', () => {
  const plan = DRIFTWOOD_ISLE.spawns.find((p) => p.kind === 'bear' && p.variants?.includes('brown') === true);
  const black = DRIFTWOOD_ISLE.spawns.find((p) => p.kind === 'bear' && p.variants?.includes('black') === true);
  const segDist = (x: number, z: number, [ax, az]: [number, number], [bx, bz]: [number, number]): number => {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
  };

  it('lives inland, off every quest path and away from the wreck, the POIs and the black bear', () => {
    const a = plan?.anchor, b = black?.anchor;
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    if (!a || !b) return;
    const far = a.rMax; // the farthest it can spawn from its anchor
    const pathD = Math.min(...PATHS.flatMap((p) => p.slice(1).map((q, i) => segDist(a.x, a.z, p[i] ?? q, q))));
    expect(pathD - far).toBeGreaterThan(45); // past a bear's 45 m sight range from any sand path
    for (const poi of [WRECK, SHRINE, HUT, LOOKOUT]) expect(Math.hypot(poi.x - a.x, poi.z - a.z) - far).toBeGreaterThan(45);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(120);
    expect(terrainFor(DRIFTWOOD_ISLE).heightAt(a.x, a.z) - OCEAN.level).toBeGreaterThan(3.4); // above the beach berm: grass, not sand
  });
});
