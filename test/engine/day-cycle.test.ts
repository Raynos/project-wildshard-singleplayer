import { describe, expect, it } from 'vitest';
import { DayCycle } from '#engine-internal/world/dayCycle';
import { PINE_DAY } from '#shards/pine-hollow/look/dayKeys';
import { DRIFTWOOD_DAY } from '#shards/driftwood-isle/look/dayKeys';
import { steppeClock } from '#shards/nalati-grasslands/look/dayKeys';
import { App } from '#engine-internal/app/app';
import { Scope } from '#engine-internal/app/scope';
import frozen from './fixtures/day-cycle-e357.json';
import sequence from './fixtures/sky-sequence-e357.json';

/** Recorded from pre-extraction source152c5409: whole-day paths/curves, three-hour schedule trace. */
function close(actual: readonly unknown[], expected: readonly unknown[]): void {
  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i], e = expected[i];
    if (typeof a === 'number' && typeof e === 'number') expect(a).toBeCloseTo(e, 9);
    else expect(a).toEqual(e);
  }
}
describe('DayCycle preserves the three authored clocks', () => {
  it('Pine: hour, night, dusk, dawn, lamps and key-light direction over the whole day', () => {
    const c = new DayCycle(PINE_DAY);
    for (const row of frozen.pine) {
      const p = row[0]; if (p === undefined) throw new Error('missing recorded phase');
      c.phase = p;
      close([p, c.hour, c.night, c.dusk, c.dawn, c.lamps, ...c.sunDir], row);
    }
  });
  it('Driftwood: hour, night, dusk and key-light direction over the whole day', () => {
    const c = new DayCycle(DRIFTWOOD_DAY);
    for (const row of frozen.driftwood) {
      const p = row[0]; if (p === undefined) throw new Error('missing recorded phase');
      c.phase = p;
      close([p, c.hour, c.night, c.dusk, ...c.sunDir], row);
    }
  });
  it('Nalati: each schedule step preserves the original hour arithmetic and phase events', () => {
    const c = steppeClock({ start: 16 });
    let j = 0;
    for (let i = 0; i < 10800; i++) {
      c.update(1);
      if (i % 30 === 0) {
        const row = frozen.nalati[j++]; if (!row) throw new Error('missing recorded hour');
        close([i + 1, c.hour, c.dayPhase, c.sunElevation, c.sunAzimuth, c.moonElevation, c.moonAzimuth, c.phaseProgress], row);
      }
    }
  });
  it('phase clocks keep their24/48-minute tick arithmetic, fixed picks and pin restoration', async () => {
    for (const c of [new DayCycle(PINE_DAY), new DayCycle(DRIFTWOOD_DAY)]) {
      const start = c.phase;
      c.update(17); expect(c.phase).toBeCloseTo((start + 17 / c.cycle) % 1, 12);
      c.setTime('night'); c.update(90); expect(c.phase).toBe(c.spec.fixed.night);
      c.setTime('live'); const before = c.phase; c.pin('dawn'); c.pin('night'); c.pin(null); expect(c.phase).toBe(before);
      let decoded = false; c.onSet = async () => { await Promise.resolve(); decoded = true; };
      await c.set(0.2); expect(decoded).toBe(true); expect(c.phase).toBeCloseTo(0.2);
    }
  });
  it('three capture-mode minutes at60× retain the original photographic key sequence', () => {
    const clock = new DayCycle(PINE_DAY); clock.scale = 60;
    let previous = '', j = 0;
    for (let frame=0;frame<10800;frame++) {
      clock.update(1/60);
      const [a,b] = clock.segment(), pair = `${a[1].key}:${b[1].key}`;
      if (pair !== previous || frame%60===0) {
        const row = sequence[j++]; if (!row) throw new Error('missing recorded sky pair');
        close([frame+1,clock.phase,a[1].key,b[1].key],row);
      }
      previous=pair;
    }
    expect(j).toBe(sequence.length);
  });
  it('parked clocks are resident-scoped and disposed clocks cannot be returned', () => {
    const app = new App(), a = new Scope('a'), b = new Scope('b'), pine = new DayCycle(PINE_DAY), nalati = steppeClock();
    app.registerDayCycle(pine, a); app.registerDayCycle(nalati, b);
    app.levelScope = a; expect(app.world.dayCycle).toBe(pine);
    app.levelScope = b; expect(app.world.dayCycle).toBe(nalati);
    a.dispose(); app.levelScope = a; expect(app.world.dayCycle).toBeNull();
    app.levelScope = b; expect(app.world.dayCycle).toBe(nalati);
  });
});
