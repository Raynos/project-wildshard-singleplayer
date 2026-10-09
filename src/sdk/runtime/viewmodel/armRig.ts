import {
  LEFT_HAND as PLATFORM_LEFT_HAND, RIGHT_HAND as PLATFORM_RIGHT_HAND, measure as platformMeasure,
  type HandSpec as PlatformHandSpec, type JointAngles as PlatformJointAngles,
} from '@wildshard/game/systems/viewmodel/armRig';

/** A hand in its owner's local frame: wrist, forearm axis and length, the hand's long and dorsal axes. */
export type HandSpec = PlatformHandSpec;
/** One arm's measured wrist pronation / flexion / deviation and elbow angles (degrees). */
export type JointAngles = PlatformJointAngles;
/** The right hand of the standard two-bone arm. */
export const RIGHT_HAND: typeof PLATFORM_RIGHT_HAND = PLATFORM_RIGHT_HAND;
/** The left hand of the standard two-bone arm. */
export const LEFT_HAND: typeof PLATFORM_LEFT_HAND = PLATFORM_LEFT_HAND;
/** Measure one arm's joint angles from shoulder, elbow, wrist and hand orientation. */
export const measure: typeof platformMeasure = platformMeasure;
