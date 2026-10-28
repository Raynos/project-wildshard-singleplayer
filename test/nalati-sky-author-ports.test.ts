import { expect, expectTypeOf, test } from 'vitest';
import * as v from 'valibot';
import { authorFormatSchema } from '../src/sdk/formatJsonSchema';
import { ManifestMetadataSchema } from '../src/format/minimap';
import type { ClientChannelProgram } from '../src/format/clientChannels';
import { skyRows, skyChannels } from '../src/shards/nalati-grasslands/generators/skyPresentation';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/nalati-sky-ports-original.json' with { type: 'json' };

test('sky authors use the exact defining metadata object and complete channel port', () => {
  const schema = authorFormatSchema('minimap.ManifestMetadataSchema');
  expectTypeOf<typeof schema>().toEqualTypeOf<typeof ManifestMetadataSchema>();
  expect(schema).toBe(ManifestMetadataSchema);
  expectTypeOf<ReturnType<typeof skyChannels>>().toEqualTypeOf<ClientChannelProgram[]>();
  const fields = ['sky', 'grade', 'atmosphere'] as const;
  const input = { sky: 'invalid', grade: null, atmosphere: false };
  expect(v.safeParse(v.pick(schema, fields), input)).toEqual(v.safeParse(v.pick(ManifestMetadataSchema, fields), input));
  expect(v.safeParse(v.pick(schema, fields), input).success).toBe(false);
});

test('every original day, initial, schema and channel program byte remains unchanged', () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ rows: skyRows(), channels: skyChannels() }));
  expect({ bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }).toEqual(original);
});
