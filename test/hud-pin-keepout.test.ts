import { describe, expect, it } from 'vitest';
import { placePin, type PinRect } from '../src/engine/ui/pinKeepOut';

// iPhone 16 Pro portrait in CSS px, and the playtest-1 frame's controls: the left-edge HOVER disc, the right-hand discs
// and the bottom bar (art/playtest/round-1-2026-10-07/21-ss-sky-reach-marker-over-hover.jpg)
const VIEW = { width: 402, height: 874 };
const HOVER: PinRect = { left: 0, top: 372, right: 38, bottom: 432 };
const DODGE: PinRect = { left: 263, top: 674, right: 323, bottom: 734 };
const JUMP: PinRect = { left: 332, top: 674, right: 392, bottom: 734 };
const BAR: PinRect = { left: 0, top: 744, right: 402, bottom: 874 };
const CONTROLS = [HOVER, DODGE, JUMP, BAR];
const covers = (p: { x: number; y: number }, w: number, h: number, r: PinRect): boolean =>
  p.x - w / 2 < r.right && p.x + w / 2 > r.left && p.y - h / 2 < r.bottom && p.y + h / 2 > r.top;

describe('world pins step round the controls (playtest 1, E332)', () => {
  it('keeps a pin that covers nothing exactly where its world point projects', () => {
    expect(placePin(200, 300, 90, 22, CONTROLS, VIEW)).toEqual({ x: 200, y: 300 });
  });

  it('moves the Sky Reach KEEPER pin off HOVER to the nearest clear side, on screen', () => {
    const w = 82, h = 22, at = placePin(40, 401, w, h, CONTROLS, VIEW);
    expect(at).not.toBeNull();
    if (at === null) return;
    for (const r of CONTROLS) expect(covers(at, w, h, r)).toBe(false);
    expect(at.x - w / 2).toBeGreaterThanOrEqual(0);
    // the nearest clear spot: just right of the disc, level with the keeper
    expect(at).toEqual({ x: HOVER.right + 6 + w / 2, y: 401 });
  });

  it('steps round a row of discs as one stack and never onto the bar', () => {
    const w = 90, h = 22, at = placePin(320, 700, w, h, CONTROLS, VIEW);
    expect(at).not.toBeNull();
    if (at === null) return;
    for (const r of CONTROLS) expect(covers(at, w, h, r)).toBe(false);
    expect(at.y).toBe(DODGE.top - 6 - h / 2);
  });

  it('hides a pin with no clear spot rather than draw it over a control', () => {
    const wall: PinRect = { left: 0, top: 0, right: 402, bottom: 874 };
    expect(placePin(200, 400, 90, 22, [wall], VIEW)).toBeNull();
  });
});
