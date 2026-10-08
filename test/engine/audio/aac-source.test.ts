// oxlint-disable-next-line import/no-nodejs-modules -- Build the bounded descriptor from the real admitted compressed recording.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { AacTrack } from '../../../src/engine/audio/aacTrack';
import { AacSource } from '../../../src/engine/audio/aacSource';
import type { AacCodecFactory } from '../../../src/engine/audio/aacPull';
import { pcmBuffer } from './pcm-buffer';

class Source extends EventTarget {
  buffer: AudioBuffer | null = null;
  readonly detune = { value: 0 } as AudioParam;
  readonly playbackRate = { value: 1 } as AudioParam;
  channelCount = 2;
  channelCountMode: ChannelCountMode = 'max';
  channelInterpretation: ChannelInterpretation = 'speakers';
  readonly numberOfInputs = 0;
  readonly numberOfOutputs = 1;
  onended: ((this: AudioScheduledSourceNode, event: Event) => unknown) | null = null;
  constructor(readonly context: BaseAudioContext) { super(); }
  loop = false; loopStart = 0; loopEnd = 0;
  startAt = Infinity; stopAt = Infinity; offset = 0; ended = false;
  connect(destination: AudioNode): AudioNode;
  connect(destination: AudioParam): void;
  connect(destination: AudioNode | AudioParam): AudioNode | void { if ('context' in destination) return destination; }
  disconnect(): void { /* No hardware graph in this lifecycle fixture. */ }
  start(at: number, offset: number): void { this.startAt = at; this.offset = offset; }
  stop(at = 0): void { this.stopAt = at; }
  advance(time: number): void { if (!this.ended && this.stopAt <= time) { this.ended = true; this.dispatchEvent(new Event('ended')); } }
}
function fakeContext(rate = 48000): { ctx: BaseAudioContext; sources: Source[]; advance: (time: number) => void } {
  let time = 0; const sources: Source[] = [];
  const ctx = { sampleRate: rate, get currentTime() { return time; },
    createBuffer: (channels: number, frames: number, sampleRate: number): AudioBuffer => {
      const data = Array.from({ length: channels }, () => new Float32Array(frames));
      return { length: frames, sampleRate, numberOfChannels: channels, duration: frames / sampleRate,
        getChannelData: (channel: number): Float32Array<ArrayBuffer> => {
          const result = data[channel]; if (!result) throw new Error('Invalid channel'); return result;
        } } as AudioBuffer;
    },
    createBufferSource: (): AudioBufferSourceNode => { const source = new Source(ctx); sources.push(source); return source as AudioBufferSourceNode; },
  } as BaseAudioContext;
  return { ctx, sources, advance: value => { time = value; for (const source of sources) source.advance(value); } };
}
const factory: AacCodecFactory = output => ({ decode: () => {
  output({ numberOfFrames: 1024, numberOfChannels: 2, sampleRate: 48000,
    copyTo: destination => { destination.fill(.25); }, close: () => undefined });
}, flush: () => Promise.resolve(), close: () => undefined });
async function track(): Promise<AacTrack> {
  const bytes = readFileSync(new URL('../../../public/assets/music/piano/title-3d1f713a.m4a', import.meta.url));
  const result = await AacTrack.prepare(bytes, 27.3995, 59.118, () => Promise.reject(new Error('No whole decode expected')), factory, undefined, pcmBuffer);
  if (!result) throw new Error('Track not prepared'); return result;
}
async function settle(): Promise<void> { for (let i = 0; i < 100; i++) await Promise.resolve(); }

describe('bounded live native-source lifecycle', () => {
  it('keeps a fixed horizon through the authored loop, drops ended PCM and stops exactly once', async () => {
    const prepared = await track(), owner = new Scope('live.aac'), world = fakeContext(); let failed = 0, ended = 0;
    const source = new AacSource(prepared, { context: world.ctx, output: {} as AudioNode, scope: owner,
      failed: () => { failed++; }, ended: () => { ended++; } }, .05);
    try {
      const pending = source.pump(); expect(source.pump()).toBe(pending); await pending;
      await settle(); expect(source.residentWindows).toBeLessThanOrEqual(48);
      for (let step = 1; step <= 280; step++) {
        world.advance(step * .25); await source.pump();
        expect(source.residentWindows).toBeLessThanOrEqual(48);
        for (const retired of world.sources.filter(value => value.ended)) expect(retired.buffer).toBeNull();
      }
      expect(failed).toBe(0); expect(world.sources.some(value => value.loop)).toBe(true);
      expect(source.peakWindows).toBeLessThanOrEqual(48);
      source.stop(70.3); world.advance(70.4); await settle();
      expect(ended).toBe(1); expect(source.residentWindows).toBe(0);
      expect(world.sources.every(value => value.buffer === null)).toBe(true);
    } finally { owner.dispose(); }
    expect(owner.census.sounds).toBe(0); expect(owner.census.listeners).toBe(0); expect(owner.census.timers).toBe(0);
  });

  it('fails a missed deadline without skipping samples or publishing more windows', async () => {
    const prepared = await track(), owner = new Scope('late.aac'), world = fakeContext(), failures: unknown[] = [];
    const source = new AacSource(prepared, { context: world.ctx, output: {} as AudioNode, scope: owner,
      failed: error => { failures.push(error); }, ended: () => undefined }, .05);
    await source.pump(); world.advance(14); await source.pump(); await settle();
    expect(failures).toHaveLength(1); expect(String(failures[0])).toContain('exact scheduling deadline');
    expect(source.residentWindows).toBe(0); expect(world.sources).toHaveLength(20);
    expect(world.sources[0]?.buffer).toBeNull(); owner.dispose();
  });

  it('does not allocate for unsupported live rates or a retired owner', async () => {
    const prepared = await track(), owner = new Scope('refused.aac'), world = fakeContext(44100);
    const ports = { context: world.ctx, output: {} as AudioNode, scope: owner, failed: () => undefined, ended: () => undefined };
    expect(() => new AacSource(prepared, ports, .05)).toThrow('48 kHz'); expect(world.sources).toHaveLength(0);
    owner.dispose(); expect(() => new AacSource(prepared, { ...ports, context: fakeContext().ctx }, .05)).toThrow('live owner');
  });

  it('retires all source buffers on parent disposal while further pulls are pending', async () => {
    const prepared = await track(), owner = new Scope('cancel.aac'), world = fakeContext(); let failed = 0;
    const source = new AacSource(prepared, { context: world.ctx, output: {} as AudioNode, scope: owner,
      failed: () => { failed++; }, ended: () => undefined }, .05);
    owner.dispose(); await settle();
    expect(failed).toBe(0); expect(source.residentWindows).toBe(0);
    expect(world.sources.every(value => value.buffer === null)).toBe(true); expect(owner.census.disposers).toBe(0);
  });
});
