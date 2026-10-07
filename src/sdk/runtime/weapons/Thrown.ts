import { Thrown as PlatformThrown } from '@wildshard/engine/combat/Thrown';

/** A composing weapon's ammunition and fixed-step launch helper. */
export type ThrownInstance = PlatformThrown;
/** The one platform thrown helper constructor; the SDK adds no state or implementation. */
export const Thrown: typeof PlatformThrown = PlatformThrown;
