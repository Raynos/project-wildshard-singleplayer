import {
  HangingLanterns as PlatformHangingLanterns, clearHangingLanterns as platformClearHangingLanterns, hangingLanternPositions as platformHangingLanternPositions,
  lanternLathe as platformLanternLathe, lanternString as platformLanternString, updateHangingLanterns as platformUpdateHangingLanterns,
  type HangingLanternRow as PlatformHangingLanternRow,
} from '@wildshard/game/systems/looks/hangingLanterns';

/** A lantern set as data: its lathe, drop, glow, distance switches and draws' names. */
export type HangingLanternRow = PlatformHangingLanternRow;
/** Lathe-turned lanterns hung from hooks, culled into near / far / dot draws with their sway seeds (SHARD-PLATFORM M3). */
export const HangingLanterns: typeof PlatformHangingLanterns = PlatformHangingLanterns;
/** A lantern set (the instance type). */
export type HangingLanternsView = PlatformHangingLanterns;
/** The lantern's lathe (body, and caps + tassel when dressed), its parts in `aPart`. */
export const lanternLathe: typeof platformLanternLathe = platformLanternLathe;
/** A sagging lantern string: its cord and the hooks along it. */
export const lanternString: typeof platformLanternString = platformLanternString;
/** Bucket every built lantern set for this camera. */
export const updateHangingLanterns: typeof platformUpdateHangingLanterns = platformUpdateHangingLanterns;
/** Forget the built lantern sets. */
export const clearHangingLanterns: typeof platformClearHangingLanterns = platformClearHangingLanterns;
/** Where every built lantern hangs. */
export const hangingLanternPositions: typeof platformHangingLanternPositions = platformHangingLanternPositions;
