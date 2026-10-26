import { afterEach, expect, test, vi } from 'vitest';
import { RepeatWrapping, SRGBColorSpace } from 'three';
import * as bytes from '../boot/bytes';
import * as gpuFiles from '../boot/gpuFiles';
import * as ktx2 from './ktx2';
import { loadTexture } from './assets';
import { legacyDouble } from '../test/FakeGame';
import { realGc } from '../test/realGc';
import type { Renderer } from '../render/renderer';
import { installMemorySaver } from '../render/memorySaver';

class DecodedImage implements ImageBitmap {
  readonly width = 16;
  readonly height = 16;
  readonly bytes = new Uint8Array(1024 * 1024).fill(73);
  closes = 0;
  close(): void { this.closes++; }
}

const globals = ['ImageBitmap', 'WebGL2RenderingContext'].map(key => ({key, descriptor: Object.getOwnPropertyDescriptor(globalThis, key)}));
afterEach(() => {
  vi.restoreAllMocks();
  for (const {key, descriptor} of globals) {
    if (descriptor === undefined) Reflect.deleteProperty(globalThis, key);
    else Object.defineProperty(globalThis, key, descriptor);
  }
});

function images() {
  vi.stubGlobal('ImageBitmap', DecodedImage);
  vi.spyOn(gpuFiles, 'texMode').mockReturnValue('img');
  vi.spyOn(ktx2, 'ktx2Texture').mockResolvedValue(null);
  vi.spyOn(ktx2, 'linearKtx2Texture').mockResolvedValue(null);
  return vi.spyOn(bytes, 'fetchImage').mockImplementation(() => Promise.resolve(new DecodedImage()));
}

function uploadRenderer(): Renderer {
  return legacyDouble<Renderer>({
    getContext: () => legacyDouble<WebGL2RenderingContext>({}),
    properties: { has: () => false, get: object => object, remove: () => undefined, update: () => undefined, dispose: () => undefined },
    render: () => undefined, renderBufferDirect: () => undefined,
  });
}

test('a texture retired before upload releases its shared source and decoded backing', async () => {
  await realGc('src/engine/core/shared-source-lifetime.test.ts', 'a texture retired before upload releases', async collect => {
    const read = images(), url = '/shared-source-lifetime/retired.image';
    const refs = await (async () => {
      const texture = await loadTexture(url, true), image: unknown = texture.image;
      if (!(image instanceof DecodedImage)) throw new Error('Missing decoded image');
      expect(image.bytes[0]).toBe(73);
      const result = { source: new WeakRef(texture.source), backing: new WeakRef(image.bytes.buffer) };
      texture.dispose();read.mockClear();
      return result;
    })();
    await collect(refs.source);await collect(refs.backing);
    const replacement = await loadTexture(url, true);
    try { expect(read).toHaveBeenCalledOnce();expect(replacement.image).toBeInstanceOf(DecodedImage); }
    finally { replacement.dispose(); }
  });
});

test('live colour-space sources share a decode and close it only after both upload', () =>
  realGc('src/engine/core/shared-source-lifetime.test.ts', 'live colour-space sources share', async collect => {
    const read = images(), url = '/shared-source-lifetime/live.image';
    vi.stubGlobal('WebGL2RenderingContext', EventTarget);
    const renderer = uploadRenderer();installMemorySaver(renderer);
    const colour = await loadTexture(url, true), same = await loadTexture(url, true), linear = await loadTexture(url, false);
    try {
      expect(colour.source).toBe(same.source);expect(linear.source).not.toBe(colour.source);
      const image: unknown = colour.image;
      if (!(image instanceof DecodedImage)) throw new Error('Missing shared decode');
      expect(linear.image).toBe(image);expect(read).toHaveBeenCalledOnce();
      read.mockClear();await collect(new WeakRef({}));
      expect(colour.image).toBe(image);expect(image.bytes[0]).toBe(73);expect(image.closes).toBe(0);
      expect(colour.wrapS).toBe(RepeatWrapping);expect(colour.colorSpace).toBe(SRGBColorSpace);
      renderer.properties.get(colour);colour.onUpdate?.(colour);
      expect(image.closes).toBe(0);expect(linear.image).toBe(image);
      renderer.properties.get(linear);linear.onUpdate?.(linear);
      expect(image.closes).toBe(1);expect(colour.source.data).toEqual({width: 16, height: 16});
      renderer.properties.get(same);same.onUpdate?.(same);expect(image.closes).toBe(1);
    } finally { colour.dispose();same.dispose();linear.dispose(); }
  }));

test('a collected unuploaded colour source does not pin the remaining bitmap user', () =>
  realGc('src/engine/core/shared-source-lifetime.test.ts', 'a collected unuploaded colour source', async collect => {
    const read = images(), url = '/shared-source-lifetime/partial.image';
    vi.stubGlobal('WebGL2RenderingContext', EventTarget);
    const renderer = uploadRenderer();installMemorySaver(renderer);
    const linear = await loadTexture(url, false), image: unknown = linear.image;
    if (!(image instanceof DecodedImage)) throw new Error('Missing shared decode');
    try {
      const retired = await (async () => {
        const colour = await loadTexture(url, true), source = new WeakRef(colour.source);
        expect(colour.image).toBe(image);colour.dispose();read.mockClear();
        return source;
      })();
      await collect(retired);expect(image.closes).toBe(0);
      renderer.properties.get(linear);linear.onUpdate?.(linear);
      expect(image.closes).toBe(1);
      const replacement = await loadTexture(url, true);
      try { expect(read).toHaveBeenCalledOnce();expect(replacement.image).not.toBe(image); }
      finally { replacement.dispose(); }
    } finally { linear.dispose(); }
  }));
