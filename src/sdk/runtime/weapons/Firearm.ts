import { Firearm as PlatformFirearm } from '@wildshard/engine/combat/Firearm';

/** The platform's one firearm constructor, preserving readiness, empty-trigger and reload hooks without a second implementation. */
export const Firearm: typeof PlatformFirearm = PlatformFirearm;
