import { DRIFTWOOD_LAYOUTS } from './fixtures/driftwood-layout-source';
import { expect, test } from 'vitest';
import { namedJsonSchema } from '../src/sharddev/formatJsonSchema';
import { QuestWorldSchema } from '@wildshard/format/questWorld';
import { driftwoodQuestWorld } from '../src/shards/driftwood-isle/generators/questWorld';
import { validateNamedJsonSchema } from '../src/game/shared/shardfile/customSchema';

const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

test('the defining named quest world schema preserves the original anchors and POI order', () => {
  const rows = driftwoodQuestWorld(DRIFTWOOD_LAYOUTS);
  expect(validateNamedJsonSchema(namedJsonSchema(QuestWorldSchema), encode(rows))).toEqual(rows);
  expect(Object.keys(rows.pois)).toEqual(['hut', 'lookout', 'wreck', 'shrine', 'cave']);
});

test('named quest world admission refuses reflected paths and invalid anchor values', () => {
  const rows = driftwoodQuestWorld(DRIFTWOOD_LAYOUTS);
  for (const bad of [{ ...rows, path: ['world', 'pois'] },
    { ...rows, pois: { hut: { anchors: { door: { x: 'wrong', y: 0, z: 0, yaw: 0 } } } } },
    { ...rows, pois: { hut: { anchors: { door: { x: 0, y: 0, z: 0, yaw: Infinity } } } } }])
    expect(() => validateNamedJsonSchema(namedJsonSchema(QuestWorldSchema), encode(bad))).toThrow();
});
