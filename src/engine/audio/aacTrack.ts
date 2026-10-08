import { indexAac, type AacIndex } from './aacIndex';
import { AacPull, type AacCodecFactory } from './aacPull';
import { nativeAacFactory } from './aacNative';
import { AacWindows, aacWindowEligible, type AacWindow } from './aacWindows';
import { Scope } from '../app/scope';

/** Prepared encoded track plus one short PCM window; never a whole decoded recording. */
export class AacTrack {
  readonly duration: number;
  readonly sampleRate = 48000;
  readonly first: AacWindow;
  readonly pcm: readonly [Float32Array, Float32Array];
  readonly loopStart: number;
  readonly loopEnd: number;
  readonly frames: number;
  readonly bytes: Uint8Array;
  readonly index: AacIndex;
  readonly factory: AacCodecFactory;
  private fallback: Promise<AudioBuffer> | undefined;
  private readonly decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>;
  private constructor(bytes: Uint8Array, index: AacIndex, factory: AacCodecFactory, loopStart: number, loopEnd: number,
    first: AacWindow, pcm: readonly [Float32Array, Float32Array], decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>) {
    this.bytes = bytes; this.index = index; this.factory = factory; this.loopStart = loopStart; this.loopEnd = loopEnd;
    this.frames = index.sizes.length * 1024 - index.primingFrames; this.duration = this.frames / 48000;
    this.first = first; this.pcm = pcm; this.decode = decode;
  }
  /** Fallback resolves on the existing live context's eligibility check, never by forcing its rate.
   * It shares concurrent attempts; failure can retry. The compressed source remains usable until handoff. */
  decoded(): Promise<AudioBuffer> {
    if (this.fallback) return this.fallback;
    const work = this.decode(this.bytes.slice().buffer);
    this.fallback = work;
    void work.catch(() => { if (this.fallback === work) this.fallback = undefined; });
    return work;
  }
  /** Prepare without opening an audio device. A missing / unsupported native codec or layout returns undefined.
   * Ownership of compressed bytes transfers to this descriptor on success; the caller keeps the old decoder
   * available for unsupported live sample rates. No backend is selected by constructing this descriptor.
   */
  static async prepare(bytes: Uint8Array, loopStartSeconds: number, loopEndSeconds: number,
    decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>, factory?: AacCodecFactory, owner?: Scope): Promise<AacTrack | undefined> {
    if (owner?.disposed) return undefined;
    const loopStart = loopStartSeconds * 48000, loopEnd = loopEndSeconds * 48000;
    let index: AacIndex;
    try { index = indexAac(bytes); } catch { return undefined; }
    const frames = index.sizes.length * 1024 - index.primingFrames;
    if (!aacWindowEligible(48000, loopStart, loopEnd, frames)) return undefined;
    const native = factory ?? await nativeAacFactory(index);
    if (!native) return undefined;
    if (owner?.disposed) return undefined;
    const scope = owner?.child('AAC.prepare') ?? new Scope('AAC.prepare'), pull = new AacPull(bytes, index, native, scope);
    try {
      const first = new AacWindows(loopStart, loopEnd, frames).next();
      const pcm = [new Float32Array(first.frames), new Float32Array(first.frames)] as const;
      for (const part of first.parts) {
        const source = await pull.read(part.start, part.frames);
        if (scope.disposed) return undefined;
        pcm[0].set(source[0], part.destination); pcm[1].set(source[1], part.destination);
      }
      return new AacTrack(bytes, index, native, loopStart, loopEnd, first, pcm, decode);
    } catch { return undefined; }
    finally { scope.dispose(); }
  }
}
