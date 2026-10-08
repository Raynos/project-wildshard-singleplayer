import { expect, it, vi } from 'vitest';
import { BoxGeometry, CompressedTexture, MeshStandardMaterial, RGBA_S3TC_DXT5_Format } from 'three';
import { cacheUntilDisposed } from '../../src/engine/app/cachedAssets';
import { Scope } from '../../src/engine/app/scope';
import { modelContext } from '../../src/engine/models/model';

it('invalidates an asynchronous memo once on actual retirement without freeing or retaining its resources', async () => {
  const geometry = new BoxGeometry(), map = new CompressedTexture([{ data: new Uint8Array(16), width: 4, height: 4 }], 4, 4, RGBA_S3TC_DXT5_Format);
  const material = new MeshStandardMaterial({ map }), invalidate = vi.fn<() => void>(), dispose = vi.spyOn(map, 'dispose');
  const value = { geometry, material }, promise = Promise.resolve(value);
  expect(cacheUntilDisposed(promise, invalidate)).toBe(promise);
  expect(await promise).toBe(value); expect(invalidate).not.toHaveBeenCalled(); expect(dispose).not.toHaveBeenCalled();
  map.dispose(); expect(invalidate).toHaveBeenCalledOnce(); geometry.dispose(); material.dispose(); expect(invalidate).toHaveBeenCalledOnce();
});

it('rebuilds sync and async model-context memos after owned disposal across two regional lifetimes', async () => {
  const context = modelContext(null), make = vi.fn(() => ({ geometry: new BoxGeometry(), material: new MeshStandardMaterial() }));
  for (let entry = 0; entry < 2; entry++) {
    const owner = new Scope(`region:${String(entry)}`);
    const model = context.once('model', make);
    expect(context.once('model', make)).toBe(model);
    const promised = context.once('load', () => Promise.resolve(model));
    expect(await promised).toBe(model);
    owner.own(model.geometry); owner.own(model.material); owner.dispose();
    expect(make).toHaveBeenCalledTimes(entry + 1);
  }
  expect(make.mock.results[0]?.value).not.toBe(make.mock.results[1]?.value);
});

it('keeps rejected async results rejected and evicts the failed memo for an explicit retry', async () => {
  const context = modelContext(null), fail = vi.fn(() => Promise.reject(new Error('asset unavailable')));
  await expect(context.once('load', fail)).rejects.toThrow('asset unavailable');
  await expect(context.once('load', fail)).rejects.toThrow('asset unavailable');
  expect(fail).toHaveBeenCalledTimes(2);
});
