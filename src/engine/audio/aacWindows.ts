/** One native source window. Coordinates are integer source / timeline samples at 48 kHz. */
export interface AacWindow {
  readonly timeline: number;
  readonly duration: number;
  readonly frames: number;
  readonly offset: number;
  readonly parts: readonly { readonly start: number; readonly frames: number; readonly destination: number }[];
  readonly loop?: { readonly start: number; readonly end: number };
}
const RATE = 48000, WINDOW = 24000, SEAM = 6000, GUARD = 32;
/** Integer-loop eligibility is deliberately conservative: fractional loop cuts / resampling retain the old source. */
export function aacWindowEligible(rate: number, loopStart: number, loopEnd: number, sourceFrames: number): boolean {
  return rate === RATE && Number.isSafeInteger(loopStart) && Number.isSafeInteger(loopEnd)
    && Number.isSafeInteger(sourceFrames) && loopStart >= 0 && loopEnd - loopStart >= SEAM * 2
    && loopEnd + GUARD <= sourceFrames;
}
/** Deterministic sample-exact native-source plans with no PCM allocation.
 * A bridge stores the loop head before its tail; the native source wraps once from tail to head.
 * The next ordinary window resumes after that head. Guards preserve native interpolation without
 * changing loop cuts, gain curves or sample rate. Schedule start and stop at absolute timeline times.
 */
export class AacWindows {
  private timeline = 0;
  private source: number;
  private readonly loopStart: number;
  private readonly loopEnd: number;
  private readonly sourceFrames: number;
  constructor(loopStart: number, loopEnd: number, sourceFrames: number, initial = 0) {
    if (!aacWindowEligible(RATE, loopStart, loopEnd, sourceFrames) || !Number.isSafeInteger(initial) || initial < 0 || initial >= loopEnd) {
      throw new Error('AAC windows require supported integer loop bounds');
    }
    this.source = initial; this.loopStart = loopStart; this.loopEnd = loopEnd; this.sourceFrames = sourceFrames;
  }
  next(): AacWindow {
    const timeline = this.timeline, source = this.source;
    let result: AacWindow;
    if (source < this.loopEnd - SEAM) {
      const duration = Math.min(WINDOW, this.loopEnd - SEAM - source);
      const first = Math.max(0, source - GUARD), last = Math.min(this.sourceFrames, source + duration + GUARD);
      result = { timeline, duration, frames: last - first, offset: source - first,
        parts: [{ start: first, frames: last - first, destination: 0 }] };
      this.source += duration;
    } else {
      const head = Math.max(0, this.loopStart - GUARD), headFrames = this.loopStart + SEAM + GUARD - head;
      const tail = source - GUARD, tailFrames = this.loopEnd + GUARD - tail;
      result = { timeline, duration: this.loopEnd - source + SEAM, frames: headFrames + tailFrames,
        offset: headFrames + source - tail, loop: { start: this.loopStart - head, end: headFrames + this.loopEnd - tail },
        parts: [{ start: head, frames: headFrames, destination: 0 }, { start: tail, frames: tailFrames, destination: headFrames }] };
      this.source = this.loopStart + SEAM;
    }
    this.timeline += result.duration;
    return result;
  }
}
