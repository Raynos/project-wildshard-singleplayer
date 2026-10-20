import { expect, it } from 'vitest';
import { WaitRegistry } from '../src/engine/boot/waits';

it('reports duplicate concurrent labels with independent ages and clears settled work', async () => {
  let clock = 0;
  const registry = new WaitRegistry(() => clock);
  const deferred = () => {
    let finish = (_value: number): void => { throw new Error('Uninitialized resolver'); };
    const promise = new Promise<number>(resolve => { finish = resolve; });
    return { promise, resolve: finish };
  };
  const first = deferred(), second = deferred();
  const a = registry.waitFor('Read file', first.promise, 'file');
  clock = 1000;
  const b = registry.waitFor('Read file', second.promise, 'file');
  clock = 2500;
  expect(registry.snapshot().map(row => [row.kind, row.ageMs])).toEqual([['file', 2500], ['file', 1500]]);
  first.resolve(3); expect(await a).toBe(3);
  expect(registry.snapshot()).toHaveLength(1);
  second.resolve(7); expect(await b).toBe(7);
  expect(registry.snapshot()).toEqual([]);
});

it('preserves a rejection and removes its waiting entry', async () => {
  const registry = new WaitRegistry();
  const error = new Error('Worker failed');
  await expect(registry.waitFor('Cache worker', Promise.reject(error), 'worker')).rejects.toBe(error);
  expect(registry.snapshot()).toEqual([]);
});
