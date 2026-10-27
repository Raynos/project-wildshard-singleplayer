import { expect, test } from 'vitest';
import { driftwoodEmittedProduct } from './fixtures/driftwood-emitted-product';
import { parseClientPlan } from '../src/format/clientPlan';
import { driftwoodMoverOwners } from '../src/shards/driftwood-isle/generators/moverOwners';
import { STATIC_BOAT } from '../src/shards/driftwood-isle/generators/staticWorld';
import { CLIENT_FEATURES } from '../src/game/shardfile/clientPlan';

test('the actual emitted mover row retains exact boat floats and original construction owners', async () => {
  const product = await driftwoodEmittedProduct(), plan = parseClientPlan(product.section('client/plan'));
  const movers = plan.features.find(row => row.kind === 'world.movers');
  expect(movers).toEqual({ kind: 'world.movers', ...driftwoodMoverOwners() });
  if (movers?.kind !== 'world.movers') throw new Error('Missing mover owner row');
  expect(movers.bindings[0]).toEqual({ id: 'driftwood.boat', kind: 'object', owner: 'boat', moor: {
    look: 'driftwood-kit-moor', water: STATIC_BOAT.spec.waterY, cleats: STATIC_BOAT.cleats } });
  expect(movers.bindings[1]).toEqual({ id: 'driftwood.bridge', kind: 'chain', owner: 'bridge.deck' });
  expect(plan.features.find(row => row.kind === 'world.runtime-hooks')).toEqual({
    kind: 'world.runtime-hooks', floor: 'piers.world-0', overhead: ['driftwood.gulls', 'driftwood.cover'], meleeSilent: true });
  expect(CLIENT_FEATURES['world.runtime-hooks'].phase).toBe('world-bindings');
  expect(CLIENT_FEATURES['world.runtime-hooks'].rank).toBeLessThan(CLIENT_FEATURES['world.movers'].rank);
}, 30000);


test('the admitted ambient row borrows the original draw after world bindings without a second file', async () => {
  const product = await driftwoodEmittedProduct(), plan = parseClientPlan(product.section('client/plan'));
  const row = { kind: 'world.ambient-life', file: 'actors/page-life.json', flocks: [{ id: 'gulls', owner: 'driftwood.gulls' }] };
  expect(plan.features.find(value => value.kind === 'world.ambient-life')).toEqual(row);
  expect(CLIENT_FEATURES['world.ambient-life'].phase).toBe('world-bindings');
  expect(CLIENT_FEATURES['world.ambient-life'].rank).toBeGreaterThan(CLIENT_FEATURES['world.movers'].rank);
  for (const flocks of [
    [{ id: 'gulls', owner: 'original' }, { id: 'other', owner: 'original' }],
    [{ id: 'gulls', owner: 'original' }, { id: 'gulls', owner: 'other' }],
  ]) expect(() => parseClientPlan({ version: 1, features: [{ ...row, flocks }] })).toThrow('unique ambient');
}, 30000);
