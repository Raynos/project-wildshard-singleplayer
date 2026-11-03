import { expect, test } from 'vitest';
import page from '../src/shards/driftwood-isle/data/questPageComposition.json' with { type: 'json' };
import spots from '../src/shards/driftwood-isle/data/spotsRows.json' with { type: 'json' };
import { DRIFTWOOD_INTERACT } from '../src/shards/driftwood-isle/generators/interactables';
import { validateDefinedJson } from '../src/sdk/sections';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { startQuestPageReads } from '../src/game/quest/pageReads';
import * as v from 'valibot';
import { ATTACK_TURN } from '../src/engine/ai/hunt';
import policy from '../src/shards/driftwood-isle/data/nativePopulationPolicy.json' with { type: 'json' };
import { driftwoodOutputRows } from '../src/shards/driftwood-isle/generators/output';
import { DRIFTWOOD_LAYOUTS } from './fixtures/driftwood-layout-source';
import { DRIFTWOOD_ISLAND_FACTS } from './fixtures/driftwood-island-facts';
import { DRIFTWOOD_GUEST_ROWS } from './fixtures/driftwood-guest-programs';
import { readDriftwoodNativeOracle } from './fixtures/driftwood-headless';

test('authored native population policy and fenced oracle retain the original native turn law', async () => {
  expect(policy).toEqual({ attackTurnCap: ATTACK_TURN });
  expect(policy.attackTurnCap).toBe(1.5);
  const output = driftwoodOutputRows(DRIFTWOOD_LAYOUTS, DRIFTWOOD_ISLAND_FACTS, DRIFTWOOD_GUEST_ROWS);
  const value = v.parse(v.object({ constants: v.object({ mixedPopulation: v.object({ attackTurnCap: v.literal(ATTACK_TURN) }) }) }), { constants: await readDriftwoodNativeOracle() });
  expect(output.namedFiles.some(row => row.name === 'sim/headless-assembly.json')).toBe(false);
  expect(value.constants.mixedPopulation.attackTurnCap).toBe(policy.attackTurnCap);
});


test('the quest page consumes only the exact native interaction projection', async () => {
  const output = driftwoodOutputRows(DRIFTWOOD_LAYOUTS, DRIFTWOOD_ISLAND_FACTS, DRIFTWOOD_GUEST_ROWS);
  const read = (name: string): { readonly value: unknown; readonly bytes: Uint8Array } => {
    const file = output.namedFiles.find(row => row.name === name), bytes = file === undefined ? undefined : output.assets.get(file.hash);
    if (file?.jsonSchema === undefined || bytes === undefined) throw new Error('Missing actual emitted interaction source');
    validateDefinedJson(new TextEncoder().encode(encodeCanonicalJson(file.jsonSchema)), bytes);
    return { value: JSON.parse(new TextDecoder().decode(bytes)), bytes };
  };
  const originalValue = { constants: await readDriftwoodNativeOracle() };
  const original = { value: originalValue, bytes: new TextEncoder().encode(encodeCanonicalJson(originalValue)) };
  const projection = read(page.files.assembly);
  const constants = { interact: DRIFTWOOD_INTERACT, interactSpots: spots.rows };
  expect(original.value).not.toHaveProperty('constants.interact');
  expect(original.value).not.toHaveProperty('constants.interactSpots');
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


test('the real quest input waits for its cold book with no full native book available', async () => {
  const output = driftwoodOutputRows(DRIFTWOOD_LAYOUTS, DRIFTWOOD_ISLAND_FACTS, DRIFTWOOD_GUEST_ROWS);
  const file = output.namedFiles.find(row => row.name === page.files.assembly);
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (file === undefined || bytes === undefined) throw new Error('Missing actual quest source');
  let finish: (value: Uint8Array) => void = () => { throw new Error('Cold source not initialized'); };
  const blocked = new Promise<Uint8Array>(resolve => { finish = resolve; });
  const requested: string[] = [];
  const product = createShardProduct({ slug: 'quest-cold', revision: 1,
    shardfile: emptyShardfile({ slug: 'quest-cold', name: 'Cold quest', author: 'Fixture', seed: 1, revision: 1 }), sections: new Map(),
    files: new Map(output.namedFiles.flatMap(row => row.name === undefined || row.name === 'sim/headless-assembly.json' ? [] : [[row.name, { hash: row.hash, url: row.name, ...(row.jsonSchema === undefined ? {} : { jsonSchema: row.jsonSchema }) }] as const])),
    jsonCheck: (schema, body) => Promise.resolve(validateDefinedJson(new TextEncoder().encode(encodeCanonicalJson(schema)), body)),
    read: hash => {
      requested.push(hash);
      if (hash === file.hash) return blocked;
      const body = output.assets.get(hash);
      if (body === undefined) return Promise.reject(new Error('Undeclared quest read'));
      return Promise.resolve(body);
    } });
  const reads = startQuestPageReads(product, page.files);
  let ready = false;
  const assembly = reads.assembly().then(value => { ready = true; return value; });
  await reads.discovery(); await reads.stall();
  expect(ready).toBe(false);
  expect(requested.filter(hash => hash === file.hash)).toHaveLength(1);
  finish(bytes);
  const expected = v.parse(v.object({ constants: v.object({ interact: v.unknown(), interactSpots: v.unknown() }) }), JSON.parse(new TextDecoder().decode(bytes)));
  expect(await assembly).toEqual(expected.constants);
  expect(await reads.assembly()).toEqual(expected.constants);
  expect(requested.filter(hash => hash === file.hash)).toHaveLength(1);
});
