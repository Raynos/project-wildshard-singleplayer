import type { BowProfile as PlatformBowProfile, BowView as PlatformBowView, GripPose as PlatformGripPose } from '@wildshard/engine/combat/view/bowProfile';

/** Transitional content's named view styles; the engine accepts its caller's vocabulary. */
export type BowStyle = 'recurve' | 'golden' | 'sky-wolf';
/** Transitional kit name for the defining bow profile with today's style vocabulary. */
export type BowProfile = PlatformBowProfile<BowStyle>;
/** Transitional kit name for the injected bow model strategy. */
export type BowView = PlatformBowView<BowStyle>;
/** Transitional kit name for the authored view grip. */
export type GripPose = PlatformGripPose;
