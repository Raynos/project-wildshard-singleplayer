import { expect, test } from 'vitest';
import * as v from 'valibot';
import { DRESSING_SCHEMAS } from '../src/shards/nalati-grasslands/generators/dressingSchemas';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/nalati-dressing-schema-original.json' with { type: 'json' };

test('all sixteen complete dressing wire grammars retain their before-edit byte pins', () => {
  expect(Object.keys(DRESSING_SCHEMAS)).toEqual(original.map(row => row.key));
  for (const pin of original) {
    const schema = DRESSING_SCHEMAS[pin.key];
    if (schema === undefined) throw new Error(`Missing original dressing contract: ${pin.key}`);
    const bytes = new TextEncoder().encode(JSON.stringify(schema.jsonSchema));
    expect(bytes.length, pin.key).toBe(pin.bytes);
    expect(hashImmutableBytes(bytes), pin.key).toBe(pin.hash);
  }
});

test('dressing admission retains native strict fields, exact optionals and tuple truncation', () => {
  const number = v.number();
  const native = v.array(v.strictObject({ x: number, z: number, y: number, yaw: number, sx: number, sy: number, sz: number,
    tiltX: v.exactOptional(number), tiltZ: v.exactOptional(number), solid: v.exactOptional(v.literal(true)),
    far: number, r: number, g: number, b: number }));
  const boulder = DRESSING_SCHEMAS['boulder'], fences = DRESSING_SCHEMAS['fences'];
  if (boulder === undefined || fences === undefined) throw new Error('Missing original placement contract');
  const row = { x: 1, z: -0, y: 3, yaw: 0, sx: 1, sy: 2, sz: 3, far: 4, r: .1, g: .2, b: .3 };
  expect(boulder.parse([row])).toEqual(v.parse(native, [row]));
  expect(fences.parse([[[1, 2, 99], [3, 4]]])).toEqual(v.parse(v.array(v.array(v.tuple([number, number]))), [[[1, 2, 99], [3, 4]]]));
  for (const bad of [[{ ...row, extra: 1 }], [{ ...row, tiltX: undefined }], [{ ...row, solid: false }], [{ ...row, x: 'one' }]]) {
    expect(() => v.parse(native, bad)).toThrow();
    expect(() => boulder.parse(bad)).toThrow();
  }
});
