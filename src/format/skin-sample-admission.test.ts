import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SkinPoseLayerSchema } from './skinLayers';
import { parseSkinBindings, parseSkinRows } from './skinData';

const layer = () => ({ id: 'breath', period: 1, times: [0, 1], phasePeriod: 1, phaseSteps: 0,
  tracks: [{ bone: 'body', property: 'position', axis: 'x', order: 'XYZ', values: [0, 0] }] });

test('sample admission preserves finite values and detached tables', () => {
  const input = layer(); input.tracks[0]?.values.push(-0, -Number.MAX_VALUE, Number.MAX_VALUE);
  const output = v.parse(SkinPoseLayerSchema, input);
  expect(output).toEqual(input);
  expect(output.times).not.toBe(input.times);
  expect(output.tracks[0]?.values).not.toBe(input.tracks[0]?.values);
  expect(Object.is(output.tracks[0]?.values[2], -0)).toBe(true);
  input.times[1] = 4; input.tracks[0]?.values.fill(9);
  expect(output.times).toEqual([0, 1]);
  expect(output.tracks[0]?.values).toEqual([0, 0, -0, -Number.MAX_VALUE, Number.MAX_VALUE]);
});

test('sample admission rejects malformed values, sparse arrays and both table caps', () => {
  for (const value of [Number.NaN, Infinity, -Infinity, '0', null, undefined]) {
    const result = v.safeParse(SkinPoseLayerSchema, { ...layer(), times: [0, value] });
    expect(result.success).toBe(false);
    if (!result.success) expect(v.getDotPath(result.issues[0])).toBe('times.1');
    expect(v.safeParse(SkinPoseLayerSchema, { ...layer(), tracks: [{ ...layer().tracks[0], values: [value] }] }).success).toBe(false);
  }
  for (const times of [null, {}, [], [0], Object.assign([], { length: 2 }), Array.from({ length: 4098 }, () => 0)]) {
    expect(v.safeParse(SkinPoseLayerSchema, { ...layer(), times }).success).toBe(false);
  }
  expect(v.safeParse(SkinPoseLayerSchema, { ...layer(), times: Array.from({ length: 4097 }, () => 0) }).success).toBe(true);
  for (const count of [300000, 300001]) {
    expect(v.safeParse(SkinPoseLayerSchema, { ...layer(), tracks: [{ ...layer().tracks[0], values: Array.from({ length: count }, () => 0) }] }).success).toBe(count === 300000);
  }
});

test('each accepted sample is read once and oversized tables are refused before reading elements', () => {
  let reads = 0;
  const times = [0, 1];
  Object.defineProperty(times, 1, { get: () => ++reads === 1 ? 1 : Infinity });
  expect(v.parse(SkinPoseLayerSchema, { ...layer(), times }).times).toEqual([0, 1]);
  expect(reads).toBe(1);
  const values = Array.from({ length: 300001 }, () => 0);
  Object.defineProperty(values, 0, { get: () => { reads++; return 0; } });
  expect(v.safeParse(SkinPoseLayerSchema, { ...layer(), tracks: [{ ...layer().tracks[0], values }] }).success).toBe(false);
  expect(reads).toBe(1);
});

test('binding admission retains layer shape, loop, joint, seam and quaternion checks', () => {
  const rows = parseSkinRows([{ id: 'fixture', file: 'a'.repeat(64), family: 'toon',
    rig: { skeleton: 'fixture', joints: [['body']], clips: ['idle'], sockets: [] }, cost: { decoded: 0, gpu: 0, triangles: 0, draws: 0 } }]);
  const binding = (sample: unknown) => [{ skin: 'fixture', material: {}, loops: ['idle'], poseLayers: { idle: [sample] } }];
  expect(parseSkinBindings(binding(layer()), rows)[0]?.poseLayers?.idle).toHaveLength(1);
  for (const invalid of [
    { ...layer(), extra: true },
    { ...layer(), times: [0, 2] },
    { ...layer(), tracks: [{ ...layer().tracks[0], bone: 'foreign' }] },
    { ...layer(), tracks: [{ ...layer().tracks[0], values: [1, 0] }] },
    { ...layer(), tracks: [{ ...layer().tracks[0], property: 'quaternion', values: Array.from({ length: 8 }, () => 0) }] },
    { ...layer(), phaseSteps: 1 },
  ]) expect(() => parseSkinBindings(binding(invalid), rows)).toThrow();
  expect(() => parseSkinBindings([{ ...binding(layer())[0], loops: [] }], rows)).toThrow('looping base');
});
