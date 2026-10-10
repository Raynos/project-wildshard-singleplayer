// Nine Dragon authoring row shapes; these declarations have no runtime dependency.
/** This authored practice room uses the metal surface. */
type Material = 'metal';
type PlaygroundId = string;
/** Nine Dragon’s authored HookCoursePad row shape. */
export interface HookCoursePad {
  readonly id: string;
  /** what the floor label says */
  readonly label: string;
  readonly x: number;
  readonly z: number;
  /** full size across (x) and along (z) */
  readonly w: number;
  readonly d: number;
  /** the floor's height over the pit */
  readonly top: number;
  /** start and finish are lit; target and finish wear target rings; a ledge's map label goes out past its edge; a range pad
   *  is off the run (not counted, no map label); the finish has no pillar (it caps the column) */
  readonly kind: 'start' | 'pad' | 'target' | 'ledge' | 'finish' | 'range';
  /** the pad whose hook comes next (the respawn faces it) */
  readonly next?: string;
}
/** Nine Dragon’s authored HookCourseRing row shape. */
export interface HookCourseRing {
  readonly pad: string;
  readonly edge: 'n' | 's' | 'e' | 'w';
  readonly along?: number;
}
/** Nine Dragon’s authored HookCourseRow row shape. */
export interface HookCourseRow {
  readonly id: PlaygroundId;
  readonly title: string;
  /** the chip's name */
  readonly chip: string;
  /** the registered piece (one for the whole room) and the update hook's id */
  readonly piece: { readonly id: string; readonly name: string; readonly file: string; readonly surface: Material };
  /** the room: the pit floor at 0, walls round it, the ceiling over the course */
  readonly room: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number; readonly height: number };
  /** a ring hangs this far over its pad's floor, this far out past its lip */
  readonly ringUp: number;
  readonly ringOut: number;
  /** a fall this far under the lowest pad puts you back on the last pad you stood on */
  readonly fallY: number;
  /** a pad's slab thickness (m): thick, so the capsule never sinks through */
  readonly slab: number;
  readonly pads: readonly HookCoursePad[];
  /** the column under the finish cap */
  readonly column: { readonly x: number; readonly z: number; readonly w: number; readonly d: number };
  readonly hooks: readonly HookCourseRing[];
  /** the run: from leaving `from` (across its far edge) to standing on `to`; `goals` the pads counted on the way */
  readonly run: { readonly from: string; readonly to: string; readonly goals: number };
  /** the chip's and the toasts' words: `{time}`, `{best}`, `{pad}`, `{reached}`, `{goals}` are filled in */
  readonly words: {
    readonly ready: string; readonly finish: string; readonly running: string; readonly between: string;
    readonly done: string; readonly best: string; readonly fell: string;
  };
  /** the room's colours (the dev kit's tones, hex colours, CSS colours for the labels and the map) */
  readonly look: {
    readonly ceiling: number; readonly ring: number; readonly mast: number; readonly paint: number;
    readonly label: string; readonly startLabel: string; readonly finishLabel: string;
    readonly map: {
      readonly floor: string; readonly grid: string; readonly wall: string; readonly column: string; readonly lit: string;
      readonly pad: string; readonly finish: string; readonly hook: string; readonly label: string;
    };
  };
}
/**
 * The grapple playground's course (E307), as data for the SDK's hook course (@wildshard/sdk/tools/hookCourse): pads and
 * the dragon hooks on them, in the room's own frame (x east, y up from the pit floor, z south; the run goes north, −z).
 * playground/GrapplePlayground.ts builds it, the unit test (test/playgrounds.test.ts) checks every zip is inside the Fei
 * Zhua's reach (2.5–38 m) and clears the lip it lands over.
 *
 *              TOP ◆ (46 m, FINISH, on the tower's column)
 *            L2 (38) ─┘   └─ L1 (30)                      the tower: three chained hooks spiral up round the column
 *                          BASE (22, a landing target) ← P2 (26) ← P1 (20) ← START (20)
 *   RANGE LINE: four pads off the start's west edge, 6 · 14 · 24 · 34 m out, each with a hook back (a feel for the reach)
 *
 * Every hook is a gold ring at a pad's near lip, 1.9 m over its floor: the zip flies past the ring and drops onto the pad
 * (Traversal.ts `landingFor`, the PAST side). Nothing stands under a lip within 12 m, so no zip lands short in the pit.
 */

export const GRAPPLE_COURSE: HookCourseRow = {
  id: 'grapple', title: 'Grapple playground', chip: 'Grapple',
  piece: { id: 'playground-grapple', name: 'Grapple playground', file: 'src/shards/nine-dragon-stack/playground/GrapplePlayground.ts', surface: 'metal' },
  // the room: the pit floor at 0, walls round it, the ceiling over the tower
  room: { x0: -62, x1: 42, z0: -68, z1: 80, height: 64 },
  ringUp: 1.9, ringOut: 0.3, fallY: 8, slab: 1,
  pads: [
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
  ],
  // the tower's column under the FINISH cap (the ledges spiral round it)
  column: { x: -6, z: -34, w: 6, d: 6 },
  hooks: [
    { pad: 'p1', edge: 's' },               // START → P1: 22 m, level, over a 12 m gap
    { pad: 'p2', edge: 's', along: -2 },    // P1 → P2: 23 m, up 6 m, 40° off to the right
    { pad: 'base', edge: 's', along: 3 },   // P2 → BASE: 28–37 m, down 4 m — the long one (walk to P2's near corner)
    { pad: 'l1', edge: 's', along: -1 },    // BASE → L1: 21 m, up 8 m round the column's east
    { pad: 'l2', edge: 'e', along: 1 },     // L1 → L2: 20 m, up 8 m round its north
    { pad: 'top', edge: 'n' },              // L2 → the top: 14 m, up 8 m onto the FINISH cap
    { pad: 'start', edge: 'w', along: 0 },  // any range pad → back onto the start
    { pad: 'r6', edge: 'e' }, { pad: 'r14', edge: 'e' }, { pad: 'r24', edge: 'e' }, { pad: 'r34', edge: 'e' },
  ],
  // the run: from leaving START to standing on the FINISH cap, past P1, P2, BASE, L1 and L2
  run: { from: 'start', to: 'top', goals: 5 },
  words: {
    ready: 'READY · ZIP TO P1', finish: 'FINISH · {time}', running: 'RUNNING · {pad}', between: 'RUNNING · {reached} / {goals}',
    done: 'GRAPPLE COURSE · {time}{best} · ↺ TO RUN AGAIN', best: ' · BEST', fell: 'FELL · BACK ON {pad}',
  },
  look: {
    ceiling: 0x23272c, ring: 0xffc24a, mast: 0x2b2f35, paint: 0xe2843a, label: '#e8f4fa', startLabel: '#2a2f35', finishLabel: '#b0591b',
    map: {
      floor: '#15191e', grid: 'rgba(117, 217, 255, 0.12)', wall: '#75d9ff', column: '#b0591b', lit: '#d7dde2', pad: '#6c737b',
      finish: '#e2843a', hook: '#ffc24a', label: '#e8f4fa',
    },
  },
};
