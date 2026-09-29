/**
 * The Fei Zhua's course (E307): the hooks the claw may bite and the rules only one place has around them.
 *
 * The fragment's own course is Traversal.ts's `fragmentCourse` (its brass dragon hooks, the Well rail a hook may be seen
 * past, the lift over the rim's parapet and the safety cap it opens). A playground (src/playgrounds/GrapplePlayground.ts)
 * hands in its own course for as long as it is open: the same verbs (LOCK → GRAPPLE, JUMP → ZIP), markers, rope and FX,
 * with its own hooks and none of the Well's rules.
 *
 *   setGrappleCourse(course)   // a playground opens: the claw bites only its hooks
 *   setGrappleCourse(null)     // it closes: the fragment's course again
 *
 * A module of its own so a playground can hand its course over without loading the grapple itself.
 */
import type { Vector3 } from 'three';
import type { ShardTraversalContext } from '../../ChunkDef';

export interface GrappleCourse {
  readonly name: string;
  /** the rings' centres, world space: what the claw bites */
  readonly hooks: readonly Vector3[];
  /** a hook the claw sees past something only this course knows (the Well's rail); a clear line of sight always counts */
  seePast?: (ctx: ShardTraversalContext, eye: Vector3, hook: Vector3) => boolean;
  /** a zip from the feet at `from` to `landing` must lift before it pulls (the Well's crossing) */
  lifts?: (from: Vector3, landing: Vector3) => boolean;
  /** the height a lifting zip rises to, from the feet now toward the approach point */
  liftTo?: (from: Vector3, approach: Vector3) => number;
  /** a lifting zip starts (true) and every grapple ends (false): the Well's safety cap */
  guard?: (open: boolean) => void;
}

let playground: GrappleCourse | null = null;
const listeners = new Set<() => void>();

/** a playground's course while it is open; null gives the claw back to the fragment */
export function setGrappleCourse(course: GrappleCourse | null): void {
  if (course === playground) return;
  playground = course;
  for (const fn of listeners) fn();
}

/** the open playground's course (null: the fragment's) */
export function playgroundCourse(): GrappleCourse | null { return playground; }

/** told whenever the course changes (Traversal.ts re-sizes its reach cache and lets go of any grapple in flight) */
export function onGrappleCourse(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
