import { waitForFonts as platformWaitForFonts } from '@wildshard/game/systems/signs/fontWait';

/** Load every font spec for a text a canvas painter draws, or give up after a cap (SHARD-PLATFORM M3). */
export const waitForFonts: typeof platformWaitForFonts = platformWaitForFonts;
