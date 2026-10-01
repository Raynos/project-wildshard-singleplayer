/** Explicit deltas keep simulation independent of wall-time reads and render speed. */
export class GameClock {
  private elapsed = 0;
  private wall = 0;
  private frames = 0;
  private captureFps: number | null = null;
  paused = false;
  private scale = 1;

  get now(): number { return this.elapsed; }
  get real(): number { return this.wall; }
  get frame(): number { return this.frames; }
  get mode(): 'live' | 'capture' { return this.captureFps === null ? 'live' : 'capture'; }
  get timeScale(): number { return this.scale; }
  set timeScale(value: number) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Time scale must be finite and nonnegative');
    this.scale = value;
  }

  setCapture(fps: number | null): void {
    if (fps !== null && (!Number.isFinite(fps) || fps <= 0)) throw new RangeError('Capture fps must be positive and finite');
    this.captureFps = fps;
  }

  delta(dtSeconds: number): number { return this.captureFps === null ? dtSeconds : 1 / this.captureFps; }

  /** Returns the unscaled frame delta; real time is deterministic in capture mode too. */
  tick(dtSeconds: number): number {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) throw new RangeError('Frame delta must be finite and nonnegative');
    const delta = this.delta(dtSeconds);
    this.frames++;
    this.wall += delta;
    if (!this.paused) this.elapsed += delta * this.scale;
    return delta;
  }
}
