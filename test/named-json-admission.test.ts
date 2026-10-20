import { expect, test } from 'vitest';
import { isJsonData, isJsonDataWithFileSchemas } from '../src/format/json';
import { nameBlob } from '../src/sdk/blobs';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

const jsonSchema = { $schema: 'http://json-schema.org/draft-07/schema#', type: 'array', maxItems: 20000,
  items: { type: 'array', minItems: 10, maxItems: 10, items: { type: 'number' } } };
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

test('named JSON retains its byte-bound contract above the custom-section node cap', () => {
  const value = Array.from({ length: 12000 }, () => Array.from({ length: 10 }, () => 1));
  expect(isJsonData(value)).toBe(false);
  const blob = nameBlob('data/placements.json', 'json', encode(value), { jsonSchema });
  expect(validateNamedJsonSchema(blob.file.jsonSchema, blob.bytes)).toEqual(value);
  value[9000] = [1];
  expect(() => nameBlob('data/placements.json', 'json', encode(value), { jsonSchema })).toThrow('refuses its schema');
  expect(() => validateNamedJsonSchema(jsonSchema, encode(value))).toThrow('refuses its schema');
  expect(() => validateNamedJsonSchema(jsonSchema, new TextEncoder().encode('[[-0]]'))).toThrow('canonical numbers');
});

test('each inline schema keeps the existing independent plain-JSON cap', () => {
  const schema = { ...jsonSchema, description: Array.from({ length: 60000 }, () => 'schema') };
  const index = { files: [{ jsonSchema: schema }, { jsonSchema: schema }] };
  expect(isJsonData(index)).toBe(false);
  expect(isJsonDataWithFileSchemas(index)).toBe(true);
  expect(isJsonDataWithFileSchemas({ files: [{ jsonSchema: { ...schema, extra: schema } }] })).toBe(false);
  const accessor = { files: [{ get jsonSchema() { throw new Error('Getter must not run'); } }] };
  expect(isJsonDataWithFileSchemas(accessor)).toBe(false);
});
