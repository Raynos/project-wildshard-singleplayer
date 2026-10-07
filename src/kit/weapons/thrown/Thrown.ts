import { Thrown as PlatformThrown } from '@wildshard/engine/combat/Thrown';
import type { ThrownProfile as PlatformThrownProfile } from '@wildshard/engine/combat/thrownProfile';

/** Transitional kit name for the platform's authored ammunition and flight profile. */
export type ThrownProfile = PlatformThrownProfile;
/** The kit uses the one platform constructor and ammunition implementation. */
export const Thrown: typeof PlatformThrown = PlatformThrown;
