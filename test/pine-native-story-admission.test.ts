import { expect, test } from 'vitest';
import { output } from '../src/shards/pine-hollow/generators/output';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

for (const name of ['quests/native-story.json', 'quests/native-spots.json']) {
  test(`${name}: its actual product admits native rows before owner installation`, () => {
    const file = output.namedFiles.find(row => row.name === name);
    const bytes = file === undefined ? undefined : output.assets.get(file.hash);
    if (file?.jsonSchema === undefined || bytes === undefined) throw new Error(`Missing defining native story schema: ${name}`);
    const original: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!record(original)) throw new Error('Native story document must be an object');
    expect(validateNamedJsonSchema(file.jsonSchema, bytes)).toEqual(original);
    expect(() => validateNamedJsonSchema(file.jsonSchema, encode({ ...original, runtimeHook: 'unbound' }))).toThrow('refuses its schema');
    if (name === 'quests/native-story.json') {
      expect(() => validateNamedJsonSchema(file.jsonSchema, encode({ ...original, eye: null }))).toThrow('refuses its schema');
    } else {
      const cable = original['cable'];
      if (!record(cable)) throw new Error('Native cable must keep its admitted geometry');
      expect(() => validateNamedJsonSchema(file.jsonSchema, encode({ ...original, cable: { ...cable, top: [0, 0] } }))).toThrow('refuses its schema');
    }
  });
}
