import { expect, test, vi } from 'vitest';
import { isDev, setDev } from '@wildshard/engine/core/devMode';
import { clientPreparationBatch, timeClientPreparation } from './preparationTiming';

test('preparation spans replace reentry, preserve failures and skip public work', async () => {
  const dev = isDev(), name = 'wildshard.prepare:fixture:world.data';
  try {
    setDev(true);
    expect(await timeClientPreparation('fixture', 'world.data', () => 7)).toBe(7);
    await timeClientPreparation('fixture', 'world.data', () => Promise.resolve(undefined));
    expect(performance.getEntriesByName(name)).toHaveLength(1);
    const error = new Error('preparation failed');
    await expect(timeClientPreparation('fixture', 'world.data', () => { throw error; })).rejects.toBe(error);
    const entries = performance.getEntriesByName(name);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.duration).toBeGreaterThanOrEqual(0);
    performance.clearMeasures(name);
    setDev(false);
    expect(await timeClientPreparation('fixture', 'world.data', () => 9)).toBe(9);
    expect(performance.getEntriesByName(name)).toHaveLength(0);
  } finally { setDev(dev); performance.clearMeasures(name); }
});

test('batched preparation keeps actual envelopes and elapsed totals with original results and failures', async () => {
  const previous = isDev(), prefix = 'wildshard.prepare:fixture:whole-test.';
  const clock = vi.spyOn(performance, 'now'); let now = 100;
  clock.mockImplementation(() => now);
  try {
    setDev(true);
    const batch = clientPreparationBatch('fixture', 'whole-test', ['assemble', 'decode']);
    if (batch === undefined) throw new Error('Missing Developer batch');
    expect(batch.sync('assemble', () => { now += 7; return 19; })).toBe(19);
    now = 200;
    expect(await batch.run('decode', () => { now += 13; return Promise.resolve(23); })).toBe(23);
    const failure = new Error('decode refused');
    now = 300;
    await expect(batch.run('decode', () => { now += 5; return Promise.reject(failure); })).rejects.toBe(failure);
    now = 400;
    expect(() => batch.sync('assemble', () => { now += 3; throw failure; })).toThrow(failure);
    expect(performance.getEntriesByName(`${prefix}assemble`)).toHaveLength(0);
    batch.finish(); batch.finish();
    for (const [phase, duration, total, longest] of [['assemble', 303, 10, 7], ['decode', 105, 18, 13]] as const) {
      const entries = performance.getEntriesByName(`${prefix}${phase}`), entry = entries[0];
      expect(entries).toHaveLength(1);
      if (entry === undefined) throw new Error('Missing phase envelope');
      expect(entry.duration).toBe(duration);
      const detail: unknown = Reflect.get(entry, 'detail');
      expect(detail).toEqual({ calls: 2, failures: 1, elapsedMs: total, longestMs: longest });
    }
  } finally { setDev(previous); clock.mockRestore(); for (const phase of ['assemble', 'decode']) performance.clearMeasures(`${prefix}${phase}`); }
});

test('batched preparation stays absent in public mode and replaces a completed re-entry', () => {
  const previous = isDev(), name = 'wildshard.prepare:fixture:whole-reentry.assemble';
  try {
    setDev(false); expect(clientPreparationBatch('fixture', 'whole-reentry', ['assemble'])).toBeUndefined();
    setDev(true);
    for (let entry = 0; entry < 2; entry++) {
      const batch = clientPreparationBatch('fixture', 'whole-reentry', ['assemble']);
      if (batch === undefined) throw new Error('Missing Developer batch');
      batch.sync('assemble', () => entry); batch.finish();
      const spans = performance.getEntriesByName(name);
      expect(spans).toHaveLength(1);
      if (spans[0] === undefined) throw new Error('Missing repeated phase');
      const detail: unknown = Reflect.get(spans[0], 'detail');
      expect(detail).toEqual(expect.objectContaining({ calls: 1, failures: 0 }));
    }
  } finally { setDev(previous); performance.clearMeasures(name); }
});


test('optional completion totals keep synchronous progress and actual waited failures', async () => {
  const previous = isDev(), name = 'wildshard.prepare:fixture:whole-check.yield';
  const clock = vi.spyOn(performance, 'now'); let now = 100;
  clock.mockImplementation(() => now);
  try {
    setDev(true);
    const batch = clientPreparationBatch('fixture', 'whole-check', ['yield']);
    if (batch === undefined) throw new Error('Missing Developer batch');
    expect(batch.checkpoint('yield', () => { now += 2; return undefined; })).toBeUndefined();
    now = 200;
    let finish = (): void => undefined;
    const pause = new Promise<void>(resolve => { finish = resolve; });
    const waited = batch.checkpoint('yield', () => { now += 3; return pause; });
    expect(waited).toBeInstanceOf(Promise);
    now = 250; finish(); await waited;
    const failure = new Error('original completion refusal');
    now = 300;
    expect(() => batch.checkpoint('yield', () => { now += 7; throw failure; })).toThrow(failure);
    now = 400;
    await expect(batch.checkpoint('yield', () => { now += 5; return Promise.reject(failure); })).rejects.toBe(failure);
    batch.finish();
    const spans = performance.getEntriesByName(name), entry = spans[0];
    expect(spans).toHaveLength(1);
    if (entry === undefined) throw new Error('Missing completion total');
    expect(entry.duration).toBe(305);
    const detail: unknown = Reflect.get(entry, 'detail');
    expect(detail).toEqual({ calls: 4, failures: 2, elapsedMs: 64, longestMs: 50 });
    expect(() => batch.checkpoint('yield', () => undefined)).toThrow('Client preparation batch is finished');
  } finally { setDev(previous); clock.mockRestore(); performance.clearMeasures(name); }
});
