import { expect, it } from 'vitest';
import { Color } from 'three';
import { installChannelPrograms } from '../src/game/plugin/channelPrograms';
import { DayCycle } from '../src/engine/world/dayCycle';
import { makeLook, sampleSkyLook, type SkyKey } from '../src/shards/nalati-grasslands/look/skyRig';
import { nalatiDayChannels } from '../src/shards/nalati-grasslands/generators/dayChannels';
import { nalatiDayClockRow } from '../src/shards/nalati-grasslands/generators/dayClock';
import { NALATI_MANIFEST_ROWS } from '../src/shards/nalati-grasslands/generators/manifestRows';
import { blendSteppeKey, clockForSun, nightKeys } from './fixtures/nalati-day-keys';

function baseline(): SkyKey {
  const { sky: s, grade: g, atmosphere: a } = NALATI_MANIFEST_ROWS;
  const hs = new Color(s.hemiSky), hg = new Color(s.hemiGround);
  return { el: 14, sun: [...s.sunColor], sunI: s.sunIntensity,
    ...structuredClone(s.painted), stars: 0,
    hemiSky: [hs.r, hs.g, hs.b], hemiGround: [hg.r, hg.g, hg.b], hemiI: s.hemiIntensity, env: s.envIntensity,
    fog: [0.2, 0.35, 0.7], fogSun: [...s.fogSunColor], shade: [0.11, 0.14, 0.29], rim: [1.2, 1.1, 0.8],
    cloudSun: [...s.cloudSunColor], cloud: [1, 1, 1], planet: [1, 1, 1],
    shadowTint: [...g.shadowTint], highTint: [...g.highTint], lift: [...g.lift], gain: [...g.gain], sat: g.saturation, contrast: g.contrast,
    vol: [...a.volumetricSunColor], volS: a.volumetric.strength, rays: 1 };
}
function setup(day: SkyKey) {
  const old = clockForSun(NALATI_MANIFEST_ROWS.sky.sun), clock = new DayCycle<SkyKey>(nalatiDayClockRow());
  old.spec.keys = { coordinate: 'elevation', frames: [day, ...nightKeys(day)].map(key => [key.el, key]), blend: blendSteppeKey };
  const expected = structuredClone(day), actual = structuredClone(day);
  const owners = new Map<string, unknown>([['day', day], ['key', actual], ['clock', { get elevation() { return clock.sunElevation; } }]]);
  for (const field of Object.keys(actual) as (keyof SkyKey)[]) {
    const value = actual[field];
    if (Array.isArray(value)) owners.set(`key.${field}`, {
      get x() { return value[0]; }, set x(n: number) { value[0] = n; },
      get y() { return value[1]; }, set y(n: number) { value[1] = n; },
      get z() { return value[2]; }, set z(n: number) { value[2] = n; },
    });
  }
  const programs = installChannelPrograms(nalatiDayChannels(), 'nalati.day', owners);
  const observation = { time: 0, delta: 1 / 60, values: {} };
  const channels = (Object.keys(expected) as (keyof SkyKey)[]).flatMap<{ field: keyof SkyKey; axis: number | null }>(field => Array.isArray(expected[field])
    ? [0, 1, 2].map(axis => ({ field, axis })) : [{ field, axis: null }]);
  const check = (): void => {
    old.key(expected); programs.evaluate(observation);
    for (const { field, axis } of channels) {
      const a = actual[field], e = expected[field];
      const av = Array.isArray(a) ? a[axis ?? 0] : a, ev = Array.isArray(e) ? e[axis ?? 0] : e;
      if (!Object.is(av, ev)) throw new Error(`${clock.hour}h ${field}.${String(axis)}: ${String(av)} differs from ${String(ev)}`);
    }
  };
  return { clock, old, expected, actual, check, channels };
}

it('retains every output bit at each 60 Hz tick of a complete scheduled day', () => {
  const { clock, old, check, channels } = setup(baseline());
  expect(clock.snapshot()).toEqual(old.snapshot());
  const ticks = Math.ceil(clock.cycle * 60);
  for (let tick = 0; tick <= ticks; tick++) { check(); clock.update(1 / 60); old.update(1 / 60); }
  expect(ticks).toBe(93600);
  expect(channels.length).toBe(66);
  expect(clock.snapshot()).toEqual(old.snapshot());
}, 120000);

it('retains exact key boundaries, nearby elevations, pins and alternate live baselines', async () => {
  for (const scale of [0, 0.731, 1, 2.3]) {
    const day = baseline();
    for (const field of Object.keys(day) as (keyof SkyKey)[]) {
      const value = day[field];
      if (Array.isArray(value)) value.forEach((n, i) => { value[i] = n * scale; });
      else if (field !== 'el') Object.assign(day, { [field]: value * scale });
    }
    const lane = setup(day);
    for (const elevation of [58, 14, 6, 1, -3, -9, -16, -58].flatMap(n => [n - 1e-12, n, n + 1e-12])) {
      // An own getter keeps this test on the same numeric loan contract as the real rig.
      Object.defineProperty(lane.clock, 'sunElevation', { configurable: true, get: () => elevation });
      Object.defineProperty(lane.old, 'sunElevation', { configurable: true, get: () => elevation });
      lane.check();
    }
    Reflect.deleteProperty(lane.clock, 'sunElevation'); Reflect.deleteProperty(lane.old, 'sunElevation');
    for (const preset of ['dawn', 'noon', 'dusk', 'night'] as const) { lane.clock.pin(preset); lane.old.pin(preset); lane.check(); }
    for (const hour of [0, 5.6, 12, 17.1, 17.85, 18.15, 22.5]) {
      await lane.clock.set(hour); await lane.old.set(hour); lane.check();
      const expected = sampleSkyLook(lane.old, makeLook(), lane.expected, 0.0003, 0.0006, 0.1);
      const actual = sampleSkyLook(lane.clock, makeLook(), lane.actual, 0.0003, 0.0006, 0.1);
      expect(actual).toEqual(expected);
    }
  }
});
