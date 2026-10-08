// @vitest-environment happy-dom
// SF57 (E435): a trimmed decode (`loadTexture(url, …, maxSize)` below the tier's cap) is cached under `url@size`; its
// release after the upload deletes that same key, so N trimmed load / upload cycles keep the decode cache flat.
import { expect, it, vi } from 'vitest';
import type { WebGLRenderer } from 'three';
import * as bytes from '../../src/engine/boot/bytes';
import * as ktx from '../../src/engine/core/ktx2';
import { decodedImageCount, loadTexture } from '../../src/engine/core/assets';
import { TIER_CONFIG } from '../../src/engine/core/tier';
import { installMemorySaver } from '../../src/engine/render/memorySaver';
import { isDev, setDev } from '../../src/engine/core/devMode';
import { overrideSetting } from '../../src/engine/ui/Settings';
import { legacyDouble } from '../fake/FakeGame';

it('releases a trimmed decode under the key it was cached by, cycle after cycle', async () => {
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
  const trimmed = Math.max(1, TIER_CONFIG.maxTexture / 4);
  try {
    const base = decodedImageCount();
    for (let i = 0; i < 6; i++) {
      const t = await loadTexture('/fixture/trimmed-building.jpg', true, 1, trimmed);
      const full = await loadTexture('/fixture/trimmed-building.jpg', true, 1);
      expect(decodedImageCount()).toBe(base + 2); // the trimmed decode and the full one are two images
      renderer.properties.get(t); t.onUpdate?.(t);
      expect(decodedImageCount()).toBe(base + 1); // the trimmed one is gone, by its own key
      renderer.properties.get(full); full.onUpdate?.(full);
      expect(decodedImageCount()).toBe(base);
      t.dispose(); full.dispose();
    }
    expect(decode).toHaveBeenCalledTimes(12);
    expect(decode.mock.calls.filter((c) => c[1] === trimmed)).toHaveLength(6);
  } finally { overrideSetting('memorySaver', null); setDev(wasDeveloper); vi.unstubAllGlobals(); }
});
