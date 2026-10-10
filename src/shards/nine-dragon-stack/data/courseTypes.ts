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
