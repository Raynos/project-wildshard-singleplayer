import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { installChannelPrograms } from '../src/game/plugin/channelPrograms';
import { dayLookPresets } from '../src/game/looks/dayLookPresets';
import { nalatiDayChannels } from '../src/shards/nalati-grasslands/generators/dayChannels';
import { skyRows, skyChannels } from '../src/shards/nalati-grasslands/generators/skyPresentation';
import skyDome from '../src/shards/nalati-grasslands/data/skyDome.json' with { type: 'json' };
import { validateGraph } from '../src/format/materialGraph';

function rig() {
  const rows = skyRows(), day = rows.day, key = structuredClone(day), clock = { elevation: 14 };
  const look = { ...dayLookPresets(rows.schema).live(rows.initial), sunDir: new Vector3(), keyDir: new Vector3() };
  const owners = new Map<string, unknown>([['day', day], ['key', key], ['clock', clock], ['look', look], ['base', { fogDist: .0003, fogHeightDensity: .0006, brightness: .1 }]]);
  for (const field of Object.keys(key) as (keyof typeof key)[]) { const value = key[field]; if (Array.isArray(value)) owners.set(`key.${field}`, {
    get x() { return value[0]; }, set x(n: number) { value[0] = n; },
    get y() { return value[1]; }, set y(n: number) { value[1] = n; },
    get z() { return value[2]; }, set z(n: number) { value[2] = n; },
  }); }
  const keys = installChannelPrograms(nalatiDayChannels(), 'nalati.day', owners);
  const sample = installChannelPrograms(skyChannels(), 'nalati.sky.sample', owners);
  const at = (elevation: number): void => {
    clock.elevation = elevation;
    keys.evaluate({ time: 0, delta: 0, values: {} }); sample.evaluate({ time: 0, delta: 0, values: {} });
  };
  return { look, day, at };
}

it('projects authored day, golden and moon keys into the shared live palette', () => {
  const { look, day, at } = rig();
  at(14); expect(look.keyIntensity).toBe(day.sunI); expect(look.keyColor.toArray()).toEqual(day.sun);
  expect(look.moon).toBe(0); expect(look.disc).toBe(1);
  at(6); expect(look.keyColor.toArray()).toEqual([1, .72, .44]); expect(look.keyIntensity).toBeCloseTo(day.sunI * .85);
  at(-16); expect(look.moon).toBe(1); expect(look.keyColor.toArray()).toEqual([.62, .74, 1]);
  expect(look.keyIntensity).toBe(.95); expect(look.stars).toBe(1);
  at(14); expect(look.keyIntensity).toBe(day.sunI); expect(look.stars).toBe(0);
});

it('keeps twilight continuous and emits an admitted sky material graph', () => {
  const { look, at } = rig();
  for (const elevation of [-16, -12, -9, -3, -1.5, 0, 1, 6, 14]) {
    at(elevation - 1e-6); const before = look.horizon.toArray(); at(elevation + 1e-6);
    for (const [i, value] of look.horizon.toArray().entries()) expect(value).toBeCloseTo(before[i] ?? 0, 4);
    expect(look.keyIntensity).toBeGreaterThanOrEqual(0);
  }
  const validated = validateGraph(skyDome, { trustedBudget: true });
  expect(validated.ok, JSON.stringify(validated)).toBe(true);
});


it('samples every day interval against the authored colour and baseline coefficients', () => {
  const { look, day, at } = rig();
  const elevations = [14, 6, 1, -3, -9, -16];
  const red = [day.sun[0], 1, 1, .8, .5, .5];
  const intensity = [1, .85, .45, 0, 0, 0];
  const sample = (values: readonly number[], elevation: number): number => {
    for (let i = 0; i < elevations.length - 1; i++) {
      const upper = elevations[i], lower = elevations[i + 1], a = values[i], b = values[i + 1];
      if (upper === undefined || lower === undefined || a === undefined || b === undefined) throw new Error('Missing day key');
      if (elevation < lower) continue;
      const u = Math.max(0, Math.min(1, (upper - elevation) / (upper - lower)));
      return a + (b - a) * u * u * (3 - 2 * u);
    }
    return values.at(-1) ?? 0;
  };
  for (let elevation = -20; elevation <= 18; elevation += .125) {
    at(elevation);
    if (elevation >= 1.5) {
      expect(look.keyColor.r).toBeCloseTo(sample(red, elevation), 12);
      expect(look.keyIntensity).toBeCloseTo(day.sunI * sample(intensity, elevation), 12);
    }
    for (const value of [look.zenith.r, look.zenith.g, look.zenith.b]) expect(Number.isFinite(value)).toBe(true);
  }
});
