import { expect, it } from 'vitest';
import { Rng } from '../../src/engine/core/rng';
import { Weather, type WeatherProfile } from '../../src/engine/world/weather';

const profile: WeatherProfile<'dry' | 'wet', { overcast: number; rain: number; wet: number; wind: number; fog: number; charge: number }> = {
  states: ['dry', 'wet'], next: { dry: 'wet', wet: 'dry' },
  length: { dry: [1, 2], wet: [2, 3] }, soak: 1, dry: 1, tickHeld: true,
  modes: { live: 'none', hold: { hold: 'wet' } }, forceHold: true,
  initial: () => ({ overcast: 0, rain: 0, wet: 0, wind: 0, fog: 0, charge: -2 }),
  numbers: ({ prev, dt }) => ({ ...prev, charge: prev.charge + dt }),
};

it('preserves extra numeric fields, held clock overflow and the exact seeded transition suffix', () => {
  const source = new Weather(profile, new Rng(42)), restored = new Weather(profile, new Rng(42));
  source.setMode('hold'); source.update(10);
  const saved = source.captureWeather();
  expect(saved.phaseT).toBeGreaterThan(saved.phaseLen);
  let events = 0; restored.onPhase(() => { events++; });
  restored.restoreWeather(saved);
  expect(events).toBe(0); expect(restored.n.charge).toBe(8);
  source.setMode('live'); restored.setMode('live');
  for (let tick = 0; tick < 1000; tick++) {
    source.update(1 / 60); restored.update(1 / 60);
    expect(restored.captureWeather()).toEqual(source.captureWeather());
  }
  expect(events).toBeGreaterThan(0);
});

it('detaches captured and prepared values, including extension fields, before a silent commit', () => {
  const weather = new Weather(profile, Rng.scrambled(42));
  const before = weather.captureWeather();
  const snapshot = weather.captureWeather(); snapshot.n['charge'] = 100; snapshot.rng.state = 0;
  expect(weather.captureWeather()).toEqual(before);
  const input = structuredClone(before), commit = weather.prepareWeatherRestore(input);
  input.n['charge'] = 200; input.rng.state = 1; commit();
  expect(weather.captureWeather()).toEqual(before);
  for (const invalid of [
    { ...before, rng: { ...before.rng, scrambledFork: false } },
    { ...before, n: { ...before.n, charge: Infinity } },
    { ...before, phaseT: -1 }, { ...before, phaseLen: Infinity },
    { ...before, mode: 'toString' },
  ]) {
    expect(() => weather.restoreWeather(invalid)).toThrow();
    expect(weather.captureWeather()).toEqual(before);
  }
});
