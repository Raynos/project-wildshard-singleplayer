// oxlint-disable-next-line import/no-nodejs-modules -- Reads the shipped AAC pair for the native preparation fixture.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { AacTrack } from '../src/engine/audio/aacTrack';
import { indexRecordingAac } from '../src/format/aacIndex';
import { parseManifest } from '../src/engine/audio/Stems';
import type { AacCodecFactory } from '../src/engine/audio/aacPull';

class Pcm {
  readonly sampleRate = 48000;
  readonly length: number;
  readonly numberOfChannels: number;
  private readonly channels: Float32Array<ArrayBuffer>[];
  constructor(options: { length: number; numberOfChannels: number }) {
    this.length = options.length; this.numberOfChannels = options.numberOfChannels;
    this.channels = Array.from({ length: options.numberOfChannels }, () => new Float32Array(options.length));
  }
  getChannelData(index: number): Float32Array<ArrayBuffer> {
    const channel = this.channels[index]; if (!channel) throw new Error('Missing channel'); return channel;
  }
}

it('bounds paired stereo/mono preparation on the same rounded loop without whole-file decode', async () => {
  vi.stubGlobal('AudioBuffer', Pcm);
  let closed = 0;
  const raw: unknown = JSON.parse(readFileSync('public/assets/music/piano/music.json', 'utf8'));
  const spec = parseManifest(raw)?.slots['island'];
  if (!spec?.tension) throw new Error('Missing paired island score');
  const prepare = (file: string) => {
    const bytes = new Uint8Array(readFileSync(`public/assets/music/piano/${file}`));
    const channels = indexRecordingAac(bytes).channels;
    let packet = 0;
    const factory: AacCodecFactory = output => ({
      decode: () => { const value = ++packet; output({ numberOfFrames: 1024, numberOfChannels: channels, sampleRate: 48000,
        copyTo: (target, options) => { target.fill(value + options.planeIndex); }, close: () => { closed++; } }); },
      flush: () => Promise.resolve(), close: () => { /* Owned decoder ends at preparation. */ },
    });
    return AacTrack.prepare(bytes, spec.loopStart, spec.loopEnd, () => { throw new Error('Unexpected full decode'); }, factory);
  };
  try {
    const [calm, tension] = await Promise.all([prepare(spec.calm), prepare(spec.tension)]);
    if (!calm || !tension) throw new Error('Pair preparation failed');
    expect(calm.index.channels).toBe(2); expect(tension.index.channels).toBe(1);
    expect(calm.loopStart).toBe(tension.loopStart); expect(calm.loopEnd).toBe(tension.loopEnd);
    expect(Math.abs(calm.loopEnd - spec.loopEnd * 48000)).toBeLessThanOrEqual(.5);
    const left = calm.take(), right = tension.take();
    expect(left.map(window => window.plan)).toEqual(right.map(window => window.plan));
    for (const window of right) expect(window.buffer.numberOfChannels).toBe(1);
    const bytes = [...left, ...right].reduce((sum, window) => sum + window.buffer.length * window.buffer.numberOfChannels * 4, 0);
    expect(bytes).toBeLessThan(6000000); expect(closed).toBeGreaterThan(0);
    expect(calm.ready).toBe(false); expect(tension.ready).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});
