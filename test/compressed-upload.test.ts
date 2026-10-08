import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import * as ktx2 from '../src/engine/core/ktx2';
import { loadTexture } from '../src/engine/core/assets';
import { compressedUploadsActive, uploadCompressedTexture } from '../src/engine/render/compressedUpload';
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
  Reflect.set(renderer, 'initTexture', (value: THREE.Texture) => { events.push(`upload:${frame}:${value.id}`); });
  Reflect.set(renderer, 'getContext', () => ({ NO_ERROR: 0, getError: () => { events.push(`fence:${frame}`); return error; } }));
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
    setError(0); await uploadCompressedTexture(renderer, value);
    expect(events.filter(event => event.startsWith('upload:'))).toHaveLength(2);
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
