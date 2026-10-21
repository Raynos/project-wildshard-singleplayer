import { expect, test } from 'vitest';
import { output as pine } from '../src/shards/pine-hollow/generators/output';
import { output as driftwood } from '../src/shards/driftwood-isle/generators/output';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
for (const [name, output] of [['pine', pine], ['driftwood', driftwood]] as const) {
  test(`${name}: named quest services and achievements admit before entered owners run`, () => {
    for (const fileName of ['quests/services.json', 'quests/achievements.json']) {
      const file = output.namedFiles.find(row => row.name === fileName);
      const bytes = file === undefined ? undefined : output.assets.get(file.hash);
      if (file === undefined || bytes === undefined || file.jsonSchema === undefined) throw new Error(`Missing defining quest schema: ${fileName}`);
      expect(validateNamedJsonSchema(file.jsonSchema, bytes)).toEqual(JSON.parse(new TextDecoder().decode(bytes)));
      const bad = fileName === 'quests/services.json'
        ? { version: 1, actions: [{ id: 'foreign', effects: [{ kind: 'call', name: 'unbound' }] }] }
        : { feats: [{ id: 'impossible', count: 0 }], flags: [], prefix: '', floorTotals: true, validateTotals: true, write: 'each' };
      expect(() => validateNamedJsonSchema(file.jsonSchema, encode(bad))).toThrow('refuses its schema');
    }
  });
}
