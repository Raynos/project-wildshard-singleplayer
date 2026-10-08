// oxlint-disable-next-line import/no-nodejs-modules -- Prepare bounded windows from the same committed encoded title used by the native proof.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { AacTrack } from '../../../src/engine/audio/aacTrack';
import type { AacCodecFactory } from '../../../src/engine/audio/aacPull';

const title = (): Uint8Array => readFileSync(new URL('../../../public/assets/music/piano/title-3d1f713a.m4a', import.meta.url));
function native(): { factory: AacCodecFactory; counts: { outputs: number; closedData: number; closedCodec: number } } {
  const counts = { outputs: 0, closedData: 0, closedCodec: 0 };
  const factory: AacCodecFactory = output => ({
    decode: () => {
      counts.outputs++;
      output({ numberOfFrames: 1024, numberOfChannels: 2, sampleRate: 48000,
        copyTo: (destination, { planeIndex }) => { destination.fill(planeIndex + .25); }, close: () => { counts.closedData++; } });
    }, flush: () => Promise.resolve(), close: () => { counts.closedCodec++; },
  });
  return { factory, counts };
}

describe('boot-neutral bounded AAC preparation', () => {
  it('prepares only the first short window and retires native work before publishing', async () => {
    const codec = native(); let decoded = 0;
    const track = await AacTrack.prepare(title(), 27.3995, 59.118, () => { decoded++; return Promise.reject(new Error('Unexpected full decode')); }, codec.factory);
    if (!track) throw new Error('Supported track missing');
    expect(track.duration).toBe(2990080 / 48000); expect(track.first.timeline).toBe(0);
    expect(track.pcm[0]).toHaveLength(24032); expect(track.pcm[0][0]).toBe(.25); expect(track.pcm[1][0]).toBe(1.25);
    expect(decoded).toBe(0); expect(codec.counts.outputs).toBeLessThanOrEqual(32);
    expect(codec.counts.closedData).toBe(codec.counts.outputs); expect(codec.counts.closedCodec).toBe(1);
    expect(track.pcm[0].byteLength + track.pcm[1].byteLength).toBe(192256);
  });

  it('coalesces original-path fallback, keeps encoded bytes intact and retries a failed decode', async () => {
    const codec = native(), bytes = title(); let decodes = 0, fail = true;
    const decoded = { duration: 62 } as AudioBuffer;
    const track = await AacTrack.prepare(bytes, 27.3995, 59.118, copy => {
      decodes++; expect(copy.byteLength).toBe(bytes.byteLength); expect(new Uint8Array(copy)[0]).toBe(bytes[0]);
      return fail ? Promise.reject(new Error('Decode failed')) : Promise.resolve(decoded);
    }, codec.factory);
    if (!track) throw new Error('Supported track missing');
    const first = track.decoded(); expect(track.decoded()).toBe(first); await expect(first).rejects.toThrow('Decode failed');
    fail = false; expect(await track.decoded()).toBe(decoded); expect(await track.decoded()).toBe(decoded); expect(decodes).toBe(2);
    expect(bytes.byteLength).toBeGreaterThan(700000);
  });

  it('does not publish a prepared source after its explicit boot owner retires', async () => {
    const codec = native(), owner = new Scope('boot.aac');
    const pending = AacTrack.prepare(title(), 27.3995, 59.118, () => Promise.reject(new Error('No fallback expected')), codec.factory, owner);
    owner.dispose(); expect(await pending).toBeUndefined(); expect(codec.counts.closedCodec).toBe(1);
    expect(owner.census.disposers).toBe(0);
  });

  it('leaves unsupported layouts / fractional cuts / failed native preparation to the old decoder', async () => {
    let attempted = 0;
    const bad: AacCodecFactory = () => { attempted++; throw new Error('Native unavailable'); };
    const decode = (): Promise<AudioBuffer> => Promise.reject(new Error('Must be selected by caller'));
    expect(await AacTrack.prepare(Uint8Array.of(1), 0, 10, decode, bad)).toBeUndefined();
    expect(await AacTrack.prepare(title(), 27.39951, 59.118, decode, bad)).toBeUndefined(); expect(attempted).toBe(0);
    expect(await AacTrack.prepare(title(), 27.3995, 59.118, decode, bad)).toBeUndefined(); expect(attempted).toBe(1);
  });
});
