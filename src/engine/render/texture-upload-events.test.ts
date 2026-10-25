import { expect, test, vi } from 'vitest';
import { DataTexture, PerspectiveCamera, Scene } from 'three';
import { gpuOnlyTexture } from '../core/gpuOnly';
import { installTextureUploadEvents, type TextureUploadRenderer } from './textureUploadEvents';

test('native texture hooks stay intact and release only after both upload versions complete', () => {
  const rows = new WeakMap<object, { __version?: number }>();
  const get = (object: object): { __version?: number } => { let row = rows.get(object); if (row === undefined) { row = {}; rows.set(object, row); } return row; };
  let upload = false;
  const renderer: TextureUploadRenderer = { properties: { get: object => {
    if (typeof object !== 'object' || object === null) throw new Error('Missing upload object');
    return get(object);
  } }, initTexture: texture => {
    renderer.properties.get(texture);
    if (upload) { get(texture.source).__version = texture.source.version; texture.onUpdate?.(texture); get(texture).__version = texture.version; }
  }, render: () => undefined };
  installTextureUploadEvents(renderer); installTextureUploadEvents(renderer);
  const texture = new DataTexture(new Uint8Array(16).fill(17), 2, 2), original = texture.image.data, hook = vi.fn<() => void>();
  texture.onUpdate = hook; texture.needsUpdate = true;
  gpuOnlyTexture(texture, 'typed upload contract'); gpuOnlyTexture(texture, 'typed upload contract');
  renderer.initTexture(texture); expect(texture.image.data).toBe(original); expect(hook).not.toHaveBeenCalled();
  upload = true; renderer.initTexture(texture);
  expect(hook).toHaveBeenCalledOnce(); expect(texture.onUpdate).toBe(hook); expect(texture.image.data?.length).toBe(0);
  const released = texture.image.data; renderer.initTexture(texture);
  expect(texture.image.data).toBe(released); expect(hook).toHaveBeenCalledTimes(2); texture.dispose();
});

test('an ordinary completed render releases its uploaded source after the native callback', () => {
  const rows = new WeakMap<object, { __version: number }>();
  const texture = new DataTexture(new Uint8Array(4).fill(23), 1, 1), original = texture.image.data;
  const hook = vi.fn<() => void>(() => { expect(texture.image.data).toBe(original); }); texture.onUpdate = hook;
  const renderer: TextureUploadRenderer = { properties: { get: value => typeof value === 'object' && value !== null ? rows.get(value) : undefined },
    initTexture: value => { renderer.properties.get(value); }, render: () => {
      rows.set(texture.source, { __version: texture.source.version }); texture.onUpdate?.(texture); rows.set(texture, { __version: texture.version });
    } };
  installTextureUploadEvents(renderer); gpuOnlyTexture(texture, 'ordinary render');
  renderer.initTexture(texture); expect(texture.image.data).toBe(original);
  renderer.render(new Scene(), new PerspectiveCamera());
  expect(hook).toHaveBeenCalledOnce(); expect(texture.onUpdate).toBe(hook); expect(texture.image.data?.length).toBe(0); texture.dispose();
});

test('throwing callbacks and source version changes defer release until a later successful upload', () => {
  const rows = new WeakMap<object, { __version?: number }>();
  const get = (object: object): { __version?: number } => { let row = rows.get(object); if (row === undefined) { row = {}; rows.set(object, row); } return row; };
  const texture = new DataTexture(new Uint8Array(16), 2, 2), original = texture.image.data;
  const renderer: TextureUploadRenderer = { properties: { get: object => {
    if (typeof object !== 'object' || object === null) throw new Error('Missing upload object'); return get(object);
  } }, initTexture: value => {
    renderer.properties.get(value); get(value.source).__version = value.source.version;
    value.onUpdate?.(value); get(value).__version = value.version;
  }, render: () => undefined };
  installTextureUploadEvents(renderer); texture.needsUpdate = true; gpuOnlyTexture(texture, 'upload failure');
  texture.onUpdate = () => { throw new Error('native callback'); };
  expect(() => renderer.initTexture(texture)).toThrow('native callback'); expect(texture.image.data).toBe(original);
  texture.onUpdate = () => { texture.needsUpdate = true; };
  renderer.initTexture(texture); expect(texture.image.data).toBe(original);
  texture.onUpdate = null; renderer.initTexture(texture); expect(texture.image.data?.length).toBe(0); texture.dispose();
});
