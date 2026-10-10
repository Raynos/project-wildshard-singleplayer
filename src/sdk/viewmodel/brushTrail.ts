import { BrushTrail as PlatformBrushTrail, type BrushTrailLook as PlatformBrushTrailLook } from '@wildshard/game/systems/viewmodel/brushTrail';

/** The brush trail's two looks: ink pigment or pale light. */
export type BrushTrailLook = PlatformBrushTrailLook;
/** A held blade's dry-brush slash ribbon (SHARD-PLATFORM M3, brush trail). */
export const BrushTrail: typeof PlatformBrushTrail = PlatformBrushTrail;
/** A brush trail (the instance type). */
export type BrushTrailView = PlatformBrushTrail;
