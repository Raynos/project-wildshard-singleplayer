import { describe, expect, it } from 'vitest';
import { segmentBlocked, segmentHitsBox, segmentEntry, insideBox, type BoxCollider } from '../src/player/MeleeSweep';

// a 2 m × 0.2 m wall along x at z = 1, 0..3 m high
const wall: BoxCollider = { x: 0, z: 1, hw: 1, hd: 0.1, rot: 0, yTop: 3, yBottom: 0 };

describe('MeleeSweep (the sword hit test occlusion, C1 / B5)', () => {
  it('a swing through a wall is blocked, one beside it is not', () => {
    expect(segmentBlocked(0, 1.6, 0, 0, 1, 2, [wall])).toBe(true);
    expect(segmentBlocked(1.5, 1.6, 0, 1.5, 1, 2, [wall])).toBe(false);
  });
  it('over the top of a low box is clear', () => {
    const low: BoxCollider = { ...wall, yTop: 0.5 };
    expect(segmentBlocked(0, 1.6, 0, 0, 1.2, 2, [low])).toBe(false);
  });
  it('a box that holds either end does not block (inside the hold, a target inside the hull)', () => {
    const hull: BoxCollider = { x: 0, z: 0, hw: 2, hd: 4, rot: 0.4, yTop: 1, yBottom: -2 };
    expect(insideBox(hull, 0, 0, 0)).toBe(true);
    expect(segmentBlocked(0, 0.5, 0, 0, 0.5, 6, [hull])).toBe(false);   // eye inside
    expect(segmentBlocked(0, 0.5, 8, 0, 0.5, 1, [hull])).toBe(false);   // target inside
  });
  it('honours the box rotation (Player.ts convention: the local frame is R(-rot))', () => {
    // the wall turned 90°: it now runs along z through x = 0 … rotated about its centre (0, 1)
    const turned: BoxCollider = { ...wall, rot: Math.PI / 2 };
    expect(segmentHitsBox(turned, -1, 1, 1.5, 1, 1, 1.5)).toBe(true);    // crosses x = 0 at z = 1.5 (inside |dz| ≤ 1)
    expect(segmentHitsBox(turned, -1, 1, 2.5, 1, 1, 2.5)).toBe(false);   // z = 2.5 is past its end
  });
  it('segmentEntry finds where the blade tip meets a wall, not a box the eye stands in', () => {
    expect(segmentEntry(0, 1.6, 0, 0, 1.6, 2, [wall])).toBeCloseTo(0.45, 5);   // the wall's near face at z = 0.9
    expect(segmentEntry(1.5, 1.6, 0, 1.5, 1.6, 2, [wall])).toBe(-1);
    const room: BoxCollider = { x: 0, z: 0, hw: 3, hd: 3, rot: 0, yTop: 3, yBottom: 0 };
    expect(segmentEntry(0, 1.6, 0, 0, 1.6, 2, [room])).toBe(-1);
  });
});
