import { expect, it, vi } from 'vitest';
import { Texture } from 'three';
import type { Renderer } from '../../../src/engine/render/renderer';
import { Scope } from '../../../src/engine/app/scope';
import { SkyDomeV2 } from '../../../src/shards/nalati-grasslands/look/sky';
import { legacyDouble } from '../../fake/FakeGame';

class Bitmap { width = 4096; height = 512; close = vi.fn<() => void>(); }
const renderer = legacyDouble<Renderer>({ capabilities: legacyDouble<Renderer['capabilities']>({ getMaxAnisotropy: () => 1 }) });

it('the actual asynchronous sky publishes no bitmap path after retirement or a late decode', async () => {
  const window = {}; vi.stubGlobal('window', window); vi.stubGlobal('ImageBitmap', Bitmap);
  const loads = { image: vi.fn<() => Promise<Bitmap>>(), compressed: () => Promise.resolve(null) }; 
  try {
    const scope = new Scope('sky'), image = new Bitmap(); loads.image.mockResolvedValueOnce(image);
    const dome = await SkyDomeV2.load(renderer, new Texture(), scope, loads);
    expect(dome).not.toBeNull(); expect(Reflect.get(window, '__skyV2')).toBe(dome?.uniforms);
    expect(dome?.uniforms.tPano.value.image).toBe(image);
    scope.dispose(); expect(Object.hasOwn(window, '__skyV2')).toBe(false);
    const lateOwner = new Scope('late'), lateImage = new Bitmap();
    let finish: (image: Bitmap) => void = () => { throw new Error('decode not started'); };
    loads.image.mockReturnValueOnce(new Promise<Bitmap>((resolve) => { finish = resolve; }));
    const pending = SkyDomeV2.load(renderer, new Texture(), lateOwner, loads);
    await vi.waitFor(() => { expect(loads.image).toHaveBeenCalledTimes(2); });
    lateOwner.dispose(); finish(lateImage);
    expect(await pending).toBeNull(); expect(lateImage.close).toHaveBeenCalledOnce();
    expect(Object.hasOwn(window, '__skyV2')).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});
