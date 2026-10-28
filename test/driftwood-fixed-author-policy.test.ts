import { expect, expectTypeOf, test } from 'vitest';
import { HORIZON_RADIUS } from '../src/format/contentBounds';
import { SHORE_REVETMENT_INNER_FACE } from '../src/engine/sim/shore';
import type { ColliderDesc } from '../src/engine/world/registry';
import { OCEAN_LIMITS } from '../src/shards/driftwood-isle/generators/oceanLook';
import type { pierColliders } from '../src/shards/driftwood-isle/generators/pierColliders';
import { driftwoodOceanObservation } from './fixtures/driftwood-ocean-observation';
import original from './fixtures/driftwood-ocean-policy-original.json' with { type: 'json' };

test('authored sea policy and pier contacts retain their complete native contracts', () => {
  expect(OCEAN_LIMITS).toEqual({ edgeInset: SHORE_REVETMENT_INNER_FACE, seaEnd: HORIZON_RADIUS });
  expectTypeOf<ReturnType<typeof pierColliders>[number]>().toEqualTypeOf<ColliderDesc>();
});

test('the complete original sea row and every grid/floor byte retain their names and hashes', () => {
  expect(driftwoodOceanObservation()).toEqual(original);
});
