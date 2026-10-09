import { LashWeapon as PlatformLashWeapon, type LashParts as PlatformLashParts, type LashView as PlatformLashView } from '@wildshard/game/systems/items/lashWeapon';
import { lashSpec as platformLashSpec, type LashMoves as PlatformLashMoves, type LashSpec as PlatformLashSpec, type LashTarget as PlatformLashTarget, type LashTiming as PlatformLashTiming, type LashWorldTarget as PlatformLashWorldTarget } from '@wildshard/game/systems/items/lash';

/** The viewmodel's parts a lash weapon moves. */
export type LashParts = PlatformLashParts;
/** The lash weapon's view as rows: the hold, the spring, the flick and the wrap. */
export type LashView = PlatformLashView;
/** The lash's own timing (unroll, second lash, show, stagger, pull). */
export type LashTiming = PlatformLashTiming;
/** The lash's move ids. */
export type LashMoves = PlatformLashMoves;
/** The crack's numbers: the declared item row's with the lash's timing and moves. */
export type LashSpec = PlatformLashSpec;
/** A creature the lash strikes. */
export type LashTarget = PlatformLashTarget;
/** A world thing the lash can crack. */
export type LashWorldTarget = PlatformLashWorldTarget;
/** The crack's numbers from a declared item row, the lash's timing and its moves. */
export const lashSpec: typeof platformLashSpec = platformLashSpec;
/** A lash held as a weapon with a declared view (SHARD-PLATFORM SF72, a declared item view). */
export const LashWeapon: typeof PlatformLashWeapon = PlatformLashWeapon;
/** A built lash weapon. */
export type LashWeaponView = PlatformLashWeapon;
