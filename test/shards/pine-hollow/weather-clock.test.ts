import { expect, it } from 'vitest';
import { PineWeather } from '../../../src/shards/pine-hollow/world/weatherProfile';

it('runs the shipping seeded weather through rain, held modes and an exact restored suffix', () => {
  const page = new PineWeather({ seed: 1337 }), native = new PineWeather({ seed: 1337 });
  const restored = new PineWeather({ seed: 1337 });
  let transitions = 0; page.onPhase(() => { transitions++; });
  for (let tick = 0; tick < 90000; tick++) {
    if (tick === 72000) { page.setMode('rain'); native.setMode('rain'); }
    if (tick === 78000) { page.setMode('live'); native.setMode('live'); }
    const phase = (tick / 72000) % 1;
    page.update(1 / 60, phase); native.update(1 / 60, phase);
    if (tick === 75000) restored.restoreWeather(native.captureWeather());
    if (tick > 75000) {
      if (tick === 78000) restored.setMode('live');
      restored.update(1 / 60, phase);
    }
    if (tick % 120 === 0) {
      expect(native.n).toEqual(page.n);
      expect([native.state, native.phaseT, native.phaseLen, native.mode, native.hold])
        .toEqual([page.state, page.phaseT, page.phaseLen, page.mode, page.hold]);
      if (tick > 75000) expect(restored.captureWeather()).toEqual(native.captureWeather());
    }
  }
  expect(transitions).toBeGreaterThan(1);
});

it('restores silently and refuses corrupt or foreign weather atomically', () => {
  const clock = new PineWeather({ seed: 1337 }); clock.setMode('rain'); clock.update(3, 0.7);
  const saved = clock.captureWeather(); let events = 0;
  clock.onPhase(() => { events++; });
  const copy = structuredClone(saved), commit = clock.prepareWeatherRestore(copy);
  copy.n['rain'] = 0; copy.rng.state = 0; commit();
  expect(clock.captureWeather()).toEqual(saved); expect(events).toBe(0);
  const invalid = [null, { ...saved, extra: 1 }, { ...saved, phaseLen: 0 },
    { ...saved, n: { ...saved.n, rain: Number.NaN } }, { ...saved, rng: { ...saved.rng, state: -1 } }, { ...saved, state: 'missing' },
    { ...saved, mode: 'missing' }, { ...saved, n: { ...saved.n, extra: 1 } },
    { ...saved, n: { rain: 0 } }, { ...saved, rng: { ...saved.rng, scrambledFork: true } }];
  for (const value of invalid) {
    expect(() => clock.restoreWeather(value)).toThrow(); expect(clock.captureWeather()).toEqual(saved);
  }
  expect(() => new PineWeather({ seed: 1338 }).restoreWeather(saved)).toThrow('Incompatible weather');
});
