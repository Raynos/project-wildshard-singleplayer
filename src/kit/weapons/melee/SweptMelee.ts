import { Sword as StarterSword, swordEvents as StarterswordEvents, REACH as StarterREACH, HEAVY_CHARGE as StarterHEAVY_CHARGE, type SwordOptions as StarterOptions } from '@wildshard/game/weapons/Sword';

/** Options for the trusted starter sword constructor. */
export type SwordOptions = StarterOptions;
/** The one shared starter sword instance. */
export type SwordInstance = StarterSword;
/** Compatibility name for the original starter Sword binding; all trusted callers share its identity. */
// oxlint-disable-next-line eslint/no-redeclare -- TypeScript has separate value/type namespaces; retain the old class API while both names alias the one constructor.
export const Sword: typeof StarterSword = StarterSword;
/** Compatibility name for the original starter swordEvents binding; all trusted callers share its identity. */
export const swordEvents: typeof StarterswordEvents = StarterswordEvents;
/** Compatibility name for the original starter REACH binding; all trusted callers share its identity. */
export const REACH: typeof StarterREACH = StarterREACH;
/** Compatibility name for the original starter HEAVY_CHARGE binding; all trusted callers share its identity. */
export const HEAVY_CHARGE: typeof StarterHEAVY_CHARGE = StarterHEAVY_CHARGE;
/** Compatibility instance type for the one starter constructor. */
export type Sword = StarterSword;
