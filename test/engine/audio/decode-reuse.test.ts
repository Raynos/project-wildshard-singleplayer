import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { decodeBytes } from '../../../src/engine/audio/preload';

const bytes = (id: number): ArrayBuffer => Uint32Array.of(id).buffer;
let decode: (input: ArrayBuffer) => Promise<AudioBuffer>;
beforeAll(() => { vi.stubGlobal('OfflineAudioContext', class {
  decodeAudioData(input: ArrayBuffer): Promise<AudioBuffer> { return decode(input); }
}); });
afterAll(() => { vi.unstubAllGlobals(); });

describe('exact decoded-audio reuse', () => {
  it('shares a recording across concurrent boot/runtime wrappers and distinguishes different content', async () => {
    const decoder = vi.fn((): Promise<AudioBuffer> => Promise.resolve({ duration: 12 } as AudioBuffer)); decode = decoder;
    const [boot, runtime] = await Promise.all([decodeBytes(bytes(17)), decodeBytes(bytes(17))]);
    expect(runtime).toBe(boot); expect(decoder).toHaveBeenCalledTimes(1);
    expect(await decodeBytes(bytes(17))).toBe(boot);
    expect(await decodeBytes(bytes(18))).not.toBe(boot); expect(decoder).toHaveBeenCalledTimes(2);
  });

  it('retries failed work and bounds the completed weak-cache metadata', async () => {
    let fail = true;
    const decoder = vi.fn((): Promise<AudioBuffer> => fail ? Promise.reject(new Error('Broken audio'))
      : Promise.resolve({ duration: 12 } as AudioBuffer)); decode = decoder;
    await expect(decodeBytes(bytes(29))).rejects.toThrow('Broken audio');
    fail = false;
    const first = await decodeBytes(bytes(29));
    expect(await decodeBytes(bytes(29))).toBe(first);
    for (let id = 1000; id < 1256; id++) await decodeBytes(bytes(id));
    expect(await decodeBytes(bytes(29))).not.toBe(first);
    expect(decoder).toHaveBeenCalledTimes(259);
  });

  it('decodes again when the last live owner has released its recording', async () => {
    let collected = false;
    // Deterministic collection boundary: native GC timing is deliberately outside this regression.
    vi.stubGlobal('WeakRef', class {
      constructor(private readonly value: object) {}
      deref(): object | undefined { return collected ? undefined : this.value; }
    });
    const decoder = vi.fn((): Promise<AudioBuffer> => Promise.resolve({ duration: 12 } as AudioBuffer)); decode = decoder;
    const first = await decodeBytes(bytes(54));
    expect(await decodeBytes(bytes(54))).toBe(first);
    collected = true;
    expect(await decodeBytes(bytes(54))).not.toBe(first); expect(decoder).toHaveBeenCalledTimes(2);
  });
});
