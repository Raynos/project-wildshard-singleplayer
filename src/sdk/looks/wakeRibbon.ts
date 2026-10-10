import { wakeRibbon as platformWakeRibbon, type WakeRibbon as PlatformWakeRibbon, type WakeRibbonRow as PlatformWakeRibbonRow } from '@wildshard/game/systems/looks/wakeRibbon';

/** A wake's row: samples, seconds between them, head width, linear colour and mesh name (SHARD-PLATFORM M3). */
export type WakeRibbonRow = PlatformWakeRibbonRow;
/** A wake's mesh and tick. */
export type WakeRibbon = PlatformWakeRibbon;
/** A luminous camera-facing ribbon along a moving thing's recent path, fading behind it (additive, no depth write). */
export const wakeRibbon: typeof platformWakeRibbon = platformWakeRibbon;
