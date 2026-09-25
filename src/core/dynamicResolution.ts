/**
 * Dynamic resolution (E142, the heavy GPU lane): hold the frame cap by stepping the render scale (the renderer's pixel
 * ratio) down when frames come late and back up when they stop — Pine Hollow's phone tier first (Settings ▸ Debug ▸
 * Dynamic resolution: Auto = Pine Hollow on the phone tier, On = any shard, Off; `?dynres=0` / `?dynres=1`).
 *
 * Why the frame's own timing and not a GPU timer: iOS Safari has no EXT_disjoint_timer_query_webgl2, and on ANGLE Metal
 * (Chrome on a Mac) the query over-reads 2× (scripts/pine-hollow-gpu.mjs). What every browser gives is the drawn frames'
 * timestamps. Under the 30 fps cap a frame that kept up lands 33.3 ms after the last one; one that missed lands a vsync
 * later (41.7 ms at 120 Hz, 50 at 60 Hz, 66.7 at 30 in Low Power Mode) — a clean "late" signal with no timer at all.
 *
 * The controller, per window of 30 drawn frames (~1 s):
 *  - late ≥ 20 % of the window → one level down (a ×0.9 … ×0.625 step of the tier's scale), unless the frame's own
 *    main-thread work already fills the budget (then it is CPU-bound and a smaller image would only blur it: `cpu`);
 *    after a step down, the next window must be quicker on average — if it is not, the drop is undone and the
 *    controller leaves the scale alone for 30 s (`nogain`: the bottleneck is not the fill);
 *  - no late frame for `holdUp` windows (3 at first) → one level up, on probation for 3 windows: a late window in them
 *    steps straight back down and doubles `holdUp` (up to 64 windows ≈ 1 min), so a scale that cannot hold is not
 *    retried every few seconds — no oscillation;
 *  - one window is skipped after every switch (the render targets are reallocated: that frame is a hitch, not a reading);
 *    a drawn frame > 250 ms apart (a menu, an app switch, a load stall) is not a sample.
 * Pure logic: `apply(pixelRatio)` is the side effect (Game: renderer.setPixelRatio + resize).
 */

/** the levels, as fractions of the tier's pixel ratio: ×0.9 per level at first, a coarser last step */
const LEVELS = [1, 0.9, 0.8, 0.7, 0.625] as const;
const WINDOW = 30;
const LATE_SLACK_MS = 6;        // a drawn frame later than budget + this missed a vsync (the cap's own jitter is ±2 ms)
const LATE_DOWN = 0.2;          // late fraction that steps down
const CPU_BOUND = 0.85;         // main-thread work ≥ this × budget: resolution is not the bottleneck
const NO_GAIN = 0.97;           // after a drop, the next window's mean interval must beat the last one's × this
const NO_GAIN_FREEZE_MS = 30_000;
const HOLD_UP_START = 3, HOLD_UP_MAX = 64;
const PROBATION = 3;             // windows after a step up in which a late window counts as the step failing
const STALL_MS = 250;

export type DynresReason = 'start' | 'late' | 'calm' | 'probe-failed' | 'nogain' | 'cpu' | 'off' | 'hold';

export interface DynresState {
  on: boolean;
  level: number;
  pixelRatio: number;
  /** the last decision (what the perf meter / scripts show) */
  reason: DynresReason;
  /** switches since start */
  switches: number;
  /** the last window: late fraction, mean drawn-frame interval, mean main-thread work (ms) */
  late: number; meanMs: number; workMs: number;
}

export class DynamicResolution {
  readonly levels: number[];
  private level = 0;
  private n = 0; private lateN = 0; private sumDt = 0; private sumWork = 0;
  private skip = 0;
  private calm = 0;
  private holdUp = HOLD_UP_START;
  /** windows of probation left after a step up (0 = none) */
  private probing = 0;
  /** after a step down: the window mean before it (the no-gain check), else null */
  private dropFrom: number | null = null;
  private frozenUntil = -Infinity;
  private on = false;
  readonly state: DynresState;

