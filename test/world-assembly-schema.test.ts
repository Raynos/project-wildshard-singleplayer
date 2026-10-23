import { expect, test } from 'vitest';
import * as v from 'valibot';
import { WorldAssemblySchema } from '../src/format/worldAssembly';
import { formatJsonSchema, namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

const models = { stages: [{ kind: 'drawn-models', id: 'orchard.signs', look: {painterly: {rim: 0.4}}, models: [{id: 'north', draw: 'sign:north'}] }] };

test('the defining assembly root emits structural rows and retains its explicit admission checks', () => {
  const schema = namedJsonSchema(WorldAssemblySchema);
  expect(JSON.stringify(formatJsonSchema(WorldAssemblySchema))).toContain('@wildshard/format/worldAssembly#WorldAssemblySchema');
  const admitted = validateNamedJsonSchema(schema, new TextEncoder().encode(JSON.stringify(models)));
  expect(v.parse(WorldAssemblySchema, admitted)).toEqual(models);
  expect(v.safeParse(WorldAssemblySchema, {stages: [{...models.stages[0], models: [{id: 'same', draw: 'one'}, {id: 'same', draw: 'two'}]}]}).success).toBe(false);
  expect(v.safeParse(WorldAssemblySchema, {stages: [{...models.stages[0], arbitrary: true}]}).success).toBe(false);
});

test('assembly emission does not grant a bridge to a foreign custom predicate', () => {
  const foreign = v.pipe(v.strictObject({id: v.string()}), v.check(row => row.id.length > 0));
  expect(() => namedJsonSchema(foreign)).toThrow('check');
});
