import { expect, test } from 'vitest';
import { isJsonData, isJsonDataWithFileSchemas } from '../src/format/json';
import { nameBlob } from '../src/sdk/blobs';
import { validateNamedJsonSchema, validateNamedJsonSchemaPaced } from '../src/game/shardfile/customSchema';

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

test('a paced named read pauses between its steps and compiles each schema once', async () => {
  const schema = { ...jsonSchema, maxItems: 4321 }, value = [Array.from({ length: 10 }, (_, i) => i)];
  let pauses = 0;
  const pause = () => { pauses++; return Promise.resolve(); };
  expect(await validateNamedJsonSchemaPaced(schema, encode(value), pause)).toEqual(value);
  expect(pauses).toBe(4); // parse | setup | compile | validate
  pauses = 0;
  expect(await validateNamedJsonSchemaPaced({ ...schema }, encode(value), pause)).toEqual(value);
  expect(pauses).toBe(2); // the same schema text reuses its compiled validator
  expect(validateNamedJsonSchema(schema, encode(value))).toEqual(value);
  await expect(validateNamedJsonSchemaPaced(schema, encode([[1]]), pause)).rejects.toThrow('refuses its schema');
  await expect(validateNamedJsonSchemaPaced(schema, new TextEncoder().encode('[[-0]]'), pause)).rejects.toThrow('canonical numbers');
  await expect(validateNamedJsonSchemaPaced({ ...schema, $schema: 'x' }, encode(value), pause)).rejects.toThrow('bounded draft-07');
  await expect(validateNamedJsonSchemaPaced(schema, encode(value), () => Promise.reject(new Error('Owner disposed')))).rejects.toThrow('Owner disposed');
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
