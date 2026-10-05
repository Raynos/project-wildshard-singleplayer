import { Firearm as PlatformFirearm } from '@wildshard/engine/combat/Firearm';

/** Trusted firearm trigger family for transitional shard runtime subclasses; views and tuning stay with the shard. */
export type FirearmInstance = PlatformFirearm;
/** The platform's one firearm constructor, preserving readiness, empty-trigger and reload hooks without a second implementation. */
export const Firearm: typeof PlatformFirearm = PlatformFirearm;
