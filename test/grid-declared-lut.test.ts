// op-lut20 (E435): a look's declared learned LUT (`ExtendLook.lut`) is carried by a grid cell only while its default-off
// Debug row is on; off (the default), nothing is fetched and the frame's chain reads no LUT, exactly as before.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LookupTexture } from 'postprocessing';
import { UnsignedByteType } from 'three';
import { saveSetting, setting } from '../src/engine/ui/Settings';
import { loadCarriedLUT } from '../src/engine/boot/bakedApi';
import { LUT_SIZE } from '../src/engine/render/lut';
import { swappableLut } from '../src/game/grid/frame';

const URL_ = '/assets/test/declared-lut.bin';
const bytes = (): ArrayBuffer => new Uint8Array(LUT_SIZE ** 3 * 4).fill(128).buffer;

const realFetch = globalThis.fetch;

describe('op-lut20 declared LUT carry', () => {
  // only fetch is put back: the test setup's own stubbed globals (its storage) stay
  afterEach(() => { saveSetting('gridDeclaredLut', 'off'); globalThis.fetch = realFetch; });

  it('defaults off: no fetch, no LUT', async () => {
    const fetch = vi.fn();
    globalThis.fetch = fetch;
    expect(setting('gridDeclaredLut')).toBe('off');
    expect(await loadCarriedLUT(URL_, 'x')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('on: loads the declared file as a LUT the frame can swap in by a uniform', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(bytes())));
    globalThis.fetch = fetch;
    saveSetting('gridDeclaredLut', 'on');
    const lut = await loadCarriedLUT(URL_, 'nd-declared-lut');
    expect(fetch).toHaveBeenCalledWith(URL_);
    expect(lut).toBeInstanceOf(LookupTexture);
    if (lut === null) throw new Error('no LUT');
    expect(lut.type).toBe(UnsignedByteType);
    expect(lut.name).toBe('nd-declared-lut');
    expect(swappableLut(lut)).toBe(true);
    lut.dispose();
  });

  it('on, but the look declares none: null', async () => {
    saveSetting('gridDeclaredLut', 'on');
    expect(await loadCarriedLUT(undefined, 'x')).toBeNull();
  });
});
