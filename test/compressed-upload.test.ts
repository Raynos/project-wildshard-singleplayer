import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import * as ktx2 from '../src/engine/core/ktx2';
import { loadTexture } from '../src/engine/core/assets';
import { compressedUploadsActive, uploadCompressedTexture } from '../src/engine/render/compressedUpload';
import { compressedTextureKey } from '../src/engine/render/compressedMipmaps';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

const texture = (array = false): THREE.CompressedTexture => {
  const mips = [{ data: new Uint8Array(16), width: 4, height: 4 }];
  return array ? new THREE.CompressedArrayTexture(mips, 4, 4, 2, THREE.RGBA_ASTC_4x4_Format)
    : new THREE.CompressedTexture(mips, 4, 4, THREE.RGBA_ASTC_4x4_Format);
};
async function fixture(run: (renderer: THREE.WebGLRenderer, events: string[], setError: (error: number) => void) => Promise<void>): Promise<void> {
  const previous = scopeEnvironment(), events: string[] = [];
  let frame = 0, error = 0;
  installScopeEnvironment({ targetKind: () => 'other', frame: render => {
    queueMicrotask(() => { frame++; events.push(`paint:${frame}`); render(frame); }); return 1;
  }, cancelFrame: () => undefined });
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer prototype');
  const properties = new WeakMap<object, Record<string, unknown>>();
  const get = (value: object): Record<string, unknown> => {
    let row = properties.get(value);
    if (row === undefined) { row = {}; properties.set(value, row); }
    return row;
  };
  Reflect.set(renderer, 'properties', { get });
  Reflect.set(renderer, 'initTexture', (value: THREE.Texture) => {
    events.push(`upload:${frame}:${value.id}`);
    if (!(value instanceof THREE.CompressedTexture)) throw new Error('Expected compressed texture');
    // Match the native failure: a new sampler needs level-zero dimensions before allocation.
    if (!value.mipmaps[0]) throw new Error('Missing level-zero width');
    Object.assign(get(value), { __version: value.version, __cacheKey: compressedTextureKey(value), __webglTexture: {} });
    Object.assign(get(value.source), { __version: value.source.version });
    value.addEventListener('dispose', () => { properties.delete(value); });
    value.onUpdate?.(value);
  });
  Reflect.set(renderer, 'getContext', () => ({ NO_ERROR: 0, isContextLost: () => false, getError: () => { events.push(`fence:${frame}`); return error; } }));
  try { await run(renderer, events, value => { error = value; }); }
  finally { installScopeEnvironment(previous); }
}
it('serializes concurrent late 2D and warm-up array requests on the same renderer', async () => {
  await fixture(async (renderer, events) => {
    expect(compressedUploadsActive(renderer)).toBe(false);
    await Promise.all([uploadCompressedTexture(renderer, texture()), uploadCompressedTexture(renderer, texture(true)), uploadCompressedTexture(renderer, texture())]);
    expect(compressedUploadsActive(renderer)).toBe(true);
    const uploads = events.filter(event => event.startsWith('upload:'));
    expect(uploads).toHaveLength(3);
    expect(new Set(uploads.map(event => event.split(':')[1])).size).toBe(3);
    for (const upload of uploads) {
      const index = events.indexOf(upload);
      expect(events[index - 1]).toBe(`paint:${upload.split(':')[1]}`);
      expect(events[index + 1]).toBe(`fence:${upload.split(':')[1]}`);
      expect(events[index + 2]).toMatch(/^paint:/u);
    }
  });
});
it('publishes a late consumer only after its fenced paint, and deduplicates identical versions', async () => {
  await fixture(async (renderer, events) => {
    const value = texture();
    await Promise.all([uploadCompressedTexture(renderer, value), uploadCompressedTexture(renderer, value)]);
    events.push('bound'); await uploadCompressedTexture(renderer, value);
    expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(1);
    expect(events.at(-2)).toMatch(/^paint:/u); expect(events.at(-1)).toBe('bound');
    value.needsUpdate = true; await uploadCompressedTexture(renderer, value);
    expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(2);
  });
});
it('refuses a failed upload without publishing readiness and allows a later retry', async () => {
  await fixture(async (renderer, events, setError) => {
    const value = texture(); setError(1282);
    await expect(uploadCompressedTexture(renderer, value)).rejects.toThrow('Graphics error 1282');
    setError(0);
    await expect(uploadCompressedTexture(renderer, value)).rejects.toThrow('Graphics error 1282');
    expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(1);
    value.dispose(); await uploadCompressedTexture(renderer, value);
    expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(2);
  });
});

