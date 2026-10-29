import { expect, test } from 'vitest';
import { declaredWaterBody, dryEntryContains, setLiveWaterLevel, type DryEntryEdge } from './declared';
import { CHUNK_HALF } from '../../core/config';

test('stream queries retain exact interpolation, tie order and live levels', () => {
  const name = 'test/fc11-stream';
  const input = { id: name, kind: 'stream' as const, width: 4, levels: { [name]: 4 }, points: [
    { x: 0, z: 0, level: 0, under: name }, { x: 10, z: 0, level: 10 },
    { x: 10, z: 0, level: 99 }, { x: 20, z: 0, level: 20 },
  ] };
  const body = declaredWaterBody(input);
  expect([body.restAt(0, 0), body.restAt(5, 1), body.restAt(10, 0), body.restAt(15, 0)]).toEqual([4, 7, 10, 59.5]);
  expect(body.restAt(5, 2)).toBeNull();
  setLiveWaterLevel(name, 8);
  expect(body.restAt(5, 1)).toBe(9);
  input.points[0] = { x: 100, z: 100, level: 100 };
  expect(body.restAt(5, 1)).toBe(9);
  expect(body.inside(5, 1, 8)).toBe(true); expect(body.inside(5, 1, 9)).toBe(false);
});

test('query bounds, invalid numbers and circle edges retain their original decisions', () => {
  const body = declaredWaterBody({ id: 'circle', kind: 'pool', level: -0, shape: { kind: 'circle', x: 0, z: 0, radius: 250 } });
  expect(Object.is(body.restAt(0, 0), -0)).toBe(true);
  expect(body.restAt(249, 0)).toBe(-0); expect(body.restAt(250, 0)).toBeNull();
  for (const bad of [Number.NaN, Infinity, -Infinity]) {
    expect(body.restAt(bad, 0)).toBeNull(); expect(body.restAt(0, bad)).toBeNull();
    expect(Object.is(body.surfaceAt(bad, 0), -0)).toBe(true);
    expect(Object.is(body.surfaceAt(0, bad), -0)).toBe(true);
  }
  expect(body.restAt(251, 0)).toBeNull(); expect(body.inside(0, 0, Number.NaN)).toBe(false);
});

test('dry sockets retain ordered exclusions and skip sparse declaration holes', () => {
  const edges: DryEntryEdge[] = ['north', 'east', 'south', 'west'];
  const body = declaredWaterBody({ id: 'pool', kind: 'pool', level: 2,
    shape: { kind: 'circle', x: 0, z: 0, radius: 1000 }, dryEntries: edges });
  for (const [x, z] of [[0, CHUNK_HALF], [CHUNK_HALF, 0], [0, -CHUNK_HALF], [-CHUNK_HALF, 0], [0, 0]]) {
    if (x === undefined || z === undefined) throw new Error('Missing test point');
    expect(body.restAt(x, z)).toBe(edges.some(edge => dryEntryContains(edge, x, z)) ? null : 2);
  }
  const sparse: DryEntryEdge[] = []; sparse[2] = 'north';
  const other = declaredWaterBody({ id: 'sparse', kind: 'pool', level: 3,
    shape: { kind: 'circle', x: 0, z: 0, radius: 1000 }, dryEntries: sparse });
  expect(other.restAt(0, CHUNK_HALF)).toBeNull(); expect(other.restAt(0, 0)).toBe(3);
});
