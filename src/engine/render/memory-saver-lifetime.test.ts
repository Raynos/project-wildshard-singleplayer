import { afterEach, expect, test, vi } from 'vitest';
import { Texture } from 'three';
import { legacyDouble } from '../test/FakeGame';
import { realGc } from '../test/realGc';
import type { Renderer } from './renderer';
import { installMemorySaver, releaseOnUpload } from './memorySaver';

class DecodedImage implements ImageBitmap {
  readonly width = 16;
  readonly height = 16;
  close(): void { /* The fixture owns no native bitmap. */ }
}

afterEach(() => { vi.unstubAllGlobals(); });

function uploadRenderer(): Renderer {
  return legacyDouble<Renderer>({
    getContext: () => legacyDouble<WebGL2RenderingContext>({}),
    properties: { has: () => false, get: object => object, remove: () => undefined, update: () => undefined, dispose: () => undefined },
    render: () => undefined,
    renderBufferDirect: () => undefined,
  });
}

test('an uploaded live source releases its one-shot completion capture', async () => {
  await realGc('src/engine/render/memory-saver-lifetime.test.ts', 'an uploaded live source releases', async collect => {
    vi.stubGlobal('ImageBitmap', DecodedImage);
    vi.stubGlobal('WebGL2RenderingContext', EventTarget);
    const renderer = uploadRenderer(), texture = new Texture(new DecodedImage()), completed = { calls: 0, byte: 0 };
    installMemorySaver(renderer);
    try {
      const backing = (() => {
        const bytes = new Uint8Array(1024 * 1024);bytes[0] = 73;
        releaseOnUpload(texture.source, () => { completed.calls++;completed.byte = bytes[0] ?? 0; });
        renderer.properties.get(texture);
        texture.onUpdate?.(texture);
        return new WeakRef(bytes.buffer);
      })();
      expect(completed).toEqual({ calls: 1, byte: 73 });
      expect(texture.source.data).toEqual({ width: 16, height: 16 });
      await collect(backing);
      renderer.properties.get(texture);texture.onUpdate?.(texture);
      expect(completed.calls).toBe(1);
      expect(texture.source.data).toEqual({ width: 16, height: 16 });
    } finally { texture.dispose(); }
  });
});
