import type { BowProfile as PlatformBowProfile, BowStyle as PlatformBowStyle, BowView as PlatformBowView, GripPose as PlatformGripPose } from '@wildshard/engine/combat/view/bowProfile';

/** Bow parameters with trusted injected view strategies; geometry stays in the owning recipe. */
export type BowProfile<Style extends string = string> = PlatformBowProfile<Style>;
/** Named transitional bow view strategy styles. */
export type BowStyle = PlatformBowStyle;
/** Host-supplied model, hand, sleeve and string-deformation strategy. */
export type BowView<Style extends string = string> = PlatformBowView<Style>;
/** Authored grip position and aim for a bow view. */
export type GripPose = PlatformGripPose;
