import { expect, test } from 'vitest';
import * as v from 'valibot';
import { enemyPlacements } from '../src/shards/driftwood-isle/generators/enemyPlacement';
import { EnemyPlacementsSchema } from '../src/shards/driftwood-isle/generators/sections';
import physics from '../src/shards/driftwood-isle/data/physics.generated.json' with { type: 'json' };
import { driftwoodNativeRows } from '../src/shards/driftwood-isle/generators/nativeBake';
import { Rng } from '../src/engine/core/rng';
// The original placeEnemies output for the same seed, crab sites, palms and floors (phone / desktop page tiers, native bake).
import frozen from './fixtures/legacy-oracles/driftwood-enemy-placement.json' with { type: 'json' };

test('native bake generation refuses divergent recipes and floor metadata', () => {
  const first = physics.actors[0];
  if (first === undefined) throw new Error('Missing authored native actor');
  expect(() => driftwoodNativeRows({ ...physics, actors: [{ ...first, kind: 'foreign' }] })).toThrow('Divergent native actor');
  expect(() => driftwoodNativeRows({ ...physics, actors: [first, { ...first, id: 'fixture.other', spec: { ...first.spec, hp: first.spec.hp + 1 } }] })).toThrow('Divergent native Driftwood spec');
  expect(() => driftwoodNativeRows({ ...physics, ground: { ...physics.ground, scale: { ...physics.ground.scale, y: 2 } } })).toThrow('ground lattice');
  expect(() => driftwoodNativeRows({ ...physics, habitat: { ...physics.habitat, hold: { ...physics.habitat.hold, floor: physics.habitat.hold.floor.slice(1) } } })).toThrow('not square');
  expect(() => driftwoodNativeRows({ ...physics, captain: { ...physics.captain, spec: { ...physics.captain.spec, variant: 'foreign' } } })).toThrow('captain spec');
});

test('offline placements retain the frozen page/native populations, herds, yaw and coconut stream', () => {
  const actual = v.parse(EnemyPlacementsSchema, structuredClone(enemyPlacements()));
  for (const [rows, expected] of [[actual.page.phone, frozen.phone], [actual.page.desktop, frozen.desktop], [actual.native, frozen.native]] as const) {
    expect(rows.enemies).toEqual(expected.enemies);
    expect(rows.herds).toBe(expected.herds); expect(rows.centres).toEqual(expected.centres);
    expect(rows.stream).toEqual(expected.stream);
    const restored = new Rng(0); restored.restore(rows.stream);
    expect(Array.from({ length: 40 }, () => restored.next())).toEqual(expected.next40);
    expect(rows.kinds.length).toBe(rows.centres.length);
  }
});