it('does not publish native residency until the in-flight paint fence completes', async () => {
  await fixture(async (renderer, events) => {
    const value = ktx2.releaseAfterUpload(texture()); value.needsUpdate = true;
    const init = renderer.initTexture.bind(renderer);
    let second: Promise<void> | undefined;
    Reflect.set(renderer, 'initTexture', (input: THREE.Texture) => {
      init(input);
      second = uploadCompressedTexture(renderer, input).then(() => { events.push('second-bound'); return undefined; });
      expect(value.mipmaps).not.toEqual([]);
    });
    await uploadCompressedTexture(renderer, value);
    await second;
    const bound = events.indexOf('second-bound');
    expect(events[bound - 1]).toMatch(/^paint:/u);
    expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(1);
    expect(value.mipmaps).toEqual([]);
  });
});

it('retains a provisional glTF atlas through the LeverRifle anisotropy change and releases at its final fence', async () => {
  await fixture(async (renderer, events) => {
    const value = ktx2.releaseAfterUpload(texture()); value.needsUpdate = true;
    const original = value.mipmaps;
    await uploadCompressedTexture(renderer, value, () => true, false);
    expect(value.mipmaps).toBe(original);
    // LeverRifle.atlasOf runs only after GLTFLoader resolves its provisional upload.
    value.anisotropy = 8; value.needsUpdate = true;
    await uploadCompressedTexture(renderer, value);
    expect(value.mipmaps).toEqual([]);
    expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(2);
    await uploadCompressedTexture(renderer, value);
    expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(2);
  });
});

it('recognizes an externally uploaded resident and rejects released mips after disposal or a sampler change', async () => {
  await fixture(async (renderer, events) => {
    const value = ktx2.releaseAfterUpload(texture()); value.needsUpdate = true;
    renderer.initTexture(value); expect(value.mipmaps).toEqual([]);
    await uploadCompressedTexture(renderer, value);
    expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(1);
    value.anisotropy = 8;
    await expect(uploadCompressedTexture(renderer, value)).rejects.toThrow('no mipmaps and is not resident');
    value.anisotropy = 1; value.dispose();
    await expect(uploadCompressedTexture(renderer, value)).rejects.toThrow('no mipmaps and is not resident');
    const clone = value.clone();
    await expect(uploadCompressedTexture(renderer, clone)).rejects.toThrow('no mipmaps and is not resident');
    expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(1);
  });
});

it('applies a caller sampler before the loadTexture publication fence', async () => {
  const value = texture();
  vi.spyOn(ktx2, 'ktx2Texture').mockResolvedValue(value);
  vi.spyOn(ktx2, 'prepareCompressedTexture').mockImplementation(<T extends THREE.Texture>(final: T): Promise<T> => {
    expect(final.wrapS).toBe(THREE.ClampToEdgeWrapping); expect(final.anisotropy).toBe(8); return Promise.resolve(final);
  });
  await loadTexture('/cards.ktx2', true, 1, undefined, final => {
    final.wrapS = final.wrapT = THREE.ClampToEdgeWrapping; final.anisotropy = 8;
  });
});
it('refuses cancelled or mutated queued versions before uploading', async () => {
  await fixture(async (renderer, events) => {
    await expect(uploadCompressedTexture(renderer, texture(), () => false)).rejects.toThrow('owner left');
    const value = texture(), pending = uploadCompressedTexture(renderer, value); value.needsUpdate = true;
    await expect(pending).rejects.toThrow('changed before upload');
    expect(events.filter(event => event.startsWith('upload:'))).toEqual([]);
  });
});


it('withholds a late loadTexture result until its final sampler upload resolves', async () => {
  const value = texture();
  let release = (): void => { throw new Error('No upload gate'); };
  const gate = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(ktx2, 'ktx2Texture').mockResolvedValue(value);
  const prepare = vi.spyOn(ktx2, 'prepareCompressedTexture').mockImplementation(async <T extends THREE.Texture>(final: T): Promise<T> => {
    expect(final.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(final.wrapS).toBe(THREE.RepeatWrapping);
    expect(final.repeat.x).toBe(3);
    await gate; return final;
  });
  let bound = false;
  const pending = loadTexture('/fixture.ktx2', true, 3).then(result => { bound = true; return result; });
  await Promise.resolve(); await Promise.resolve();
  expect(prepare).toHaveBeenCalledTimes(1); expect(bound).toBe(false);
  release(); expect(await pending).toBe(value); expect(bound).toBe(true);
});

it('propagates a late upload failure instead of publishing an unfenced texture', async () => {
  vi.spyOn(ktx2, 'ktx2Texture').mockResolvedValue(texture());
  vi.spyOn(ktx2, 'prepareCompressedTexture').mockRejectedValue(new Error('Graphics error 1282'));
  await expect(loadTexture('/fixture.ktx2')).rejects.toThrow('Graphics error 1282');
});
