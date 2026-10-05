import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile } from '../src/game/shardfile/schema';

const hash = 'a'.repeat(64), other = 'b'.repeat(64);
const source = () => emptyShardfile({ slug: 'commons-wire', name: 'Commons wire', author: 'Fixture', seed: 1, revision: 1 });

it('keeps empty projects compatible and emits an explicit empty commons wire map', () => {
  const data = source(); expect(data.requires.commonsWire).toEqual({});
  const { commonsWire: _wire, ...legacy } = data.requires;
  expect(parseShardfile({ ...data, requires: legacy }).requires.commonsWire).toEqual({});
});

it('requires exactly one declared byte count per unique commons hash', () => {
  const data = source(); data.requires.commons = [hash, other]; data.requires.commonsWire = { [hash]: 123, [other]: 456 };
  data.requires.commonsCosts = { [hash]: { decoded: 123, gpu: 0, triangles: 0, draws: 0 }, [other]: { decoded: 456, gpu: 0, triangles: 0, draws: 0 } };
  data.library = [`commons:${hash}`, `commons:${other}`];
  expect(parseShardfile(data).requires.commonsWire).toEqual(data.requires.commonsWire);
  for (const requires of [
    { ...data.requires, commonsWire: undefined }, { ...data.requires, commonsWire: {} },
    { ...data.requires, commonsWire: { [hash]: 123 } },
    { ...data.requires, commons: [hash], commonsWire: data.requires.commonsWire },
    { ...data.requires, commons: [hash, hash], commonsWire: { [hash]: 123 } },
  ]) expect(() => parseShardfile({ ...data, requires })).toThrow();
});

it('refuses malformed hashes and negative, fractional, nonfinite or unsafe wire sizes', () => {
  const data = source(); data.requires.commons = [hash];
  for (const wire of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => parseShardfile({ ...data, requires: { ...data.requires, commonsWire: { [hash]: wire } } })).toThrow();
  }
  expect(() => parseShardfile({ ...data, requires: { ...data.requires, commonsWire: { invalid: 1 } } })).toThrow();
  expect(() => parseShardfile({ ...source(), requires: { ...source().requires, commonsWire: { [hash]: 1 } } })).toThrow();
});
