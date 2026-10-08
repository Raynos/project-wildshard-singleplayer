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

it('retires the exact private panorama decode after upload with Memory saver ON', async () => {
  const developer = isDev(); setDev(true); overrideSetting('memorySaver', 'on');
  vi.stubGlobal('ImageBitmap', Bitmap);
  vi.stubGlobal('WebGL2RenderingContext', class WebGL2Marker { readonly webgl2 = true; });
  const renderer = legacyDouble<Renderer>({
    capabilities: legacyDouble<Renderer['capabilities']>({ getMaxAnisotropy: () => 8 }),
    getContext: () => legacyDouble<WebGLRenderingContext>({}),
    properties: legacyDouble<Renderer['properties']>({ get: () => ({}) }),
    renderBufferDirect: () => undefined,
  });
  const owner = new Scope('panorama'), image = new Bitmap();
  try {
    installMemorySaver(renderer);
    const dome = await SkyDomeV2.load(renderer, new Texture(), owner, { image: () => Promise.resolve(image), compressed: () => Promise.resolve(null) });
    if (dome === null) throw new Error('The authored image fallback must load');
    const texture = dome.uniforms.tPano.value;
    expect(texture.image).toBe(image); expect(image.close).not.toHaveBeenCalled();
    const colour = texture.colorSpace, wrap = texture.wrapS, pad = dome.uniforms.uPad.value;
    renderer.properties.get(texture); texture.onUpdate?.(texture);
    expect(image.close).toHaveBeenCalledOnce();
    expect(texture.image).toEqual({ width: 4128, height: 758 });
    expect(texture.colorSpace).toBe(colour); expect(texture.wrapS).toBe(wrap); expect(dome.uniforms.uPad.value).toBe(pad);
    owner.dispose(); expect(image.close).toHaveBeenCalledOnce();
    // Another disposal or upload cannot close the bitmap twice.
    owner.dispose(); texture.onUpdate?.(texture); expect(image.close).toHaveBeenCalledOnce();
    dome.mesh.geometry.dispose(); texture.dispose();
  } finally { owner.dispose(); overrideSetting('memorySaver', null); setDev(developer); vi.unstubAllGlobals(); }
});

it('closes a loaded panorama that retires before its first upload', async () => {
  vi.stubGlobal('ImageBitmap', Bitmap);
  const owner = new Scope('unseen-sky'), image = new Bitmap();
  const renderer = legacyDouble<Renderer>({ capabilities: legacyDouble<Renderer['capabilities']>({ getMaxAnisotropy: () => 1 }) });
  try {
    const dome = await SkyDomeV2.load(renderer, new Texture(), owner, { image: () => Promise.resolve(image), compressed: () => Promise.resolve(null) });
    expect(image.close).not.toHaveBeenCalled();
    owner.dispose(); expect(image.close).toHaveBeenCalledOnce();
    dome?.mesh.geometry.dispose(); dome?.uniforms.tPano.value.dispose();
  } finally { owner.dispose(); vi.unstubAllGlobals(); }
});
