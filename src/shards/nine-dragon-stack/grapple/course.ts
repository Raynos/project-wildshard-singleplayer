/**
 * The Fei Zhua's course (E307): the hooks the claw may bite and the rules only one place has around them.
 *
 * The fragment's own course is sim.ts's `wellCourse` (its brass dragon hooks, the Well rail a hook may be seen
 * past, the lift over the rim's parapet and the safety cap it opens). A playground (src/shards/nine-dragon-stack/playground/GrapplePlayground.ts)
 * hands in its own course for as long as it is open: the same verbs (LOCK → GRAPPLE, JUMP → ZIP), markers, rope and FX,
 * with its own hooks and none of the Well's rules.
 *
 *   setGrappleCourse(course)   // a playground opens: the claw bites only its hooks
 *   setGrappleCourse(null)     // it closes: the fragment's course again
 *
 * A module of its own so a playground can hand its course over without loading the grapple itself.
 */
import type { Vector3 } from 'three';
import type { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import type { Physics } from '@wildshard/engine/physics/Physics';

export interface GrappleCourse {
  readonly name: string;
  /** the rings' centres, world space: what the claw bites */
  readonly hooks: readonly Vector3[];
  /** a hook the claw sees past something only this course knows (the Well's rail); a clear line of sight always counts */
  seePast?: (ports: GrapplePorts, eye: Vector3, hook: Vector3) => boolean;
  /** a zip from the feet at `from` to `landing` must lift before it pulls (the Well's crossing) */
  lifts?: (from: Vector3, landing: Vector3) => boolean;
  /** the height a lifting zip rises to, from the feet now toward the approach point */
  liftTo?: (from: Vector3, approach: Vector3) => number;
  /** a lifting zip starts (true) and every grapple ends (false): the Well's safety cap */
  guard?: (open: boolean) => void;
}

/** The body the claw pulls: the player's feet, velocity, ground flag and capsule (the client Player, or the host's). */
export interface GrappleBody {
  readonly position: Vector3;
  readonly velocity: Vector3;
  onGround: boolean;
  readonly motor: Pick<CharacterMotor, 'collider' | 'move'>;
}
/** What the claw asks of the world: the physics queries and the body it pulls. */
export interface GrapplePorts { readonly physics: Physics; readonly body: GrappleBody }
