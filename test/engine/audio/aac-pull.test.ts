import { describe, expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { AacPull, AAC_WINDOW_FRAMES, type AacCodecFactory, type AacOutput } from '../../../src/engine/audio/aacPull';
import type { AacIndex } from '../../../src/engine/audio/aacIndex';

function encoded(packets = 96): { bytes: Uint8Array; index: AacIndex } {
  const bytes = new Uint8Array(packets * 4), view = new DataView(bytes.buffer);
  for (let i = 0; i < packets; i++) view.setUint32(i * 4, i);
  return { bytes, index: { sampleRate: 48000, channels: 2, primingFrames: 1024, mediaFrames: packets * 1024,
    description: Uint8Array.of(0x11, 0x90), offsets: Uint32Array.from({ length: packets }, (_, i) => i * 4), sizes: new Uint32Array(packets).fill(4) } };
}
const sample = (frame: number, channel: number): number => Math.fround(((frame * (channel + 1)) % 257) / 257);
function harness(options: { wait?: Promise<void>; oversized?: boolean; fail?: boolean } = {}): {
  factory: AacCodecFactory; stats: { created: number; closed: number; dataClosed: number; batches: number[] }; late: () => void;
} {
  const stats = { created: 0, closed: 0, dataClosed: 0, batches: [] as number[] };
  let late = (): void => { /* No codec yet. */ };
  const factory: AacCodecFactory = (output, error) => {
    stats.created++;
    let closed = false;
    const pending: number[] = [];
    const deliver = (packet: number): void => {
      const data: AacOutput = { numberOfFrames: options.oversized ? 1025 : 1024, numberOfChannels: 2, sampleRate: 48000,
        copyTo: (destination, { planeIndex }) => {
          for (let i = 0; i < destination.length; i++) destination[i] = sample((packet - 1) * 1024 + i, planeIndex);
        }, close: () => { stats.dataClosed++; } };
      output(data);
    };
    late = () => deliver(1);
    let draining = false;
    const drain = async (): Promise<void> => {
      if (draining) return;
      draining = true;
      await options.wait;
      stats.batches.push(pending.length);
      if (options.fail) error(new Error('Native codec failed'));
      for (const packet of pending.splice(0)) deliver(packet);
      draining = false;
    };
    return {
      decode: ({ data }) => { pending.push(new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0)); void drain(); },
      flush: () => drain(),
      close: () => { if (!closed) { closed = true; stats.closed++; } },
    };
  };
  return { factory, stats, late: () => late() };
}
function exact(values: readonly [Float32Array, Float32Array], first: number): void {
  for (let channel = 0; channel < 2; channel++) {
    const data = values[channel]; if (!data) throw new Error('Missing channel');
    for (let i = 0; i < data.length; i++) if (data[i] !== sample(first + i, channel)) throw new Error(`PCM mismatch at ${first + i}, channel ${channel}`);
  }
}

describe('bounded native AAC pulls', () => {
  it('preserves exact sequential / overlapping / loop-back samples with bounded queues', async () => {
    const scope = new Scope('aac'), { bytes, index } = encoded(), codec = harness();
    const pull = new AacPull(bytes, index, codec.factory, scope);
    exact(await pull.read(0, AAC_WINDOW_FRAMES), 0);
    expect(pull.retainedFrames).toBeLessThanOrEqual(8 * 1024 + 64);
    exact(await pull.read(24000, AAC_WINDOW_FRAMES), 24000); // Both 32-frame interpolation guards overlap.
    exact(await pull.read(48000, 12000), 48000);
    exact(await pull.read(1024, 12000), 1024); // Replaying from the beginning preserves codec state at a loop.
    expect(codec.stats.created).toBe(2); expect(codec.stats.closed).toBe(1);
    expect(Math.max(...codec.stats.batches)).toBe(8);
    expect(codec.stats.dataClosed).toBe(codec.stats.batches.reduce((sum, size) => sum + size, 0));
    pull.dispose(); scope.dispose(); expect(codec.stats.closed).toBe(2); expect(scope.census.disposers).toBe(0);
    expect(pull.retainedFrames).toBe(0);
  });

  it('closes late outputs and cannot resurrect a disposed owner during a pending flush', async () => {
    let complete = (): void => { throw new Error('No pending flush'); };
    const wait = new Promise<void>(resolve => { complete = resolve; });
    const scope = new Scope('aac.pending'), { bytes, index } = encoded(), codec = harness({ wait });
    const pull = new AacPull(bytes, index, codec.factory, scope), pending = pull.read(0, 32);
    await expect(pull.read(0, 32)).rejects.toThrow('serialized');
    scope.dispose(); codec.late(); complete();
    await expect(pending).rejects.toThrow('retired');
    expect(codec.stats.closed).toBe(1); expect(codec.stats.dataClosed).toBe(9); expect(pull.retainedFrames).toBe(0);
    await expect(pull.read(0, 1)).rejects.toThrow('retired');
    expect(() => new AacPull(bytes, index, codec.factory, scope)).toThrow('retired');
  });

  it('rejects oversized output / failed decoders atomically and closes all native data', async () => {
    for (const options of [{ oversized: true }, { fail: true }]) {
      const scope = new Scope('aac.failure'), { bytes, index } = encoded(), codec = harness(options);
      const pull = new AacPull(bytes, index, codec.factory, scope);
      await expect(pull.read(0, 32)).rejects.toThrow(options.oversized ? 'bounds' : 'Native codec failed');
      expect(codec.stats.closed).toBe(1); expect(codec.stats.dataClosed).toBe(8);
      expect(pull.retainedFrames).toBe(0); expect(scope.census.disposers).toBe(0); scope.dispose();
    }
  });

  it('refuses invalid / excessive pulls before creating the codec or allocating returned PCM', async () => {
    const scope = new Scope('aac.bounds'), { bytes, index } = encoded(), codec = harness();
    const pull = new AacPull(bytes, index, codec.factory, scope);
    for (const [start, frames] of [[-1, 1], [0, 0], [.5, 2], [0, AAC_WINDOW_FRAMES + 1], [95 * 1024, 1]]) {
      await expect(pull.read(start ?? -1, frames ?? -1)).rejects.toThrow('bounds');
    }
    expect(codec.stats.created).toBe(0); scope.dispose();
  });
});
