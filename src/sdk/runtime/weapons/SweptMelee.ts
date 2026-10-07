import { SweptMelee as PlatformSweptMelee, type SwordOptions as PlatformSwordOptions, type SweptMeleeDefaults as PlatformDefaults, type MeleeEvents as PlatformEvents } from '@wildshard/engine/combat/view/SweptMelee';

/** The shared swept contact instance, with rig and move strategies supplied by content. */
export type SweptMeleeInstance = PlatformSweptMelee;
/** Explicit row, profile, input context and view options for a swept contact family. */
export type SweptMeleeOptions = PlatformSwordOptions;
/** Caller-supplied starter move identities and reaction hooks. */
export type SweptMeleeDefaults = PlatformDefaults;
/** Optional contact, swing and cover reactions from the owning runtime recipe. */
export type MeleeEvents = PlatformEvents;
/** The one platform swept contact constructor; the SDK supplies no starter moves or geometry. */
export const SweptMelee: typeof PlatformSweptMelee = PlatformSweptMelee;
