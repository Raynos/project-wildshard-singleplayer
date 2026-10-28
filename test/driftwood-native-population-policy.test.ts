import { expect, test } from 'vitest';
import page from '../src/shards/driftwood-isle/data/questPageComposition.json' with { type: 'json' };
import { validateDefinedJson } from '../src/sdk/sections';
import { encodeCanonicalJson } from '../src/sdk/immutable';
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


test('the quest page consumes only the exact native interaction projection', () => {
  const output = driftwoodOutputRows(DRIFTWOOD_LAYOUTS, DRIFTWOOD_ISLAND_FACTS, DRIFTWOOD_GUEST_ROWS);
  const read = (name: string): { readonly value: unknown; readonly bytes: Uint8Array } => {
    const file = output.namedFiles.find(row => row.name === name), bytes = file === undefined ? undefined : output.assets.get(file.hash);
    if (file?.jsonSchema === undefined || bytes === undefined) throw new Error('Missing actual emitted interaction source');
    validateDefinedJson(new TextEncoder().encode(encodeCanonicalJson(file.jsonSchema)), bytes);
    return { value: JSON.parse(new TextDecoder().decode(bytes)), bytes };
  };
  const original = read('sim/headless-assembly.json');
  const projection = read(page.files.assembly);
  const { constants } = v.parse(v.object({ constants: v.object({ interact: v.unknown(), interactSpots: v.unknown() }) }), original.value);
  expect(page.files.assembly).toBe('quests/interaction-source.json');
  expect(projection.value).toEqual({ constants: { interact: constants.interact, interactSpots: constants.interactSpots } });
  expect(projection.bytes.length).toBeLessThan(original.bytes.length / 20);
  const file = output.namedFiles.find(row => row.name === page.files.assembly);
  if (file?.jsonSchema === undefined) throw new Error('Missing quest wire grammar');
  const schema = new TextEncoder().encode(encodeCanonicalJson(file.jsonSchema));
  for (const value of [{ constants: { interact: constants.interact } }, { constants: { interact: constants.interact, interactSpots: constants.interactSpots }, extra: true }]) {
    expect(() => validateDefinedJson(schema, new TextEncoder().encode(encodeCanonicalJson(value)))).toThrow();
  }
});
