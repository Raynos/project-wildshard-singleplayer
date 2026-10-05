import * as v from 'valibot';
import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { CommonsCostSchema, CommonsCostsSchema, assertCommonsCosts } from '@wildshard/sdk/commonsCosts';
import { parseShardfile } from '@wildshard/game/shardfile/schema';

const hash = 'a'.repeat(64), extra = 'b'.repeat(64);
const cost = { decoded: 64, gpu: 32, triangles: 2, draws: 1 };
const source = () => emptyShardfile({ slug: 'cost-test', name: 'Costs', author: 'Local', seed: 1, revision: 1 });
const requiringCommons = () => {
  const data = source(); data.requires.commons = [hash]; data.requires.commonsWire = { [hash]: 16 };
  data.requires.commonsCosts = { [hash]: cost }; data.library = [`commons:${hash}`];
  data.budgets.library = { compressed: 16, resident: 96 }; return data;
};
it('keeps old empty products compatible and declares the empty author cost table', () => {
  const data = source(), legacy = { ...data.requires };
  Reflect.deleteProperty(legacy, 'commonsCosts'); Reflect.deleteProperty(legacy, 'commonsWire');
  expect(data.requires.commonsCosts).toEqual({});
  expect(parseShardfile({ ...data, requires: legacy }).requires.commonsCosts).toEqual({});
});
it('admits the exact commons costs and exposes equivalent SDK schemas', () => {
  const data = requiringCommons(); expect(parseShardfile(data).requires.commonsCosts).toEqual({ [hash]: cost });
  expect(v.parse(CommonsCostSchema, cost)).toEqual(cost);
  expect(v.parse(CommonsCostsSchema, { [hash]: cost })).toEqual({ [hash]: cost });
  expect(assertCommonsCosts([hash], { [hash]: cost })).toEqual(data.requires.commonsCosts);
});
it('refuses missing or surplus cost metadata, independently of exact wire metadata', () => {
  const data = requiringCommons();
  for (const commonsCosts of [{}, { [extra]: cost }, { [hash]: cost, [extra]: cost }]) {
    expect(() => parseShardfile({ ...data, requires: { ...data.requires, commonsCosts } })).toThrow();
  }
  const missing = { ...data.requires }; Reflect.deleteProperty(missing, 'commonsCosts');
  expect(() => parseShardfile({ ...data, requires: missing })).toThrow();
  expect(() => parseShardfile({ ...source(), requires: { ...source().requires, commonsCosts: { [extra]: cost } } })).toThrow();
});
it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity])('refuses malformed declared cost %s through the full format and SDK', (decoded) => {
  const data = requiringCommons(), commonsCosts = { [hash]: { ...cost, decoded } };
  expect(() => parseShardfile({ ...data, requires: { ...data.requires, commonsCosts } })).toThrow();
  expect(() => assertCommonsCosts([hash], commonsCosts)).toThrow();
});
