import { sheetTopology as platformSheetTopology, tubeTopology as platformTubeTopology } from '@wildshard/game/systems/kit/clothTopology';

/** Write a strand's static tube topology into a class kit (SHARD-PLATFORM M3). */
export const tubeTopology: typeof platformTubeTopology = platformTubeTopology;
/** Write a cloth sheet's static grid topology into an empty class kit (SHARD-PLATFORM M3). */
export const sheetTopology: typeof platformSheetTopology = platformSheetTopology;
