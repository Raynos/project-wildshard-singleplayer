import { Sword as StarterSword, swordEvents as StarterswordEvents, REACH as StarterREACH, HEAVY_CHARGE as StarterHEAVY_CHARGE, type SwordOptions as StarterOptions } from '@wildshard/game/weapons/Sword';

/** Options for the trusted starter sword constructor. */
export type SwordOptions = StarterOptions;
/** The one shared starter sword instance. */
export type SwordInstance = StarterSword;
/** The original starter Sword binding; all trusted callers share its identity. */
export const Sword: typeof StarterSword = StarterSword;
/** The original starter swordEvents binding; all trusted callers share its identity. */
export const swordEvents: typeof StarterswordEvents = StarterswordEvents;
/** The original starter REACH binding; all trusted callers share its identity. */
export const REACH: typeof StarterREACH = StarterREACH;
/** The original starter HEAVY_CHARGE binding; all trusted callers share its identity. */
export const HEAVY_CHARGE: typeof StarterHEAVY_CHARGE = StarterHEAVY_CHARGE;
