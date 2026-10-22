import { expect, test } from 'vitest';
import { declaredForestQueries, declaredStreamClip } from '../src/game/shard/manifest';

const forest = { forest: [
  { x: 1.25, z: -3.5, density: .6, scale: 1.2, species: { spruce: .75, birch: .25 } },
  { x: -8, z: 2, density: .1, scale: .8, species: { willow: 1 } },
] };
const line = { x: 0, z: 0, vx: 10, vz: 0, l2: 100, arc: 0, length: 10 };
const clip = { lines: [line], within: 2, from: 3, to: 7 };

test('declared forest queries preserve independent candidate answers from data', () => {
  const query = declaredForestQueries(forest);
  for (const row of forest.forest) {
    expect(query.density(row.x, row.z)).toBe(row.density);
    expect(query.scale(row.x, row.z)).toBe(row.scale);
    expect(query.species(row.x, row.z)).toEqual(row.species);
  }
});

test('an undeclared forest candidate refuses every query instead of guessing', () => {
  const query = declaredForestQueries(forest);
  for (const read of [query.density, query.scale, query.species]) {
    expect(() => read(1.250000000000001, -3.5)).toThrow('Forest candidate differs');
  }
});

test('forest admission refuses non-finite answers and row callbacks', () => {
  const sample = forest.forest[0];
  if (sample === undefined) throw new Error('Missing forest fixture');
  expect(() => declaredForestQueries({ forest: [{ ...sample, density: Number.NaN }] })).toThrow();
  expect(() => declaredForestQueries({ forest: [{ ...sample, species: { spruce: Infinity } }] })).toThrow();
  expect(() => declaredForestQueries({ forest: [{ ...sample, scale: () => 1 }] })).toThrow();
  expect(() => declaredForestQueries({ forest: [{ ...sample, custom: () => 1 }] })).toThrow();
});

test('declared clips retain strict width and inclusive arc endpoints', () => {
  const accepts = declaredStreamClip(clip);
  expect(accepts(3, 0)).toBe(true);
  expect(accepts(7, 0)).toBe(true);
  expect(accepts(5, 1.999)).toBe(true);
  expect(accepts(5, -1.999)).toBe(true);
  expect(accepts(5, 2)).toBe(false);
  expect(accepts(5, -2)).toBe(false);
  expect(accepts(2.999, 0)).toBe(false);
  expect(accepts(7.001, 0)).toBe(false);
});

test('equidistant clip segments retain the first declared arc', () => {
  const later = { ...line, arc: 100 };
  expect(declaredStreamClip({ ...clip, lines: [line, later] })(5, 0)).toBe(true);
  expect(declaredStreamClip({ ...clip, lines: [later, line] })(5, 0)).toBe(false);
});

test('clip admission refuses missing geometry and non-data extensions', () => {
  expect(() => declaredStreamClip({ ...clip, lines: [] })).toThrow();
  expect(() => declaredStreamClip({ ...clip, within: -1 })).toThrow();
  expect(() => declaredStreamClip({ ...clip, lines: [{ ...line, vx: Infinity }] })).toThrow();
  expect(() => declaredStreamClip({ ...clip, query: () => true })).toThrow();
});
