// NALATI-MERGE H4 (the user's ask N18): the Nalati bow's draw state machine (src/player/bowDraw.ts) — hold to draw,
// release at full = the loose, release early = a let-down (no arrow), no quick-fire, the long hold tires, a blocked draw
// is let down and needs a fresh press.
import { describe, expect, it } from 'vitest';
import { BowDraw, DRAW_TIME, HOLD_STEADY, HOLD_TIRE, LETDOWN_TIME, RENOCK_TIME, RN_EARLY, type DrawEvent } from '../src/player/bowDraw';

const DT = 1 / 60;
/** run `s` seconds of frames with the input fixed; every event, in order */
function run(d: BowDraw, s: number, held: boolean, blocked = false, rate = 1): DrawEvent[] {
  const out: DrawEvent[] = [];
  for (let i = 0; i < Math.round(s / DT); i++) { const e = d.step(DT, held, blocked, rate); if (e !== null) out.push(e); }
  return out;
}

describe('bowDraw — hold to draw, release to loose', () => {
  it('holding draws to full over DRAW_TIME: start, then full', () => {
    const d = new BowDraw();
    expect(run(d, DRAW_TIME * 0.5, true)).toEqual(['start']);
    expect(d.full).toBe(false);
    expect(d.p).toBeGreaterThan(0.5); // ease-out: the string comes fast, heavy toward the anchor
    expect(run(d, DRAW_TIME * 0.6, true)).toEqual(['full']);
    expect(d.full).toBe(true);
    expect(d.p).toBe(1);
  });
  it('releasing at full looses, then the re-nock', () => {
    const d = new BowDraw();
    run(d, DRAW_TIME + 0.1, true);
    expect(run(d, DT, false)).toEqual(['loose']);
    expect(d.p).toBe(0);
    expect(d.renockT).toBeGreaterThan(RENOCK_TIME - 2 * DT);
  });
  it('releasing before full is a let-down: no loose, the string eases forward over LETDOWN_TIME', () => {
    const d = new BowDraw();
    run(d, DRAW_TIME * 0.9, true);
    const p = d.p;
    expect(run(d, DT, false)).toEqual(['letdown']);
    expect(d.p).toBeGreaterThan(0);
    expect(d.p).toBeLessThan(p);
    expect(run(d, LETDOWN_TIME, false)).toEqual([]);
    expect(d.p).toBe(0);
    expect(d.renockT).toBe(0); // nothing was spent: no re-nock
  });
  it('a quick tap never shoots (no quick-fire)', () => {
    const d = new BowDraw();
    const ev = [...run(d, 0.1, true), ...run(d, 0.5, false)];
    expect(ev).toEqual(['start', 'letdown']);
  });
  it('the saddle draws slower (rate 0.83 → 0.9 s)', () => {
    const d = new BowDraw();
    run(d, DRAW_TIME + 0.02, true, false, DRAW_TIME / 0.9);
    expect(d.full).toBe(false);
    run(d, 0.9 - DRAW_TIME, true, false, DRAW_TIME / 0.9);
    expect(d.full).toBe(true);
  });
  it('a press during the re-nock starts the next draw once RN_EARLY of it is left', () => {
    const d = new BowDraw();
    run(d, DRAW_TIME + 0.05, true);
    run(d, DT, false); // loose
    const wait = RENOCK_TIME * (1 - RN_EARLY);
    expect(run(d, wait - 3 * DT, true)).toEqual([]);
    expect(d.drawT).toBe(0);
    expect(run(d, 4 * DT, true)).toEqual(['start']);
  });
});

describe('bowDraw — holding and blocking', () => {
  it('steady until HOLD_STEADY, trembles, then the arms give out (a let-down; lift before the next draw)', () => {
    const d = new BowDraw();
    run(d, DRAW_TIME + 0.02, true);
    run(d, HOLD_STEADY - 0.1, true);
    expect(d.sway).toBe(0);
    run(d, (HOLD_TIRE - HOLD_STEADY) / 2, true);
    expect(d.sway).toBeGreaterThan(0.3);
    expect(run(d, HOLD_TIRE, true)).toContain('tired');
    expect(d.full).toBe(false);
    // still held: no new draw until the finger lifts
    run(d, 3, true);
    expect(d.drawT).toBe(0);
    expect(run(d, DT, false)).toEqual([]); // the lift after tiring is not a loose
    expect(run(d, 0.1, true)).toEqual(['start']);
  });
  it('a draw blocked mid-way (a sprint) is let down and needs a fresh press', () => {
    const d = new BowDraw();
    run(d, DRAW_TIME + 0.05, true);
    expect(run(d, DT, true, true)).toEqual(['letdown']);
    run(d, 1, true, false); // unblocked but the finger never lifted
    expect(d.drawT).toBe(0);
    expect(run(d, DT, false)).toEqual([]);
    expect(run(d, 0.1, true)).toEqual(['start']);
  });
  it('a release at full while blocked (the pointer lock lost) lets down instead of loosing', () => {
    const d = new BowDraw();
    run(d, DRAW_TIME + 0.05, true);
    expect(d.step(DT, false, true)).toBe('letdown');
  });
  it('nothing draws while blocked (an empty quiver)', () => {
    const d = new BowDraw();
    expect(run(d, 2, true, true)).toEqual([]);
    expect(d.p).toBe(0);
  });
});
