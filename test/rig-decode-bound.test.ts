import { FileLoader } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { createRigLoader } from '@wildshard/engine/anim/rig';

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
