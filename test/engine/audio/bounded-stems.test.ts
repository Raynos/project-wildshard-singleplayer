// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the admitted packet reader against the shipping compressed title.
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { AacTrack } from '../../../src/engine/audio/aacTrack';
import { decodeStyle } from '../../../src/engine/audio/Stems';

import { assetVersions, bootPacks, installAssetTables, musicManifests, publicBytes, sfxManifests } from '../../../src/engine/boot/tables';
import { overrideSetting } from '../../../src/engine/ui/Settings';
import { isDev, setDev } from '../../../src/engine/core/devMode';
import type { NativeAacConfig, NativeAacPacket } from '../../../src/engine/audio/aacNative';
import type { AacOutput } from '../../../src/engine/audio/aacPull';
import { pcmBuffer } from './pcm-buffer';

const state = { available: true, calls: 0, tension: undefined as string | undefined, loopStart: 27.3995 };
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window'), originalBuffer = Object.getOwnPropertyDescriptor(globalThis, 'AudioBuffer'), developer = isDev();
const tables = { bytes: publicBytes(), versions: assetVersions(), packs: bootPacks(), music: musicManifests(), sfx: sfxManifests() };
class Packet implements NativeAacPacket {
  readonly timestamp: number; readonly byteLength: number;
  constructor(init: { timestamp: number; data: Uint8Array }) { this.timestamp = init.timestamp; this.byteLength = init.data.byteLength; }
}
class Decoder {
  constructor(private readonly init: { output: (data: AacOutput) => void; error: (error: DOMException) => void }) {}
  static isConfigSupported(): Promise<{ supported: boolean }> { state.calls++; return Promise.resolve({ supported: state.available }); }
  configure(_config: NativeAacConfig): void { /* This fixture injects native capability, not a module replacement. */ }
  decode(_packet: NativeAacPacket): void {
    this.init.output({ numberOfFrames: 1024, numberOfChannels: 2, sampleRate: 48000,
      copyTo: destination => { destination.fill(.25); }, close: () => undefined });
  }
  flush(): Promise<void> { return Promise.resolve(); }
  close(): void { /* No device or native decoder was created by this fixture. */ }
}
function BufferFixture(this: object, init: { length: number }): void { Object.assign(this, pcmBuffer(init.length)); }
beforeAll(() => { Object.defineProperty(globalThis, 'AudioBuffer', { value: BufferFixture, configurable: true }); setDev(true); Object.defineProperty(globalThis, 'window', { value: { AudioDecoder: Decoder, EncodedAudioChunk: Packet }, configurable: true }); });
afterEach(() => { overrideSetting('memorySaver', null); installAssetTables(tables); });
afterAll(() => { if (originalBuffer) Object.defineProperty(globalThis, 'AudioBuffer', originalBuffer); else Reflect.deleteProperty(globalThis, 'AudioBuffer'); setDev(developer); if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window'); });
function install(): void {
  installAssetTables({ ...tables, bytes: { '/assets/music/piano/title.m4a': 1, '/assets/music/piano/tension.m4a': 1 },
    music: { piano: { slots: { title: { calm: 'title.m4a', tension: state.tension,
      bpm: 104, beatsPerBar: 4, loopStart: state.loopStart, loopEnd: 59.118 } } } } });
}
const encoded = (): ArrayBuffer => Uint8Array.from(readFileSync(new URL('../../../public/assets/music/piano/title-3d1f713a.m4a', import.meta.url))).buffer;
const decoded = { duration: 62.29333333333333 } as AudioBuffer;

beforeEach(() => { overrideSetting('memorySaver', 'on'); state.available = true; state.calls = 0; state.tension = undefined; state.loopStart = 27.3995; install(); });
describe('Memory saver unpaired music admission', () => {
  it('prepares short PCM without opening a device or decoding the whole title', async () => {
    const owner = new Scope('music.boot'), decode = vi.fn(() => Promise.resolve(decoded)), counted = vi.fn(() => undefined);
    try {
      const work = withOwner(owner, () => decodeStyle('piano', ['title'], () => Promise.resolve(encoded()), decode, counted, 'base', []));
      const bank = await work, track = bank.slots.get('title')?.calm;
      expect(track).toBeInstanceOf(AacTrack); expect(decode).not.toHaveBeenCalled(); expect(counted).toHaveBeenCalledOnce();
      if (!(track instanceof AacTrack)) throw new Error('Bounded track missing');
      expect(track.take().reduce((sum, value) => sum + value.buffer.length * 8, 0)).toBe(3849984); expect(state.calls).toBe(1);
      expect(owner.census.sounds).toBe(0); expect(owner.census.disposers).toBe(0);
    } finally { owner.dispose(); }
  });
  it('keeps row-OFF and paired stems on the original decoder', async () => {
    const decode = vi.fn(() => Promise.resolve(decoded));
    overrideSetting('memorySaver', 'off');
    const old = await decodeStyle('piano', ['title'], () => Promise.resolve(encoded()), decode, undefined, 'base', []);
    expect(old.slots.get('title')?.calm).toBe(decoded); expect(state.calls).toBe(0); expect(decode).toHaveBeenCalledOnce();
    overrideSetting('memorySaver', 'on'); state.tension = 'tension.m4a'; install(); decode.mockClear();
    const paired = await decodeStyle('piano', ['title'], () => Promise.resolve(encoded()), decode, undefined, 'base', []);
    expect(paired.slots.get('title')?.calm).toBe(decoded); expect(paired.slots.get('title')?.tension).toBe(decoded);
    expect(state.calls).toBe(0); expect(decode).toHaveBeenCalledTimes(2);
  });
  it('keeps fractional cuts and unsupported codecs on the original path', async () => {
    const decode = vi.fn(() => Promise.resolve(decoded));
    state.loopStart = 27.39951; install();
    expect((await decodeStyle('piano', ['title'], () => Promise.resolve(encoded()), decode, undefined, 'base', [])).slots.get('title')?.calm).toBe(decoded);
    expect(state.calls).toBe(0);
    state.loopStart = 27.3995; state.available = false; install();
    expect((await decodeStyle('piano', ['title'], () => Promise.resolve(encoded()), decode, undefined, 'base', [])).slots.get('title')?.calm).toBe(decoded);
    expect(state.calls).toBe(1); expect(decode).toHaveBeenCalledTimes(2);
  });
  it('does not decode or publish a late title after its boot owner retires', async () => {
    const owner = new Scope('music.cancel'), decode = vi.fn(() => Promise.resolve(decoded));
    const work = withOwner(owner, () => decodeStyle('piano', ['title'], () => Promise.resolve(encoded()), decode, undefined, 'base', []));
    owner.dispose(); expect((await work).slots.size).toBe(0); expect(decode).not.toHaveBeenCalled();
    expect(owner.census.disposers).toBe(0);
  });
});
