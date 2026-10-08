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

it('build observations use exactly 60 ticks, nearest-rank p95, and dispose without the entry proof', async () => {
  const shard = emptyShardfile({ slug: 'measure-fixture', name: 'Measure', author: 'Fixture', revision: 1, seed: 1 });
  const session = new Session();
  const measured = await measureSimulation(shard, new Map(), () => Promise.resolve(session));
  expect(session.ticks).toBe(60); expect(session.disposed).toBe(1);
  expect(measured.timing).toEqual({ medianMicros: 61, p95Micros: 114, maxMicros: 120, samples: 60 });
  expect(measured.scripts).toEqual({ p95Micros: 57, maxMicros: 60, samples: 60 });
  expect(measured.fuel).toMatchObject({ p95: 171, max: 180, samples: 60 });
});
