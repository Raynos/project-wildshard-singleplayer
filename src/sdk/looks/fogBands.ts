import { fogBandWindow as platformFogBandWindow } from '@wildshard/game/systems/looks/fogBands';

/** Write the window of layered fog bands a ray from the eye can reach (SHARD-PLATFORM M3). */
export const fogBandWindow: typeof platformFogBandWindow = platformFogBandWindow;
