// oxlint-disable-next-line import/no-nodejs-modules -- The owned bake adapter reads the repository's committed assets.
import { cwd } from 'node:process';
import { expect, it, vi } from 'vitest';
import { installBakeEnvironment } from '../scripts/bake/environment.mjs';

it('installs the existing non-drawing bake DOM and local fetch only for its owned lifetime', async () => {
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const external = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('external'));
  const environment = installBakeEnvironment(cwd());
  try {
    expect(() => installBakeEnvironment(cwd())).toThrow('already installed');
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    if (context === null) throw new Error('Missing bake canvas context');
    expect(context.createImageData(3, 2).data).toHaveLength(24);
    const image = document.createElement('img'); let loaded = false;
    image.addEventListener('load', () => { loaded = true; }); image.src = '/image-not-drawn.png';
    await Promise.resolve(); expect(loaded).toBe(true);
    const response = await fetch(new Request('/assets/baked/pine-hollow/terrain.bin'));
    expect(response.ok).toBe(true);
    expect([...new Uint8Array(await response.arrayBuffer()).subarray(0, 4)]).toEqual([87, 83, 84, 82]);
    expect((await fetch('/missing-bake-file')).status).toBe(404);
    expect(await (await fetch('https://example.invalid/asset')).text()).toBe('external');
    expect(external).toHaveBeenCalledTimes(1);
  } finally { environment.dispose(); environment.dispose(); external.mockRestore(); }
  expect(Object.getOwnPropertyDescriptor(globalThis, 'document')).toEqual(documentBefore);
});
