// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import type { WebGLRenderer } from 'three';
import * as bytes from '../../src/engine/boot/bytes';
import * as ktx from '../../src/engine/core/ktx2';
import { loadTexture } from '../../src/engine/core/assets';
import { installMemorySaver } from '../../src/engine/render/memorySaver';
import { isDev, setDev } from '../../src/engine/core/devMode';
import { overrideSetting } from '../../src/engine/ui/Settings';
import { legacyDouble } from '../fake/FakeGame';

it('shares a pending image but decodes a new source after the uploaded image has retired', async () => {
  const wasDeveloper = isDev();
  setDev(true);
  overrideSetting('memorySaver', 'on');
  vi.stubGlobal('WebGL2RenderingContext', class WebGL2Marker { readonly webgl2 = true; });
  const decode = vi.spyOn(bytes, 'fetchImage').mockImplementation(() => {
    const image = document.createElement('img'); image.width = image.height = 16;
    return Promise.resolve(image);
  });
  vi.spyOn(ktx, 'ktx2Texture').mockResolvedValue(null);
  const renderer = legacyDouble<WebGLRenderer>({
    getContext: () => legacyDouble<WebGLRenderingContext>({}),
    properties: legacyDouble<WebGLRenderer['properties']>({ get: () => ({}) }),
    renderBufferDirect: () => undefined,
  });
  installMemorySaver(renderer);
  try {
    const first = await loadTexture('/fixture/regional-paint.jpg');
    const shared = await loadTexture('/fixture/regional-paint.jpg');
    expect(first.source).toBe(shared.source); expect(decode).toHaveBeenCalledOnce();
    renderer.properties.get(first); first.onUpdate?.(first);
    first.dispose(); shared.dispose();
    const next = await loadTexture('/fixture/regional-paint.jpg');
    expect(next.source).not.toBe(first.source); expect(decode).toHaveBeenCalledTimes(2);
    expect(next.image).toBeInstanceOf(HTMLImageElement);
    next.dispose();
  } finally { overrideSetting('memorySaver', null); setDev(wasDeveloper); vi.unstubAllGlobals(); }
});
