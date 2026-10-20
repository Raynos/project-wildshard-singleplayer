import { FileLoader } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { createRigLoader } from '@wildshard/engine/anim/rig';
import * as clock from '../src/engine/core/clock';

const document = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [] });
afterEach(() => { vi.restoreAllMocks(); });

it('reads files in parallel while bounding real parser work across loader instances', async () => {
  const reads: string[] = [], entered: number[] = [], releases: (() => void)[] = [];
  let cleanup = false;
  vi.spyOn(FileLoader.prototype, 'load').mockImplementation((url, onLoad) => {
    reads.push(url);
    queueMicrotask(() => { onLoad?.(document); });
    return undefined;
  });
  const jobs = [0, 1, 2].map(index => {
    const loader = createRigLoader();
    loader.register(() => ({ name: 'fixture-decode-bound', afterRoot: () => {
      entered.push(index);
      if (cleanup) return Promise.resolve();
      return new Promise<void>(resolve => { releases[index] = resolve; });
    } }));
    return loader.loadAsync(`https://models.example/${index}.gltf`);
  });
  expect(reads).toHaveLength(3);
  try {
    for (const index of [0, 1, 2]) {
      await expect.poll(() => entered).toEqual(Array.from({ length: index + 1 }, (_, at) => at));
      releases[index]?.();
      const loaded = await jobs[index];
      expect(loaded?.scene.type).toBe('Group');
    }
  } finally { cleanup = true; for (const release of releases) release(); }
  await Promise.all(jobs);
});

it('releases the shared slot after a synchronous parser failure', async () => {
  const failed = createRigLoader().parseAsync(JSON.stringify({ asset: { version: '1.0' } }), '');
  const following = createRigLoader().parseAsync(document, '');
  await expect(failed).rejects.toThrow(/Unsupported asset/u);
  expect((await following).scene.type).toBe('Group');
});

it('ends a spent browser decode slice before starting the next cached parse', async () => {
  const previousWindow = globalThis.window;
  vi.stubGlobal('window', {}); vi.useFakeTimers();
  let time = 0;
  vi.spyOn(clock, 'diagnosticNow').mockImplementation(() => time);
  const entered: number[] = [], reads: string[] = [];
  vi.spyOn(FileLoader.prototype, 'load').mockImplementation((url, onLoad) => {
    reads.push(url); queueMicrotask(() => { onLoad?.(document); }); return undefined;
  });
  try {
    const jobs = [0, 1].map(index => {
      const loader = createRigLoader();
      loader.register(() => ({ name: 'fixture-decode-slice', afterRoot: () => { entered.push(index); time = 10; return null; } }));
      return loader.loadAsync(`https://models.example/sliced-${index}.gltf`);
    });
    expect(reads).toHaveLength(2);
    await jobs[0]; await Promise.resolve();
    expect(entered).toEqual([0]);
    await vi.runOnlyPendingTimersAsync();
    await jobs[1]; expect(entered).toEqual([0, 1]);
  } finally { vi.useRealTimers(); vi.stubGlobal('window', previousWindow); }
});
