// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { Texture } from 'three';
import type { Renderer } from '../../../src/engine/render/renderer';
import { Scope } from '../../../src/engine/app/scope';
import { isDev, setDev } from '../../../src/engine/core/devMode';
import { overrideSetting } from '../../../src/engine/ui/Settings';
import { installMemorySaver } from '../../../src/engine/render/memorySaver';
import { SkyDomeV2 } from '../../../src/shards/nalati-grasslands/look/sky';
import { legacyDouble } from '../../fake/FakeGame';

class Bitmap { width = 4128; height = 758; close = vi.fn<() => void>(); }

it('keeps the immutable panorama decode until owner disposal with Memory saver OFF', async () => {
  const developer = isDev(); setDev(true); overrideSetting('memorySaver', 'off');
  vi.stubGlobal('ImageBitmap', Bitmap);
  const renderer = legacyDouble<Renderer>({ capabilities: legacyDouble<Renderer['capabilities']>({ getMaxAnisotropy: () => 8 }) });
  const owner = new Scope('panorama-off'), image = new Bitmap();
  try {
    // The OFF installer exits without even asking for a GL context.
    installMemorySaver(renderer);
    const dome = await SkyDomeV2.load(renderer, new Texture(), owner, { image: () => Promise.resolve(image), compressed: () => Promise.resolve(null) });
    if (dome === null) throw new Error('The authored image fallback must load');
    const texture = dome.uniforms.tPano.value;
    expect(texture.image).toBe(image); expect(image.close).not.toHaveBeenCalled();
    texture.onUpdate?.(texture);
    expect(texture.image).toBe(image); expect(image.close).not.toHaveBeenCalled();
    owner.dispose(); expect(image.close).toHaveBeenCalledOnce();
    owner.dispose(); expect(image.close).toHaveBeenCalledOnce();
    dome.mesh.geometry.dispose(); texture.dispose();
  } finally { owner.dispose(); overrideSetting('memorySaver', null); setDev(developer); vi.unstubAllGlobals(); }
});
