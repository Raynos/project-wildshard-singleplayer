import { afterEach, expect, test, vi } from 'vitest';
import * as bytes from '../src/engine/boot/bytes';
import { decodedImageCount, loadImage } from '../src/engine/core/assets';

afterEach(() => { vi.unstubAllGlobals(); });

test('image loads share pending and live decodes, retry failures and release completed cache ownership', async () => {
  const refs: { clear: () => void }[] = [];
  class CollectableRef<T extends object> {
    private value: T | undefined;
    constructor(value: T) { this.value = value; refs.push({ clear: () => { this.value = undefined; } }); }
    deref(): T | undefined { return this.value; }
  }
  vi.stubGlobal('WeakRef', CollectableRef);
  const first = { width: 16, height: 16 } as HTMLImageElement;
  const next = { width: 16, height: 16 } as HTMLImageElement;
  let finish: ((image: HTMLImageElement) => void) | undefined;
  const fetch = vi.spyOn(bytes, 'fetchImage').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = loadImage('/image-cache/lifetime.png');
  expect(loadImage('/image-cache/lifetime.png')).toBe(pending);
  if (finish === undefined) throw new Error('Image decode did not start');
  finish(first);
  expect(await pending).toBe(first);
  expect(await loadImage('/image-cache/lifetime.png')).toBe(first);
  expect(fetch).toHaveBeenCalledTimes(1);
  // Simulate collection deterministically rather than depending on a GC deadline.
  for (const ref of refs) ref.clear();
  decodedImageCount();
  fetch.mockResolvedValueOnce(next);
  expect(await loadImage('/image-cache/lifetime.png')).toBe(next);
  expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockRejectedValueOnce(new Error('Interrupted image')).mockResolvedValueOnce(first);
  await expect(loadImage('/image-cache/retry.png')).rejects.toThrow('Interrupted image');
  expect(await loadImage('/image-cache/retry.png')).toBe(first);
  expect(fetch).toHaveBeenCalledTimes(4);
});
