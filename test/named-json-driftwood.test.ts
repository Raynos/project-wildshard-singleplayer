import { expect, test } from 'vitest';
import { output } from '../src/shards/driftwood-isle/generators/output';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

test('every Driftwood named JSON has a defining schema and corrupt scenes refuse', () => {
  const files = output.namedFiles.filter(file => file.kind === 'json');
  expect(files.length).toBeGreaterThan(40);
  for (const file of files) expect(file.jsonSchema, file.name).toBeDefined();
  const scene = files.find(file => file.name === 'scenes/zipline.json');
  if (scene === undefined) throw new Error('Missing zipline scene');
  expect(() => validateNamedJsonSchema(scene.jsonSchema, new TextEncoder().encode('{"scene":{"root":42},"imports":[]}'))).toThrow('refuses its schema');
});
