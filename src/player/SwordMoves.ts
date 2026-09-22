import * as THREE from 'three';

/**
 * SwordMoves — the keyframes of every sword swing (Sword.ts evaluates them): the three-hit light combo and the heavy.
 * Camera space at scale 1 (landscape): +X right, +Y up, -Z forward; a key is where the hands are, which way the blade
 * points and the roll about it (0 = the flat toward the eye). Each move has a wind-up key (cocked), a mid-slash key
 * and a follow-through key; the swing starts from wherever the sword IS (the rest pose, or the previous swing's
 * follow-through when the combo chains) and recovers to REST.
 *
 *   1 · slash      right → left, horizontal — the wooden-sword mockup (art/driftwood-isle/round-2-first-person/driftwood-fp-sword-wooden.png)
 *   2 · backhand   left → right, rising a little — cocked from where the slash left the blade
 *   3 · finisher   raised high on the right, an overhead diagonal down to the lower left (the iron mockup's arc)
 *   H · heavy      charged overhead (CHARGE key held with the blade raised), released into a wide slow overhead chop
 *
 * Times are seconds from the swing's start: `windup` (the active window opens), `slashEnd` (it closes; a queued combo
 * swing chains here), `total` (back at rest). `fan` is the melee hit fan (yaw × pitch offsets from the camera forward).
 */

export interface Key { t: number; pos: THREE.Vector3; q: THREE.Quaternion }
export interface Trail {
  /** blade fraction the ribbon's inner edge rides at (0 = the guard, 1 = the tip): lower = a wider ribbon */
  from: number;
  /** ribbon colour, peak alpha at the tip, alpha at the inner edge (0 = feathered to nothing), s a sample lives */
  color: THREE.Color; alpha: number; inner: number; life: number;
}
export interface Move {
  name: 'slash' | 'backhand' | 'finisher' | 'heavy';
  keys: [Key, Key, Key];
  windup: number; slashEnd: number; total: number;
  /** × the blade's base damage (wood 12) */
  damage: number;
  /** stagger strength handed to Animal.stagger (0 light … 1 heavy) */
  stagger: number;
  /** the blow's sideways component in the strike direction: +1 = the sweep travels right → left across the forward, -1 the other way, 0 straight down */
  sweep: number;
  hitStop: number;
  fan: { yaws: number[]; pitches: number[] };
  trail: Trail;
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _q2 = new THREE.Quaternion();
/** quaternion that takes +Y to `dir` then rolls about it */
export function poseQuat(out: THREE.Quaternion, dir: THREE.Vector3, roll: number): THREE.Quaternion {
  out.setFromUnitVectors(Y_AXIS, dir);
  return out.multiply(_q2.setFromAxisAngle(Y_AXIS, roll));
}
export const key = (t: number, px: number, py: number, pz: number, dx: number, dy: number, dz: number, roll: number): Key =>
  ({ t, pos: new THREE.Vector3(px, py, pz), q: poseQuat(new THREE.Quaternion(), new THREE.Vector3(dx, dy, dz).normalize(), roll) });

/** rest = the spawn mockup: hands lower-right, blade up-left toward the frame centre */
export const REST = key(0, 0.27, -0.33, -0.52, -0.34, 0.76, -0.55, 0.35);
/** RMB / touch AIM held: the blade raised high over the right shoulder, tip up and a little back — the heavy's charge */
export const CHARGE = key(0, 0.27, -0.09, -0.50, 0.24, 0.92, 0.30, 0.1);
export const SPRINT = key(0, 0.34, -0.46, -0.58, -0.2, 0.55, -0.81, 0.6);

const WIDE = { yaws: [0, -0.18, 0.18, -0.36, 0.36, -0.55, 0.55], pitches: [-0.3, 0.0, -0.6, -0.9] };   // a horizontal sweep; a boar at your feet is ~40° below the eye
const OVERHEAD = { yaws: [0, -0.12, 0.12, -0.26, 0.26], pitches: [0.05, -0.25, -0.5, -0.75, -0.95] };  // a chop: narrow, deep

const white = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

export const SLASH: Move = {
  name: 'slash',
  keys: [
    key(0.07, 0.42, -0.25, -0.50, 0.62, 0.62, -0.48, 0.55),     // cocked: blade up-right, tip toward the frame's right edge
    key(0.13, 0.22, -0.33, -0.48, -0.70, 0.48, -0.53, 0.3),     // mid-slash: sweeping across, tip upper-left of centre (the mockup frame)
    key(0.235, -0.02, -0.35, -0.46, -0.88, 0.22, -0.42, 0.15),  // follow-through: blade out to the left, still rising a little
  ],
  windup: 0.07, slashEnd: 0.235, total: 0.35,
  damage: 1, stagger: 0, sweep: 1, hitStop: 0.045, fan: WIDE,
  trail: { from: 0.62, color: white(1, 1, 1), alpha: 0.6, inner: 0, life: 0.13 },
};

export const BACKHAND: Move = {
  name: 'backhand',
  keys: [
    key(0.06, -0.12, -0.28, -0.48, -0.82, 0.46, -0.34, -0.35),   // cocked further left, edge turned to lead the other way
    key(0.125, 0.10, -0.30, -0.50, 0.02, 0.62, -0.78, -0.2),     // mid: tip straight ahead and up, crossing the centre
    key(0.22, 0.40, -0.26, -0.50, 0.86, 0.36, -0.36, -0.1),      // follow-through: blade out to the right, tip past the frame edge
  ],
  windup: 0.06, slashEnd: 0.22, total: 0.34,
  damage: 1, stagger: 0, sweep: -1, hitStop: 0.045, fan: WIDE,
  trail: { from: 0.58, color: white(0.9, 0.97, 1), alpha: 0.6, inner: 0.05, life: 0.13 },
};

export const FINISHER: Move = {
  name: 'finisher',
  keys: [
    key(0.10, 0.30, -0.08, -0.50, 0.32, 0.92, -0.22, 0.2),      // raised high on the right, tip up
    key(0.19, 0.12, -0.20, -0.48, -0.36, 0.52, -0.77, 0.15),    // coming down through the centre, tip forward-up-left
    key(0.28, -0.14, -0.44, -0.44, -0.72, -0.28, -0.63, 0.05),  // low left, tip below the frame centre
  ],
  windup: 0.10, slashEnd: 0.28, total: 0.44,
  damage: 16 / 12, stagger: 0.25, sweep: 0.5, hitStop: 0.06, fan: OVERHEAD,
  trail: { from: 0.5, color: white(1, 0.97, 0.88), alpha: 0.7, inner: 0.1, life: 0.15 },
};

export const HEAVY: Move = {
  name: 'heavy',
  keys: [
    key(0.06, 0.29, -0.03, -0.50, 0.30, 0.89, 0.36, 0.1),       // an extra pull back over the shoulder off the charge pose
    key(0.17, 0.08, -0.18, -0.52, -0.16, 0.58, -0.80, 0.05),    // the chop: blade forward-up through the centre, edge on
    key(0.30, -0.12, -0.50, -0.44, -0.56, -0.46, -0.69, 0.0),   // buried low left, tip below the frame
  ],
  windup: 0.06, slashEnd: 0.30, total: 0.62,
  damage: 2, stagger: 1, sweep: 0.35, hitStop: 0.08, fan: OVERHEAD,
  trail: { from: 0.34, color: white(1, 0.98, 0.94), alpha: 1.0, inner: 0.35, life: 0.22 },
};

export const COMBO: Move[] = [SLASH, BACKHAND, FINISHER];
