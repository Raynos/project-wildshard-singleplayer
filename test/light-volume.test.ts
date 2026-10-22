// oxlint-disable-next-line import/no-nodejs-modules -- the test deflates its own voxel bytes as the bake does
import { deflateSync } from 'node:zlib';
import { expect, test, vi } from 'vitest';
import { LinearFilter } from 'three';
import { loadLightVolume } from '../src/game/looks/lightVolume';
import { Scope } from '../src/engine/app/scope';

// G571: a baked irradiance volume (Nine Dragon's light pools) read from its product file into an owned 3D texture.
const row = { file: 'lighting/volume-a.bin', size: [2, 1, 1], min: [0, 1, 2], inv: [0.5, 1, 1], maximum: 3 };
const product = { url: (name: string) => `https://product.test/${name}` };
const served = (bytes: Uint8Array) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(Uint8Array.from(deflateSync(bytes))));

test('a declared volume loads into a linear GPU-only 3D texture its owner disposes', async () => {
  const fetch = served(Uint8Array.from({ length: 8 }, (_, i) => i)), owner = new Scope('volume');
  try {
    const volume = await loadLightVolume(product, row, owner);
    expect(fetch).toHaveBeenCalledWith('https://product.test/lighting/volume-a.bin');
    expect(volume.texture.image.width).toBe(2); expect(volume.texture.minFilter).toBe(LinearFilter); expect(volume.texture.unpackAlignment).toBe(1);
    expect(volume.min).toEqual([0, 1, 2]); expect(volume.maximum).toBe(3);
    const dispose = vi.spyOn(volume.texture, 'dispose'); owner.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
  } finally { fetch.mockRestore(); if (!owner.disposed) owner.dispose(); }
});

test('bytes that do not fill the declared voxels, or an invalid row, refuse', async () => {
  const fetch = served(new Uint8Array(7)), owner = new Scope('volume');
  try {
    await expect(loadLightVolume(product, row, owner)).rejects.toThrow('size differs');
    await expect(loadLightVolume(product, { ...row, size: [2, 1] }, owner)).rejects.toThrow();
  } finally { fetch.mockRestore(); owner.dispose(); }
});
