import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nativeAacFactory, type NativeAacConfig, type NativeAacDecoder, type NativeAacPacket } from '../../../src/engine/audio/aacNative';
import type { AacOutput } from '../../../src/engine/audio/aacPull';
import type { AacIndex } from '../../../src/engine/audio/aacIndex';

const index: AacIndex = { sampleRate: 48000, channels: 2, description: Uint8Array.of(0x11, 0x90),
  offsets: Uint32Array.of(0), sizes: Uint32Array.of(1), primingFrames: 1024, mediaFrames: 1024 };
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
beforeAll(() => { Object.defineProperty(globalThis, 'window', { value: {}, configurable: true }); });
afterAll(() => { if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window'); });
const cleanup: (() => void)[] = [];
function install(decoder: unknown, packet: unknown): void {
  for (const [key, value] of [['AudioDecoder', decoder], ['EncodedAudioChunk', packet]] as const) {
    const old = Object.getOwnPropertyDescriptor(window, key);
    Object.defineProperty(window, key, { value, configurable: true });
    cleanup.push(() => { if (old) Object.defineProperty(window, key, old); else Reflect.deleteProperty(window, key); });
  }
}
afterEach(() => { for (const restore of cleanup.splice(0).reverse()) restore(); });
class Packet implements NativeAacPacket {
  readonly timestamp: number; readonly byteLength: number;
  constructor(init: { timestamp: number; data: Uint8Array }) { this.timestamp = init.timestamp; this.byteLength = init.data.byteLength; }
}

describe('optional native AAC adapter', () => {
  it('leaves unsupported environments on the existing path without opening a device or decoding', async () => {
    install(undefined, undefined); expect(await nativeAacFactory(index)).toBeUndefined();
    const unsupported = Object.assign(() => { throw new Error('Must not instantiate'); },
      { isConfigSupported: (): Promise<{ supported: boolean }> => Promise.resolve({ supported: false }) });
    install(unsupported, Packet); expect(await nativeAacFactory(index)).toBeUndefined();
    const rejected = Object.assign(() => { throw new Error('Must not instantiate'); },
      { isConfigSupported: (): Promise<never> => Promise.reject(new Error('Unavailable codec')) });
    install(rejected, Packet); expect(await nativeAacFactory(index)).toBeUndefined();
  });

  it('uses the admitted description and passes packet timing unchanged with idempotent close', async () => {
    let configs = 0, decodes = 0, closes = 0, flushes = 0;
    class Decoder implements NativeAacDecoder {
      constructor(init: { output: (data: AacOutput) => void; error: (error: DOMException) => void }) { expect(typeof init.output).toBe('function'); }
      static isConfigSupported(config: NativeAacConfig): Promise<{ supported: boolean }> {
        expect(config.description).toBe(index.description); return Promise.resolve({ supported: true });
      }
      configure(config: NativeAacConfig): void { expect(config.codec).toBe('mp4a.40.2'); configs++; }
      decode(packet: NativeAacPacket): void { expect(packet.timestamp).toBe(-21333); expect(packet.byteLength).toBe(1); decodes++; }
      flush(): Promise<void> { flushes++; return Promise.resolve(); }
      close(): void { closes++; }
    }
    install(Decoder, Packet);
    const factory = await nativeAacFactory(index); expect(configs).toBe(0);
    if (!factory) throw new Error('Supported native factory missing');
    const codec = factory(() => undefined, () => undefined);
    codec.decode({ data: Uint8Array.of(1), timestamp: -21333 }); await codec.flush(); codec.close(); codec.close();
    expect({ configs, decodes, flushes, closes }).toEqual({ configs: 1, decodes: 1, flushes: 1, closes: 1 });
  });

  it('closes a decoder whose configuration rejects before publication', async () => {
    let closed = 0;
    class Decoder {
      static isConfigSupported(): Promise<{ supported: boolean }> { return Promise.resolve({ supported: true }); }
      configure(): never { throw new Error('Configuration refused'); }
      close(): void { closed++; }
    }
    install(Decoder, Packet);
    const factory = await nativeAacFactory(index); if (!factory) throw new Error('Supported native factory missing');
    expect(() => factory(() => undefined, () => undefined)).toThrow('Configuration refused'); expect(closed).toBe(1);
  });
});
