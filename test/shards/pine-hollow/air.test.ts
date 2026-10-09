import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { TickScheduler } from '../../../src/engine/app/scheduler';
import { updateWind, windBoost, windGustAt, windUniforms } from '../../../src/engine/world/wind';
import { PineWeather } from '../../../src/shards/pine-hollow/world/weatherProfile';
import { PineAir } from '../../../src/shards/pine-hollow/runtime/air';

it('matches the actual page weather scheduler and wind at mixed frame deltas, including a non-due restore', () => {
  const page = new PineWeather({ seed: 1337 }), air = new PineAir({ seed: 1337 }), restored = new PineAir({ seed: 1337 });
  const cadence = new TickScheduler(), system = { id: 'oracle', phase: 'update' as const, tick: 'weather', run: (): void => undefined };
  const old = { time: windUniforms.uWindTime.value, gust: windUniforms.uGust.value, boost: windBoost.value };
  windUniforms.uWindTime.value = 0; windUniforms.uGust.value = 0.5; windBoost.value = 0;
  try {
    for (let frame = 0; frame < 9000; frame++) {
      const dt = frame % 7 === 0 ? 1 / 30 : frame % 5 === 0 ? 1 / 120 : 1 / 60, phase = frame / 9000;
      if (frame === 500) { page.setMode('rain'); air.weather.setMode('rain'); }
      if (frame === 1500) { page.setMode('live'); air.weather.setMode('live'); restored.weather.setMode('live'); }
      cadence.beginFrame(dt); const due = cadence.systemDt(system, dt);
      // bootstrap's player.update/Forest runs first; shard.pine.weather follows quest/audio and publishes the new boost.
      updateWind(dt);
      if (due > 0) page.update(due, phase);
      windBoost.value = page.wind; air.step(dt, phase);
      if (frame === 1001) {
        const wire = JSON.stringify(air.snapshot()), continuation: unknown = JSON.parse(wire);
        restored.restore(continuation);
      }
      else if (frame > 1001) restored.step(dt, phase);
      if (frame % 30 === 0) {
        expect(air.weather.captureWeather()).toEqual(page.captureWeather());
        const x = frame / 20 - 200, z = 80 - frame / 100;
        const speed = 1.2 + 7 * windGustAt(x, z);
        expect(air.wind.vecAt(x, z, new Vector3(0, 0.4, 0)).toArray()).toEqual([-0.55 * speed, 0.4, 0.83 * speed]);
        if (frame > 1001) expect(restored.snapshot()).toEqual(air.snapshot());
      }
    }
  } finally {
    windUniforms.uWindTime.value = old.time; windUniforms.uGust.value = old.gust; windBoost.value = old.boost;
  }
});

it('refuses corrupt cross-owner continuations and invalid frames before partial mutation', () => {
  const air = new PineAir({ seed: 1337 }); air.weather.setMode('rain'); air.step(0.025, 0.7);
  const saved = air.snapshot(), parsed: unknown = JSON.parse(saved.cadence);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Missing cadence');
  const invalid = [null, { ...saved, extra: 1 }, { ...saved, wind: { ...saved.wind, time: -1 } },
    { ...saved, weather: { ...saved.weather, phaseT: -1 } }, { ...saved, boost: Number.NaN },
    { ...saved, wind: { ...saved.wind, time: saved.wind.time + 1 } },
    { ...saved, cadence: '{' }, { ...saved, cadence: JSON.stringify({ ...parsed, contract: 'foreign' }) }];
  for (const value of invalid) {
    expect(() => air.restore(value)).toThrow(); expect(air.snapshot()).toEqual(saved);
  }
  expect(() => new PineAir({ seed: 0 }).restore(saved)).toThrow();
  for (const [dt, phase] of [[-1, 0], [Number.NaN, 0], [1, Number.NaN]]) {
    expect(() => air.step(dt ?? Number.NaN, phase ?? Number.NaN)).toThrow(); expect(air.snapshot()).toEqual(saved);
  }
  const copy = structuredClone(saved), commit = air.prepareRestore(copy);
  copy.wind.time = 100; copy.weather.rng.state = 0; commit();
  expect(air.snapshot()).toEqual(saved);
});
