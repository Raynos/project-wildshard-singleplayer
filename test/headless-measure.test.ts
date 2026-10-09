import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { measureSimulation } from '../src/sdk/headless';

class Session {
  ticks = 0; disposed = 0;
  lastTickMicros = 0;
  initialized(): Promise<void> { return Promise.resolve(); }
  step(): Promise<{ tick: number; snapshot: string; effects: []; fuelUsed: number; scriptMicros: number }> {
    const tick = ++this.ticks; this.lastTickMicros = tick * 2;
    return Promise.resolve({ tick, snapshot: '{}', effects: [], fuelUsed: tick * 3, scriptMicros: tick });
  }
  finish(): never { throw new Error('Build observations must never walk entries'); }
  dispose(): Promise<void> { this.disposed++; return Promise.resolve(); }
}

it('warms up, samples three windows, retains raw maxima and all fuel, and disposes without the entry proof', async () => {
  const shard = emptyShardfile({ slug: 'measure-fixture', name: 'Measure', author: 'Fixture', revision: 1, seed: 1 });
  const session = new Session();
  const measured = await measureSimulation(shard, new Map(), () => Promise.resolve(session));
  expect(session.ticks).toBe(240); expect(session.disposed).toBe(1);
  expect(measured.timing).toEqual({ medianMicros: 301, p95Micros: 462, maxMicros: 480, samples: 180 });
  expect(measured.scripts).toEqual({ p95Micros: 117, maxMicros: 240, samples: 180 });
  expect(measured.fuel).toMatchObject({ p95: 684, max: 720, samples: 240 });
});

it('rejects persistent CPU overages while ignoring two interrupted windows and retaining a startup fuel spike', async () => {
  const shard = emptyShardfile({ slug: 'measure-fixture', name: 'Measure', author: 'Fixture', revision: 1, seed: 1 });
  for (const steady of [62, 1100]) {
    const session = new Session();
    session.step = () => {
      const tick = ++session.ticks;
      const cost = tick <= 180 ? 10_000 : steady; session.lastTickMicros = cost;
      return Promise.resolve({ tick, snapshot: '{}', effects: [], fuelUsed: tick === 1 ? 8_000_001 : 10, scriptMicros: cost });
    };
    const measured = await measureSimulation(shard, new Map(), () => Promise.resolve(session));
    expect(measured.scripts.p95Micros).toBe(steady);
    expect(measured.scripts.maxMicros).toBe(10_000);
    expect(measured.fuel.max).toBe(8_000_001); expect(measured.fuel.samples).toBe(240);
    expect(session.disposed).toBe(1);
  }
});
