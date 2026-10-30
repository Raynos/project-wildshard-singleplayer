import { expect, test } from 'vitest';
import * as v from 'valibot';
import { creatureSurfaceFrame } from '../src/sdk/clientChannels';
import { namePopulationHabitat } from '../src/sdk/nativePopulationRows';
import frameRows from '../src/shards/nalati-grasslands/data/speciesRows.json' with { type: 'json' };
import habitat from '../src/shards/nalati-grasslands/data/physicsRows.json' with { type: 'json' };
import { ForagerContinuation } from '../src/format/ambientLife';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';

test('frame inputs preserve finite scalars, safe keys and both original bank ceilings', () => {
  const rows = frameRows.kingFrame, defaults = frameRows.kingPoseDefaults;
  expect(creatureSurfaceFrame(rows, defaults, [])).toEqual(rows);
  const unrelated = { ...rows, group: 'orchard.pose', smooth: [{ input: 'height', output: 'smoothed', rate: 3, initial: -0 }] };
  expect(Object.is(creatureSurfaceFrame(unrelated, { height: -0 }, []).smooth[0]?.initial, -0)).toBe(true);
  for (const bad of [
    { ...rows, group: 'constructor' }, { ...rows, group: '__proto__' }, { ...rows, group: 'x'.repeat(97) },
    { ...rows, look: [1, 2, Infinity] }, { ...rows, smooth: Array.from({ length: 17 }, () => rows.smooth[0]) },
    { ...rows, floor: { ...rows.floor, delay: Number.NaN } },
  ]) expect(() => creatureSurfaceFrame(bad, defaults, [])).toThrow();
  expect(() => creatureSurfaceFrame(rows, { bad: Infinity }, [])).toThrow();
  // Native record admission drops prototype keys before checking entries.
  const prototypeDefaults: unknown = JSON.parse('{"__proto__":1}');
  expect(v.parse(v.record(v.string(), v.number()), prototypeDefaults)).toEqual({});
  expect(() => creatureSurfaceFrame(rows, prototypeDefaults, [])).not.toThrow();
  expect(() => creatureSurfaceFrame(rows, defaults, Array.from({ length: 33 }, () => null))).toThrow();
});

test('a second habitat retains the native strict document and authored inventory limits', () => {
  const finite = v.pipe(v.number(), v.finite());
  const schema = v.strictObject({
    trees: v.pipe(v.array(v.tuple([finite, finite, v.pipe(finite, v.minValue(0))])), v.length(2)),
    tops: v.pipe(v.array(finite), v.length(2)),
    ledges: v.pipe(v.array(v.strictObject({ x: finite, y: finite, z: finite, r: v.pipe(finite, v.minValue(0)) })), v.maxLength(1)),
    marmots: ForagerContinuation,
  });
  const input = { trees: [[1, 2, 3], [4, 5, 6]], tops: [7, 8], ledges: [], marmots: habitat.marmots };
  const blob = namePopulationHabitat('sim/orchard.json', input, 2, 1);
  expect(blob.file.name).toBe('sim/orchard.json');
  expect(blob.file.jsonSchema).toEqual(namedJsonSchema(schema));
  expect(JSON.parse(new TextDecoder().decode(blob.bytes))).toEqual(v.parse(schema, input));
  for (const bad of [
    { ...input, extra: 1 }, { ...input, tops: [1] }, { ...input, trees: [[1, 2, -1], [4, 5, 6]] },
    { ...input, ledges: [{ x: 0, y: 0, z: 0, r: -1 }] },
    { ...input, ledges: [{ x: 0, y: 0, z: 0, r: 1 }, { x: 1, y: 1, z: 1, r: 1 }] },
    { ...input, marmots: {} },
  ]) {
    expect(() => v.parse(schema, bad)).toThrow();
    expect(() => namePopulationHabitat('sim/orchard.json', bad, 2, 1)).toThrow();
  }
  expect(() => namePopulationHabitat('sim/orchard.json', input, -1, 1)).toThrow('limits');
});
