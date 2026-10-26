import { expect, test } from 'vitest';
import { Scope } from '../app/scope';
import { withOwner } from '../app/ownership';
import { legacyDouble } from '../test/FakeGame';
import { realGc } from '../test/realGc';
import { VoicePool, type Family } from './Voices';

class Pcm implements AudioBuffer {
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  private readonly channels: Float32Array<ArrayBuffer>[];
  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels; this.length = length; this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(channel: number): Float32Array<ArrayBuffer> {
    const data = this.channels[channel]; if (data === undefined) throw new Error('Missing PCM channel'); return data;
  }
  copyFromChannel(destination: Float32Array<ArrayBuffer>, channel: number, offset = 0): void {
    destination.set(this.getChannelData(channel).subarray(offset, offset + destination.length));
  }
  copyToChannel(source: Float32Array<ArrayBuffer>, channel: number, offset = 0): void {
    this.getChannelData(channel).set(source, offset);
  }
}
function fixture() {
  const owner = new Scope('voice-pool-fixture');
  const context = legacyDouble<BaseAudioContext>({ sampleRate: 48000, createBuffer: (channels, frames, rate) => new Pcm(channels, frames, rate) });
  const pool = withOwner(owner, () => new VoicePool({ ctx: context, sfx: legacyDouble<GainNode>({}), ready: true }));
  return { owner, pool };
}
const family = (value: number, frames = 16): Family => ({ n: 1, ch: 1, gen: () => new Float32Array(frames).fill(value) });

test('a replacement family renders its own PCM and old removal cannot evict the successor', () => {
  const f = fixture();
  try {
    const removeOld = f.pool.register({ 'fixture/voice': family(0.25) });
    const old = f.pool.buffer('fixture/voice');
    expect(old?.getChannelData(0)[0]).toBe(0.25);
    expect(f.pool.buffer('fixture/voice')).toBe(old);
    const remove = f.pool.register({ 'fixture/voice': family(0.75) });
    const current = f.pool.buffer('fixture/voice');
    expect(current).not.toBe(old); expect(current?.getChannelData(0)[0]).toBe(0.75);
    removeOld(); expect(f.pool.buffer('fixture/voice')).toBe(current);
    remove(); expect(f.pool.buffer('fixture/voice')).toBeUndefined();
    expect(f.pool.rendered).not.toHaveProperty('fixture/voice');
  } finally { f.owner.dispose(); }
});

test('removing an override restores the original default samples without changing another family', () => {
  const f = fixture();
  try {
    const original = f.pool.buffer('hurt'), other = f.pool.buffer('death');
    if (original === undefined) throw new Error('Missing default voice');
    const remove = f.pool.register({ hurt: family(0.125) });
    const override = f.pool.buffer('hurt');
    expect(override?.length).toBe(16); expect(override?.getChannelData(0)[0]).toBe(0.125);
    remove();
    const restored = f.pool.buffer('hurt');
    if (restored === undefined) throw new Error('Missing restored voice');
    expect([restored.length, restored.sampleRate, restored.numberOfChannels]).toEqual([original.length, original.sampleRate, original.numberOfChannels]);
    expect(restored.getChannelData(0).every((sample, index) => Object.is(sample, original.getChannelData(0)[index]))).toBe(true);
    expect(f.pool.buffer('death')).toBe(other);
  } finally { f.owner.dispose(); }
});

test('a replacement drops only its obsolete warm jobs and renders the new channel roster', () => {
  const f = fixture(), idle: (() => void)[] = [], calls: string[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    requestIdleCallback: (run: () => void): number => idle.push(run),
  } });
  const make = (name: string, channels: 1 | 2, variants: number): Family => ({ n: variants, ch: channels,
    gen: (_rate, seed, channel) => { calls.push(`${name}/${seed}/${channel}`); return new Float32Array([seed, channel]); } });
  try {
    f.pool.register({ voice: make('old', 2, 2), other: make('other', 1, 1) });
    f.pool.prewarm(['voice', 'other']);
    const first = idle.shift(); if (first === undefined) throw new Error('Missing warm job'); first();
    expect(calls).toEqual(['old/1/0']);
    f.pool.register({ voice: make('new', 1, 1) }); f.pool.prewarm(['voice']);
    // Exhaust only this finite fixture queue; a stale job must not generate
    // an undeclared extra variant under the successor's smaller roster.
    for (let turn = 0; turn < 10; turn++) { const run = idle.shift(); if (run === undefined) break; run(); }
    expect(idle).toHaveLength(0);
    expect(calls).toEqual(['old/1/0', 'other/1/0', 'new/1/0']);
    expect(f.pool.buffer('voice')?.numberOfChannels).toBe(1);
    expect(f.pool.has('voice')).toBe(true); expect(f.pool.has('other')).toBe(true);
  } finally {
    f.owner.dispose();
    if (previous === undefined) Reflect.deleteProperty(globalThis, 'window');
    else Object.defineProperty(globalThis, 'window', previous);
  }
});

const retirement = 'retired scoped voice PCM collects while its pool and unrelated family stay live';
test(retirement, async () => {
  await realGc('src/engine/audio/voice-pool-lifetime.test.ts', retirement, async collect => {
    const f = fixture(), registration = new Scope('voice-registration');
    try {
      const other = family(0.5); f.pool.register({ other }, f.owner);
      const live = f.pool.buffer('other');
      const retired = (() => {
        f.pool.register({ retired: family(0.25, 256 * 1024) }, registration);
        const buffer = f.pool.buffer('retired');
        if (buffer === undefined) throw new Error('Missing registered voice');
        return { buffer: new WeakRef(buffer), backing: new WeakRef(buffer.getChannelData(0).buffer) };
      })();
      registration.dispose();
      await collect(retired.buffer); await collect(retired.backing);
      expect(f.pool.buffer('retired')).toBeUndefined(); expect(f.pool.buffer('other')).toBe(live);
      expect(f.pool.rendered).toEqual({ other: 1 });
    } finally { registration.dispose(); f.owner.dispose(); }
  });
});
