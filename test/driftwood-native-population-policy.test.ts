import { expect, test } from 'vitest';
import * as v from 'valibot';
import { ATTACK_TURN } from '../src/engine/ai/hunt';
import policy from '../src/shards/driftwood-isle/data/nativePopulationPolicy.json' with { type: 'json' };
import { driftwoodOutputRows } from '../src/shards/driftwood-isle/generators/output';
import { DRIFTWOOD_LAYOUTS } from './fixtures/driftwood-layout-source';
import { DRIFTWOOD_ISLAND_FACTS } from './fixtures/driftwood-island-facts';
import { DRIFTWOOD_GUEST_ROWS } from './fixtures/driftwood-guest-programs';

test('authored native population policy and emitted value retain the original native turn law', () => {
  expect(policy).toEqual({ attackTurnCap: ATTACK_TURN });
  expect(policy.attackTurnCap).toBe(1.5);
  const output = driftwoodOutputRows(DRIFTWOOD_LAYOUTS, DRIFTWOOD_ISLAND_FACTS, DRIFTWOOD_GUEST_ROWS);
  const file = output.namedFiles.find(row => row.name === 'sim/headless-assembly.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing real emitted headless assembly');
  const value = v.parse(v.object({ constants: v.object({ mixedPopulation: v.object({ attackTurnCap: v.literal(ATTACK_TURN) }) }) }), JSON.parse(new TextDecoder().decode(bytes)));
  expect(value.constants.mixedPopulation.attackTurnCap).toBe(policy.attackTurnCap);
});
