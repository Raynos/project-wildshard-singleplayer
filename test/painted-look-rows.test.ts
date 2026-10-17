import { expect, test } from 'vitest';
import { ShaderChunk } from 'three';
import { paintedLookFromRow, painterLightGlsl, painterLightPatch, parsePaintedLookRow } from '../src/engine/render/dataLook';
import signal from '../src/shards/sunscar-dunes/data/paintedLook.generated.json' with { type: 'json' };
import sky from '../src/shards/far-reach/data/paintedLook.generated.json' with { type: 'json' };

test('both generated looks admit their clock, sky and light without changing values', () => {
  for (const rows of [signal.look, sky.look]) {
    const admitted = parsePaintedLookRow(rows);
    expect(admitted).toEqual(rows);
    expect(() => parsePaintedLookRow({ ...rows, sun: { ...rows.sun, intensity: Number.NaN } })).toThrow();
    expect(() => parsePaintedLookRow({ ...rows, clock: { ...rows.clock, units: 'seconds' } })).toThrow();
  }
  expect(() => parsePaintedLookRow({ ...signal.look, light: { ...signal.look.light, rim: [1, 2] } })).toThrow();
});

test('a stateful look refuses missing dusk and binds the real live state', () => {
  const row = parsePaintedLookRow(signal.look), load = (): Promise<null> => Promise.resolve(null);
  expect(() => paintedLookFromRow(row, { load })).toThrow('live state');
  const state = { value: 0.86 }, look = paintedLookFromRow(row, { load, state });
  expect(look.backdrop).toBeTypeOf('function');
  expect(look.lighting).toBeUndefined();
  look.dispose?.();
});

test('page lighting installs the identical painter shader used by scoped materials', () => {
  const light = parsePaintedLookRow(sky.look).light, before = ShaderChunk.lights_fragment_end;
  try {
    painterLightPatch(null, light, sky.look.sun.dir);
    expect(ShaderChunk.lights_fragment_end).toBe(before + painterLightGlsl(light, sky.look.sun.dir));
  } finally { ShaderChunk.lights_fragment_end = before; }
});
