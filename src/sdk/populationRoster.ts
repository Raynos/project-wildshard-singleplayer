import { installPopulationRoster as platformInstall, type NativePopulationActor as PlatformActor,
  type DormantPopulationActor as PlatformDormant } from '@wildshard/game/population/roster';
import { parseNativePopulationRows } from '@wildshard/format/populationRoster';

/** Validate author rows before product emission; nothing materializes at build time. */
export const populationRoster: typeof parseNativePopulationRows = parseNativePopulationRows;
/** The game-owned native population implementation, with no duplicate SDK state or clock. */
export const installPopulationRoster: typeof platformInstall = platformInstall;
export type NativePopulationActor = PlatformActor;
export type DormantPopulationActor = PlatformDormant;