  /**
   * @param maxRatio  the tier's pixel ratio (level 0)
   * @param minRatio  the floor (a level below it is not used)
   * @param apply     set the render scale (called on every switch, and with maxRatio when switched off)
   */
  constructor(private readonly maxRatio: number, minRatio: number, private readonly apply: (pixelRatio: number) => void) {
    const floor = Math.min(maxRatio, Math.max(0.5, minRatio));
    this.levels = LEVELS.map((f) => Math.max(floor, Math.round(maxRatio * f * 100) / 100)).filter((v, i, a) => i === 0 || v < (a[i - 1] ?? Infinity));
    this.state = { on: false, level: 0, pixelRatio: maxRatio, reason: 'start', switches: 0, late: 0, meanMs: 0, workMs: 0 };
  }

  get pixelRatio(): number { return this.levels[this.level] ?? this.maxRatio; }

  /** switch the controller on / off; off restores the full scale */
  setEnabled(on: boolean): void {
    if (on === this.on) return;
    this.on = on; this.state.on = on;
    this.resetWindow(); this.calm = 0; this.probing = 0; this.dropFrom = null;
    if (!on && this.level !== 0) this.go(0, 'off');
  }

  /**
   * One drawn frame. `intervalMs`: since the last drawn frame (rAF timestamps); `workMs`: this frame's main-thread
   * time (input → render submitted); `budgetMs`: the cap's frame time (33.3 at 30 fps); `now`: performance.now().
   */
  frame(intervalMs: number, workMs: number, budgetMs: number, now: number): void {
    if (!this.on || budgetMs <= 0 || !(intervalMs > 0) || intervalMs > STALL_MS) return;
    this.n++; this.sumDt += intervalMs; this.sumWork += workMs;
    if (intervalMs > budgetMs + LATE_SLACK_MS) this.lateN++;
    if (this.n < WINDOW) return;
    const late = this.lateN / this.n, mean = this.sumDt / this.n, work = this.sumWork / this.n;
    this.resetWindow();
    if (this.skip > 0) { this.skip--; return; }
    Object.assign(this.state, { late, meanMs: mean, workMs: work });
    // the last drop's verdict: no quicker → undo it and leave the scale alone for a while
    if (this.dropFrom !== null) {
      const from = this.dropFrom;
      this.dropFrom = null;
      if (late >= LATE_DOWN && mean >= from * NO_GAIN) { this.frozenUntil = now + NO_GAIN_FREEZE_MS; this.go(this.level - 1, 'nogain'); return; }
    }
    if (late >= LATE_DOWN) {
      this.calm = 0;
      if (this.probing > 0) { this.probing = 0; this.holdUp = Math.min(HOLD_UP_MAX, this.holdUp * 2); this.go(this.level + 1, 'probe-failed'); return; }
      if (now < this.frozenUntil) { this.state.reason = 'hold'; return; }
      if (work >= budgetMs * CPU_BOUND) { this.state.reason = 'cpu'; return; }
      if (this.level + 1 >= this.levels.length) return;
      this.dropFrom = mean;
      this.go(this.level + 1, 'late');
      return;
    }
    if (this.probing > 0) this.probing--; // a probation window that held
    if (late > 0) { this.calm = 0; return; }
    if (this.level === 0 || ++this.calm < this.holdUp) return;
    this.calm = 0;
    this.probing = PROBATION;
    this.go(this.level - 1, 'calm');
  }

  private go(level: number, reason: DynresReason): void {
    const l = Math.max(0, Math.min(this.levels.length - 1, level));
    this.state.reason = reason;
    if (l === this.level) return;
    this.level = l;
    this.skip = 1;
    this.state.level = l; this.state.pixelRatio = this.pixelRatio; this.state.switches++;
    this.apply(this.pixelRatio);
  }

  private resetWindow(): void { this.n = 0; this.lateN = 0; this.sumDt = 0; this.sumWork = 0; }
}
