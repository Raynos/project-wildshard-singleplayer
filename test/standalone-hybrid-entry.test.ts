import { standaloneEntry as signalEntry } from '../src/shards/sunscar-dunes/runtime/standalone';
import { describe, expect, it, vi } from 'vitest';
import type { ShardContext } from '../src/game/plugin/context';
import { ShardPlugin } from '../src/game/plugin/shardPlugin';
import { standaloneEntry as nineEntry } from '../src/shards/nine-dragon-stack/runtime/standalone';
import { standaloneEntry as skyEntry } from '../src/shards/far-reach/runtime/standalone';
import { legacyDouble } from './fake/FakeGame';

const ctx = legacyDouble<ShardContext>({});

describe.each([['Nine Dragon', nineEntry], ['Sky Reach', skyEntry], ['Signal Dunes', signalEntry]] as const)('%s shared standalone entry', (name, factory) => {
  it.each([false, true])('keeps one owner through world/kit/play and two fresh entries (SHARDFILE=%s)', async (shardfile) => {
    const events: string[] = [];
    let built = 0;
    class Native extends ShardPlugin {
      constructor() { super(); built++; }
      override world(context: ShardContext): void { expect(context).toBe(ctx); events.push('world'); }
      override kit(context: ShardContext): void { expect(context).toBe(ctx); events.push('kit'); }
      override play(context: ShardContext): void { expect(context).toBe(ctx); events.push('play'); }
    }
    const choose = vi.fn((_context: ShardContext) => shardfile), admit = vi.fn(() => Promise.resolve(new Native()));
    const Entry = factory(Native);
    for (let run = 0; run < 2; run++) {
      const entry = new Entry(undefined, admit, choose);
      expect(built).toBe(run);
      await entry.world(ctx); await entry.kit(ctx); await entry.play(ctx);
      expect(built).toBe(run + 1);
      expect(events).toEqual(Array.from({ length: run + 1 }, () => ['world', 'kit', 'play']).flat());
    }
    expect(choose).toHaveBeenCalledTimes(2);
    for (const call of choose.mock.calls) expect(call[0]).toBe(ctx);
    expect(admit).toHaveBeenCalledTimes(shardfile ? 2 : 0);
  });

  it('waits for admitted data before any native hook and keeps pre-world refusals', async () => {
    const events: string[] = [];
    class Native extends ShardPlugin {
      override world(): void { events.push('world'); }
      override kit(): void { events.push('kit'); }
      override play(): void { events.push('play'); }
    }
    let release: (() => void) | undefined;
    const pending = new Promise<ShardPlugin>(resolve => { release = () => { resolve(new Native()); }; });
    const Entry = factory(Native), entry = new Entry(undefined, () => pending, () => true);
    await expect(entry.kit(ctx)).rejects.toThrow(`${name} hybrid world is not admitted`);
    await expect(entry.play(ctx)).rejects.toThrow(`${name} hybrid world is not admitted`);
    const world = entry.world(ctx);
    expect(events).toEqual([]);
    if (release === undefined) throw new Error('Missing pending admission');
    release(); await world; await entry.kit(ctx); await entry.play(ctx);
    expect(events).toEqual(['world', 'kit', 'play']);
  });

  it('propagates failed admission and never runs a native hook', async () => {
    class Native extends ShardPlugin { override world(): void { throw new Error('Native world must not run'); } }
    const Entry = factory(Native), entry = new Entry(undefined, () => Promise.reject(new Error('Asset hash refused')), () => true);
    await expect(entry.world(ctx)).rejects.toThrow('Asset hash refused');
    await expect(entry.kit(ctx)).rejects.toThrow(`${name} hybrid world is not admitted`);
    await expect(entry.play(ctx)).rejects.toThrow(`${name} hybrid world is not admitted`);
  });
});
