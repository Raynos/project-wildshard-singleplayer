import { expect, test } from 'vitest';
import * as v from 'valibot';
import { nativeDressingRows } from './fixtures/nalati-dressing-placements';
import { nalatiDressingBlob, DRESSING_SCHEMAS } from '../src/shards/nalati-grasslands/generators/dressingSchemas';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

test('Nalati dressing schemas reject a corrupt field and an unregistered producer', async () => {
  const boulders = v.parse(v.array(v.record(v.string(), v.unknown())), await nativeDressingRows('boulder'));
  expect(Object.keys(DRESSING_SCHEMAS)).toHaveLength(16);
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const blob = nalatiDressingBlob('world/dressing-boulder.json', 'json', encode(boulders));
  const bad = [{ ...boulders[0], sx: 'large' }];
  expect(() => nalatiDressingBlob('world/dressing-boulder.json', 'json', encode(bad))).toThrow('refuses its schema');
  expect(() => validateNamedJsonSchema(blob.file.jsonSchema, encode(bad))).toThrow('refuses its schema');
  expect(() => nalatiDressingBlob('world/dressing-other.json', 'json', encode([]))).toThrow('Missing dressing schema');
});
