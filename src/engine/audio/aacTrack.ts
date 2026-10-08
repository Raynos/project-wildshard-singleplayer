import { indexAac, type AacIndex } from './aacIndex';
import { AacPull, type AacCodecFactory } from './aacPull';
import { nativeAacFactory } from './aacNative';
import { AacWindows, aacWindowEligible, type AacWindow } from './aacWindows';
import { Scope } from '../app/scope';

/** Ten seconds protect the native sources from multi-second main-thread installs without whole-track PCM. */
export const AAC_PREFILL_FRAMES = 480000;
export interface AacPreparedWindow { readonly plan: AacWindow; readonly buffer: AudioBuffer }
export type AacBufferFactory = (frames: number) => AudioBuffer;
/** Encoded track plus a transferable bounded prebuffer; never a whole decoded recording. */
export class AacTrack {
  readonly duration: number;
  readonly sampleRate = 48000;
  readonly loopStart: number;
  readonly loopEnd: number;
  readonly frames: number;
  readonly bytes: Uint8Array;
  readonly index: AacIndex;
  readonly factory: AacCodecFactory;
  private prepared: readonly AacPreparedWindow[] | undefined;
  private preparing: Promise<void> | undefined;
  private fallback: Promise<AudioBuffer> | undefined;
  private readonly decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>;
  private readonly makeBuffer: AacBufferFactory;
  private constructor(bytes: Uint8Array, index: AacIndex, factory: AacCodecFactory, loopStart: number, loopEnd: number,
    decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>, makeBuffer: AacBufferFactory) {
    this.bytes = bytes; this.index = index; this.factory = factory; this.loopStart = loopStart; this.loopEnd = loopEnd;
    this.frames = index.sizes.length * 1024 - index.primingFrames; this.duration = this.frames / 48000;
    this.decode = decode; this.makeBuffer = makeBuffer;
  }
  get ready(): boolean { return this.prepared !== undefined; }
  /** Move prebuffer ownership to the playing source, so the bank cannot retain already-ended PCM. */
  take(): readonly AacPreparedWindow[] {
    const result = this.prepared;
    if (!result) throw new Error('AAC prebuffer is not ready');
    this.prepared = undefined;
    return result;
  }
  /** Replay re-primes short windows before the bar handoff; concurrent requests share the same bounded work. */
  prime(owner?: Scope): Promise<void> {
    if (owner?.disposed) return Promise.reject(new Error('AAC preparation owner retired'));
    if (this.prepared) return Promise.resolve();
    if (this.preparing) return this.preparing;
    const work = this.fill(owner).finally(() => { if (this.preparing === work) this.preparing = undefined; });
    this.preparing = work;
    return work;
  }
  private async fill(owner?: Scope): Promise<void> {
    const scope = owner?.child('AAC.prepare') ?? new Scope('AAC.prepare');
    const pull = new AacPull(this.bytes, this.index, this.factory, scope), plans = new AacWindows(this.loopStart, this.loopEnd, this.frames);
    const windows: AacPreparedWindow[] = [];
    try {
      for (;;) {
        const plan = plans.next();
        if (plan.timeline >= AAC_PREFILL_FRAMES) break;
        const buffer = this.makeBuffer(plan.frames);
        for (const part of plan.parts) {
          const pcm = await pull.read(part.start, part.frames);
          if (scope.disposed) throw new Error('AAC preparation owner retired');
          buffer.getChannelData(0).set(pcm[0], part.destination); buffer.getChannelData(1).set(pcm[1], part.destination);
        }
        windows.push({ plan, buffer });
      }
      this.prepared = windows;
    } finally { scope.dispose(); }
  }
  /** Original-path fallback for an unsupported live sample rate; concurrent attempts share, failures can retry. */
  decoded(): Promise<AudioBuffer> {
    if (this.fallback) return this.fallback;
    const work = this.decode(this.bytes.slice().buffer);
    this.fallback = work;
    void work.catch(() => { if (this.fallback === work) this.fallback = undefined; });
    return work;
  }
  /** Prepare without opening an audio device. Unsupported native APIs, file layouts or fractional cuts
   * return undefined. Short AudioBuffers are context-independent; the injected factory supports headless
   * lifecycle proofs. Successful playback takes their ownership; a later replay primes them again. */
  static async prepare(bytes: Uint8Array, loopStartSeconds: number, loopEndSeconds: number,
    decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>, factory?: AacCodecFactory, owner?: Scope,
    makeBuffer?: AacBufferFactory): Promise<AacTrack | undefined> {
    if (owner?.disposed) return undefined;
    const buffers = makeBuffer ?? (typeof AudioBuffer === 'function'
      ? (frames: number): AudioBuffer => new AudioBuffer({ length: frames, numberOfChannels: 2, sampleRate: 48000 }) : undefined);
    if (!buffers) return undefined;
    const loopStart = loopStartSeconds * 48000, loopEnd = loopEndSeconds * 48000;
    let index: AacIndex;
    try { index = indexAac(bytes); } catch { return undefined; }
    const frames = index.sizes.length * 1024 - index.primingFrames;
    if (!aacWindowEligible(48000, loopStart, loopEnd, frames)) return undefined;
    const native = factory ?? await nativeAacFactory(index);
    if (!native || owner?.disposed) return undefined;
    const track = new AacTrack(bytes, index, native, loopStart, loopEnd, decode, buffers);
    try { await track.prime(owner); return track; } catch { return undefined; }
  }
}
