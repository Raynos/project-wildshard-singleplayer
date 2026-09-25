import { describe, expect, it } from 'vitest';
import { DynamicResolution } from '../src/core/dynamicResolution';

const BUDGET = 1000 / 30;

/** drive `windows` windows of 30 frames: `interval(i)` ms apart, `work` ms of main-thread work each */
function run(d: DynamicResolution, windows: number, interval: (i: number) => number, work = 8, t0 = 0): number {
  let t = t0;
  for (let i = 0; i < windows * 30; i++) { const dt = interval(i); t += dt; d.frame(dt, work, BUDGET, t); }
  return t;
}

describe('dynamic resolution (E142)', () => {
  it('builds its levels from the tier scale, never under the floor', () => {
    expect(new DynamicResolution(2, 1.25, () => undefined).levels).toEqual([2, 1.8, 1.6, 1.4, 1.25]);
    expect(new DynamicResolution(1.6, 1.25, () => undefined).levels).toEqual([1.6, 1.44, 1.28, 1.25]);
    expect(new DynamicResolution(1, 1.25, () => undefined).levels).toEqual([1]);
  });

  it('does nothing while off, or when every frame keeps the cap', () => {
    const applied: number[] = [];
    const d = new DynamicResolution(2, 1.25, (p) => { applied.push(p); });
    run(d, 5, () => 50);
    expect(applied).toEqual([]);
    d.setEnabled(true);
    run(d, 10, () => 33.3);
    expect(applied).toEqual([]);
    expect(d.pixelRatio).toBe(2);
  });

  it('steps down while late, one level per window after the reallocation window', () => {
    const applied: number[] = [];
    const d = new DynamicResolution(2, 1.25, (p) => { applied.push(p); });
    d.setEnabled(true);
    // late every other frame, and each drop makes the mean interval quicker (so no "nogain" undo)
    let mean = 50;
    const t = run(d, 1, () => mean);
    expect(applied).toEqual([1.8]);
    mean = 45; run(d, 2, () => mean, 8, t); // skipped window, then a quicker but still late window → down again
    expect(applied).toEqual([1.8, 1.6]);
  });

  it('undoes a drop that did not make frames quicker, then holds', () => {
    const applied: number[] = [];
    const d = new DynamicResolution(2, 1.25, (p) => { applied.push(p); });
    d.setEnabled(true);
    const t = run(d, 3, () => 66.7); // late, drop; skip; not quicker → undo
    expect(applied).toEqual([1.8, 2]);
    expect(d.state.reason).toBe('nogain');
    run(d, 4, () => 66.7, 8, t);    // frozen: no more switching
    expect(applied).toEqual([1.8, 2]);
  });

  it('does not drop when the main thread fills the budget (CPU-bound)', () => {
    const applied: number[] = [];
    const d = new DynamicResolution(2, 1.25, (p) => { applied.push(p); });
    d.setEnabled(true);
    run(d, 3, () => 50, 31);
    expect(applied).toEqual([]);
    expect(d.state.reason).toBe('cpu');
  });

  it('climbs back after calm windows, and a failed probe doubles the wait (no oscillation)', () => {
    const applied: number[] = [];
    const d = new DynamicResolution(2, 1.25, (p) => { applied.push(p); });
    d.setEnabled(true);
    let t = run(d, 1, () => 50);                 // → 1.8
    t = run(d, 1, () => 33.3, 8, t);             // the skipped window
    t = run(d, 1, () => 33.3, 8, t);             // drop verdict: quicker, fine; calm 1
    t = run(d, 2, () => 33.3, 8, t);             // calm 3 → probe up to 2
    expect(applied).toEqual([1.8, 2]);
    t = run(d, 1, () => 33.3, 8, t);             // skipped
    t = run(d, 1, () => 50, 8, t);               // the probe window is late → straight back down, holdUp 6
    expect(applied).toEqual([1.8, 2, 1.8]);
    t = run(d, 1, () => 33.3, 8, t);             // skipped
    t = run(d, 5, () => 33.3, 8, t);             // 5 calm windows: not yet (holdUp 6)
    expect(applied).toEqual([1.8, 2, 1.8]);
    run(d, 1, () => 33.3, 8, t);                 // the 6th → up
    expect(applied).toEqual([1.8, 2, 1.8, 2]);
  });

  it('ignores stalls and restores the full scale when switched off', () => {
    const applied: number[] = [];
    const d = new DynamicResolution(2, 1.25, (p) => { applied.push(p); });
    d.setEnabled(true);
    run(d, 3, () => 400);
    expect(applied).toEqual([]);
    run(d, 1, () => 50);
    expect(d.pixelRatio).toBe(1.8);
    d.setEnabled(false);
    expect(applied).toEqual([1.8, 2]);
    expect(d.state.reason).toBe('off');
  });
});
