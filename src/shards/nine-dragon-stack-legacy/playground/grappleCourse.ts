/**
 * The grapple playground's course (E307), as numbers: pads and the dragon hooks on them, in the room's own frame (x east,
 * y up from the pit floor, z south; the run goes north, −z). Pure data: GrapplePlayground.ts builds it, the unit test
 * (test/playgrounds.test.ts) checks every zip is inside the Fei Zhua's reach (2.5–38 m) and clears the lip it lands over.
 *
 *              TOP ◆ (46 m, FINISH, on the tower's column)
 *            L2 (38) ─┘   └─ L1 (30)                      the tower: three chained hooks spiral up round the column
 *                          BASE (22, a landing target) ← P2 (26) ← P1 (20) ← START (20)
 *   RANGE LINE: four pads off the start's west edge, 6 · 14 · 24 · 34 m out, each with a hook back (a feel for the reach)
 *
 * Every hook is a gold ring at a pad's near lip, 1.9 m over its floor: the zip flies past the ring and drops onto the pad
 * (Traversal.ts `landingFor`, the PAST side). Nothing stands under a lip within 12 m, so no zip lands short in the pit.
 */

export interface CoursePad {
  id: string;
  /** what the floor label says */
  label: string;
  x: number; z: number;
  /** full size across (x) and along (z) */
  w: number; d: number;
  /** the floor's height over the pit */
  top: number;
  kind: 'start' | 'pad' | 'target' | 'ledge' | 'finish' | 'range';
  /** the pad whose hook comes next (the respawn faces it) */
  next?: string;
}

export interface CourseHook {
  /** the pad the ring hangs on */
  pad: string;
  x: number; y: number; z: number;
}

/** the room: the pit floor at 0, walls round it, the ceiling over the tower */
export const ROOM = { x0: -62, x1: 42, z0: -68, z1: 80, height: 64 } as const;
/** a ring hangs this far over its pad's floor */
export const RING_UP = 1.9;
/** a fall this far under the lowest pad puts you back on the last pad you stood on */
export const FALL_Y = 8;

export const PADS: readonly CoursePad[] = [
  { id: 'start', label: 'START', x: 0, z: 62, w: 14, d: 12, top: 20, kind: 'start', next: 'p1' },
  { id: 'p1', label: 'P1', x: 0, z: 38, w: 8, d: 8, top: 20, kind: 'pad', next: 'p2' },
  { id: 'p2', label: 'P2', x: 16, z: 16, w: 8, d: 8, top: 26, kind: 'pad', next: 'base' },
  { id: 'base', label: 'BASE', x: -6, z: -16, w: 10, d: 10, top: 22, kind: 'target', next: 'l1' },
  { id: 'l1', label: 'L1', x: 7, z: -34, w: 5, d: 5, top: 30, kind: 'ledge', next: 'l2' },
  { id: 'l2', label: 'L2', x: -6, z: -50, w: 5, d: 5, top: 38, kind: 'ledge', next: 'top' },
  { id: 'top', label: 'FINISH', x: -6, z: -34, w: 10, d: 10, top: 46, kind: 'finish' },
  // the range line: 4 m pads whose east edge is 6 / 14 / 24 / 34 m off the start's west edge
  { id: 'r6', label: '6 M', x: -15, z: 66, w: 4, d: 4, top: 20, kind: 'range', next: 'start' },
  { id: 'r14', label: '14 M', x: -23, z: 62, w: 4, d: 4, top: 20, kind: 'range', next: 'start' },
  { id: 'r24', label: '24 M', x: -33, z: 58, w: 4, d: 4, top: 20, kind: 'range', next: 'start' },
  { id: 'r34', label: '34 M', x: -43, z: 54, w: 4, d: 4, top: 20, kind: 'range', next: 'start' },
];

/** the tower's column under the FINISH cap (the ledges spiral round it) */
export const COLUMN = { x: -6, z: -34, w: 6, d: 6 } as const;

/** where a pad's name sits on the full map: on the pad, but a ledge's goes out past its edge away from the column, so
 *  L1's never lands on FINISH's (13 m apart, the two overlapped on a phone's MAP tab, E353) */
export function padLabelAt(p: CoursePad): { x: number; z: number } {
  if (p.kind !== 'ledge') return { x: p.x, z: p.z };
  const dx = p.x - COLUMN.x, dz = p.z - COLUMN.z;
  return Math.abs(dx) >= Math.abs(dz) ? { x: p.x + Math.sign(dx) * (p.w / 2 + 3), z: p.z } : { x: p.x, z: p.z + Math.sign(dz) * (p.d / 2 + 3) };
}

const pad = (id: string): CoursePad => {
  const p = PADS.find((q) => q.id === id);
  if (p === undefined) throw new Error(`grapple course: no pad ${id}`);
  return p;
};
/** a ring on `id`'s lip: its edge toward (fx, fz) — 'n' | 's' | 'e' | 'w' — at `along` metres off that edge's middle */
function ring(id: string, edge: 'n' | 's' | 'e' | 'w', along = 0): CourseHook {
  const p = pad(id), y = p.top + RING_UP, out = 0.3;
  if (edge === 's') return { pad: id, x: p.x + along, y, z: p.z + p.d / 2 + out };
  if (edge === 'n') return { pad: id, x: p.x + along, y, z: p.z - p.d / 2 - out };
  if (edge === 'e') return { pad: id, x: p.x + p.w / 2 + out, y, z: p.z + along };
  return { pad: id, x: p.x - p.w / 2 - out, y, z: p.z + along };
}

export const HOOKS: readonly CourseHook[] = [
  ring('p1', 's'),           // START → P1: 22 m, level, over a 12 m gap
  ring('p2', 's', -2),       // P1 → P2: 23 m, up 6 m, 40° off to the right
  ring('base', 's', 3),      // P2 → BASE: 28–37 m, down 4 m — the long one (walk to P2's near corner)
  ring('l1', 's', -1),       // BASE → L1: 21 m, up 8 m round the column's east
  ring('l2', 'e', 1),        // L1 → L2: 20 m, up 8 m round its north
  ring('top', 'n'),          // L2 → the top: 14 m, up 8 m onto the FINISH cap
  ring('start', 'w', 0),     // any range pad → back onto the start
  ring('r6', 'e'), ring('r14', 'e'), ring('r24', 'e'), ring('r34', 'e'),
];

/** the run: from leaving START to standing on the FINISH cap */
export const RUN = { from: 'start', to: 'top' } as const;
export const coursePad = pad;
