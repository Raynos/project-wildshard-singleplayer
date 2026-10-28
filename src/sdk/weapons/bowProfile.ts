import { parse, type InferOutput } from 'valibot';
import { BowWeaponProfileSchema, HeldBowFileSchema, type HeldBowFileRows } from '@wildshard/format/weaponProfiles';
import STARTER_BOW from '@wildshard/game/weapons/starterBow.json' with { type: 'json' };
import type { BowProfile as PlatformBowProfile, BowStyle as PlatformBowStyle, BowView as PlatformBowView, GripPose as PlatformGripPose } from '@wildshard/engine/combat/view/bowProfile';

/** Bow parameters with trusted injected view strategies; geometry stays in the owning recipe. */
export type BowProfile<Style extends string = string> = PlatformBowProfile<Style>;
/** Named transitional bow view strategy styles. */
export type BowStyle = PlatformBowStyle;
/** Host-supplied model, hand, sleeve and string-deformation strategy. */
export type BowView<Style extends string = string> = PlatformBowView<Style>;
/** Authored grip position and aim for a bow view. */
export type GripPose = PlatformGripPose;

/** Admit a complete authored bow file before its pool or display strategy is borrowed. */
export function parseHeldBowFile(input: unknown): HeldBowFileRows { return parse(HeldBowFileSchema, input); }

/** Admit numeric draw, flight, spread and ammunition policy without a weapon or view service. */
export function parseBowProfile(input: unknown): InferOutput<typeof BowWeaponProfileSchema> { return parse(BowWeaponProfileSchema, input); }

/** Compile an independent shared numeric bow base from its defining committed author table.
 * No wind owner, runtime profile object or view service enters the author result. */
export function sharedBowAuthorBase(): Omit<typeof STARTER_BOW, 'family'> & { family: 'bow' } {
  if (STARTER_BOW.family !== 'bow') throw new Error('Shared bow author base requires the bow family');
  return structuredClone({ ...STARTER_BOW, family: STARTER_BOW.family });
}
