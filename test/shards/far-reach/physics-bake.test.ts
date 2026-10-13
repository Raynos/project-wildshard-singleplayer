import { expect, it } from 'vitest';
import baked from '../../../src/shards/far-reach/data/physics.generated.json';
import rows from '../../../src/shards/far-reach/data/physicsRows.json';
import { skyPhysics } from '../../../src/shards/far-reach/generators/physics';
import { SKY_SPAWNS } from '../../../src/shards/far-reach/data/spawns';
import { Rng } from '../../../src/engine/core/rng';
import source from '../../../src/shards/far-reach/shard.config';
import { speciesScales } from '../../../src/game/plugin/brain';
import { DRIFT_RAY_DATA, GALE_WISP_DATA, SKY_GOAT_DATA, STORM_ROC_DATA } from '../../../src/shards/far-reach/data/species';

it('is the fresh product of the authored rows (G350-FR: generators/physics.ts, no runtime run)', () => {
  expect(JSON.stringify(skyPhysics())).toBe(JSON.stringify(baked));
  expect(baked.version).toBe(1);
  expect(baked.notice).toContain('DO NOT EDIT');
  expect(rows.seed).toBe(source.identity.seed);
});

it('holds each authored species spec and scale range to its species row', () => {
  for (const row of [DRIFT_RAY_DATA, SKY_GOAT_DATA, GALE_WISP_DATA, STORM_ROC_DATA]) {
    const variant = row.variants[0], authored = Object.entries(rows.species).find(([kind]) => kind === row.kind)?.[1];
    if (variant === undefined || authored === undefined) throw new Error(`no authored species row for ${row.kind}`);
    expect(authored.scale).toEqual(variant.scale);
    expect(authored.spec).toMatchObject({ kind: row.kind, label: variant.label, variant: variant.id, rarity: variant.rarity, hp: variant.hp, aggressive: row.aggressive });
    expect(Reflect.get(authored.spec, 'flight')).toEqual(row.flight);
  }
});

it('captures every declared finite actor and the actual layered native world, including disabled traversal', () => {
  expect(baked.actors.map(actor => actor.id).sort()).toEqual([...SKY_SPAWNS.actors, ...SKY_SPAWNS.bosses].map(actor => actor.id).sort());
  expect(new Set(baked.actors.map(actor => actor.id)).size).toBe(13);
  for (const actor of baked.actors) {
    expect(actor.spec.hp).toBeGreaterThan(0); expect(actor.spec.dims.bodyRadius).toBeGreaterThan(0);
    expect(Number.isFinite(actor.seed)).toBe(true); expect(actor.scale).toBeGreaterThan(0);
  }
  expect(baked.pieces.filter(piece => piece.id.startsWith('far.isle.'))).toHaveLength(12);
  expect(baked.pieces.find(piece => piece.id === 'far.bridge.crown')?.active).toBe(false);
  expect(baked.pieces.find(piece => piece.id === 'far.updraft')?.active).toBe(false);
  expect(baked.pieces.some(piece => piece.colliders.some(collider => collider.kind === 'hull'))).toBe(true);
});
it('reproduces the browser seeds and scales from the creature manager stream: six draws per spawn, in shipping order', () => {
  // AnimalManager: one private Rng(level seed + 31), the level's seed (the shardfile's 6417, not the engine's default) installed
  // before the manager is built; a named variant draws no roll, then scale, rig seed, actor seed, and the brain's timer, fleeUntil
  // and callT. The eight flyers spawn in play (ray, roost rays, wisps, Roc), the five goats on the first fixed step after them.
  expect(source.identity.seed).toBe(6417);
  const rng = new Rng(source.identity.seed + 31), ranges = speciesScales([DRIFT_RAY_DATA, SKY_GOAT_DATA, GALE_WISP_DATA, STORM_ROC_DATA]);
  expect(baked.actors.map(actor => actor.id)).toEqual(['far.ray.0', 'far.roost.0', 'far.roost.1', 'far.roost.2', 'far.wisp.0', 'far.wisp.1', 'far.wisp.2', 'far.roc',
    'far.goat.0', 'far.goat.1', 'far.goat.2', 'far.goat.3', 'far.goat.4']);
  for (const actor of baked.actors) {
    const range = ranges.get(actor.spec.kind); if (range === undefined) throw new Error(`no species row for ${actor.spec.kind}`);
    const scale = rng.range(range[0], range[1]); rng.next(); const seed = rng.next(); rng.next(); rng.next(); rng.next();
    expect([actor.id, scale, seed]).toEqual([actor.id, actor.scale, actor.seed]);
  }
});
