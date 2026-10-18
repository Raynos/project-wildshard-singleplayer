import * as v from 'valibot';
import { expect, test } from 'vitest';
import { CabinAppearanceSchema as CabinRowsSchema } from '../src/shards/pine-hollow/generators/sections';
import { output } from '../src/shards/pine-hollow/generators/output';
import { CABIN_LIFE } from '../src/shards/pine-hollow/generators/cabinLook';
import { CABIN_LIGHT } from '../src/shards/pine-hollow/generators/cabinAssembly';
import { HEARTH_LOOKS } from '../src/shards/pine-hollow/generators/hearthLook';

test('admitted cabin JSON retains every authored material and life value and rejects malformed rows', () => {
  const section = output.custom.sections.find(row => row.name === 'custom/cabinAppearance');
  const bytes = section === undefined ? undefined : output.custom.files.get(section.path);
  if (bytes === undefined) throw new Error('Missing named cabin JSON');
  const rows = v.parse(CabinRowsSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  expect(rows).toEqual({ CABIN_LIFE, CABIN_LIGHT, HEARTH_LOOKS });
  expect(() => v.parse(CabinRowsSchema, { ...rows, extra: true })).toThrow();
  expect(() => v.parse(CabinRowsSchema, { ...rows, CABIN_LIFE: { ...rows.CABIN_LIFE, fire: [0.7] } })).toThrow();
  expect(() => v.parse(CabinRowsSchema, { ...rows, CABIN_LIGHT: { ...rows.CABIN_LIGHT, count: 'two' } })).toThrow();
});
