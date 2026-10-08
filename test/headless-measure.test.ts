import { expect, it, vi } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { measureSimulation } from '../src/sdk/headless';

const calls = vi.hoisted(() => ({ ticks: 0, disposed: 0 }));
vi.mock('../src/sdk/tickWorkerHost', () => ({ TickWorkerHost: class {
  lastTickMicros = 0;
  initialized(): Promise<void> { return Promise.resolve(); }
  step(): Promise<{ tick: number; snapshot: string; effects: []; fuelUsed: number; scriptMicros: number }> {
    const tick = ++calls.ticks; this.lastTickMicros = tick * 2;
    return Promise.resolve({ tick, snapshot: '{}', effects: [], fuelUsed: tick * 3, scriptMicros: tick });
  }
  finish(): never { throw new Error('Build observations must never walk entries'); }
  dispose(): Promise<void> { calls.disposed++; return Promise.resolve(); }
} }));

it('build observations use exactly 60 ticks, nearest-rank p95, and dispose without the entry proof', async () => {
  const shard = emptyShardfile({ slug: 'measure-fixture', name: 'Measure', author: 'Fixture', revision: 1, seed: 1 });
  const measured = await measureSimulation(shard, new Map());
  expect(calls).toEqual({ ticks: 60, disposed: 1 });
  expect(measured.timing).toEqual({ medianMicros: 61, p95Micros: 114, maxMicros: 120, samples: 60 });
  expect(measured.scripts).toEqual({ p95Micros: 57, maxMicros: 60, samples: 60 });
  expect(measured.fuel).toMatchObject({ p95: 171, max: 180, samples: 60 });
});
