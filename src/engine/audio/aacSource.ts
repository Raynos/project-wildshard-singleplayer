import type { AacTrack } from './aacTrack';
import { AacWindows, type AacWindow } from './aacWindows';
import { AacPull } from './aacPull';
import type { Scope } from '../app/scope';
import { withOwner } from '../app/ownership';
import { ownAudioSource } from './ownership';

interface PlayingWindow { readonly source: AudioBufferSourceNode; readonly end: number }
/** A live bounded native source feeding an existing Deck's unchanged gain / mixer. */
export interface AacSourcePorts {
  readonly context: BaseAudioContext;
  readonly output: AudioNode;
  readonly scope: Scope;
  readonly failed: (error: unknown) => void;
  readonly ended: () => void;
}
const RATE = 48000, LOOKAHEAD = 1.25, MAX_WINDOWS = 6;
/** Schedules short native sources ahead on the existing context clock; never opens an audio device.
 * The first prepared window starts synchronously. Further work is serialized and scoped; each ended
 * window drops its AudioBuffer and listeners. Suspension cannot grow the source set. A missed deadline
 * fails visibly to the caller instead of skipping samples or changing the authored timing.
 */
export class AacSource {
  private readonly scope: Scope;
  private readonly ports: AacSourcePorts;
  private readonly t0: number;
  private readonly windows = new Map<Scope, PlayingWindow>();
  private readonly plans: AacWindows;
  private readonly pull: AacPull;
  private next: AacWindow;
  private pending: Promise<void> | undefined;
  private stopAt = Infinity;
  private retired = false;
  private peak = 0;
  constructor(track: AacTrack, ports: AacSourcePorts, t0: number) {
    if (ports.scope.disposed || ports.context.sampleRate !== RATE || !Number.isFinite(t0) || t0 < ports.context.currentTime) {
      throw new Error('AAC source requires a live owner, 48 kHz context and future start');
    }
    this.ports = ports; this.t0 = t0; this.scope = ports.scope.child('AAC.source');
    this.plans = new AacWindows(track.loopStart, track.loopEnd, track.frames);
    this.pull = new AacPull(track.bytes, track.index, track.factory, this.scope);
    this.scope.onDispose(() => { this.windows.clear(); });
    const first = this.plans.next(); this.next = this.plans.next();
    try {
      this.schedule(first, track.pcm);
      this.scope.interval(50, () => { void this.pump(); });
      void this.pump();
    } catch (error) { this.scope.dispose(); throw error; }
  }
  private active(): boolean { return !this.scope.disposed; }
  get residentWindows(): number { return this.windows.size; }
  get peakWindows(): number { return this.peak; }
  dispose(): void { this.scope.dispose(); }
  /** The Deck supplies the same absolute fade-end plus source tail as its decoded sources. */
  stop(at: number): void {
    if (this.scope.disposed) return;
    if (!Number.isFinite(at)) throw new Error('Invalid AAC source stop');
    this.stopAt = at;
    for (const { source, end } of this.windows.values()) source.stop(Math.min(at, end));
    if (this.windows.size === 0) this.end();
  }
  private end(): void {
    if (this.retired) return;
    this.retired = true; this.dispose(); this.ports.ended();
  }
  private schedule(plan: AacWindow, channels: readonly [Float32Array, Float32Array]): void {
    const ctx = this.ports.context, start = this.t0 + plan.timeline / RATE;
    if (this.scope.disposed || start >= this.stopAt) return;
    if (this.windows.size >= MAX_WINDOWS) throw new Error('AAC source window admission exceeded');
    const owner = this.scope.child('AAC.window');
    try {
      const buffer = ctx.createBuffer(2, plan.frames, RATE);
      buffer.getChannelData(0).set(channels[0]); buffer.getChannelData(1).set(channels[1]);
      const source = ctx.createBufferSource();
      owner.onDispose(() => { source.buffer = null; });
      withOwner(owner, () => ownAudioSource(source));
      source.buffer = buffer; source.connect(this.ports.output);
      if (plan.loop) { source.loop = true; source.loopStart = plan.loop.start / RATE; source.loopEnd = plan.loop.end / RATE; }
      const end = Math.min(this.stopAt, this.t0 + (plan.timeline + plan.duration) / RATE);
      this.windows.set(owner, { source, end }); this.peak = Math.max(this.peak, this.windows.size);
      owner.listen(source, 'ended', () => {
        this.windows.delete(owner); owner.dispose();
        if (this.stopAt !== Infinity && this.windows.size === 0 && this.next.timeline / RATE + this.t0 >= this.stopAt) this.end();
      }, { once: true });
      source.start(start, plan.offset / RATE); source.stop(end);
    } catch (error) { this.windows.delete(owner); owner.dispose(); throw error; }
  }
  /** Explicit pump is also usable by offline conformance via the context's suspend/resume clock. */
  pump(): Promise<void> {
    if (this.pending) return this.pending;
    if (!this.active()) return Promise.resolve();
    const work = this.fill().finally(() => { if (this.pending === work) this.pending = undefined; });
    this.pending = work;
    return work;
  }
  private async fill(): Promise<void> {
    try {
      while (this.active() && this.windows.size < MAX_WINDOWS) {
        const plan = this.next, start = this.t0 + plan.timeline / RATE;
        if (start >= this.stopAt || start >= this.ports.context.currentTime + LOOKAHEAD) return;
        if (start < this.ports.context.currentTime) throw new Error('AAC source missed its exact scheduling deadline');
        const channels = [new Float32Array(plan.frames), new Float32Array(plan.frames)] as const;
        for (const part of plan.parts) {
          const pcm = await this.pull.read(part.start, part.frames);
          if (!this.active()) return;
          channels[0].set(pcm[0], part.destination); channels[1].set(pcm[1], part.destination);
        }
        if (start < this.ports.context.currentTime) throw new Error('AAC source missed its exact scheduling deadline');
        this.next = this.plans.next(); this.schedule(plan, channels);
      }
    } catch (error) {
      if (this.active()) { this.dispose(); this.ports.failed(error); }
    }
  }
}
