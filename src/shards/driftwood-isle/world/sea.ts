import { swellBody, type WaterBody } from '#engine';
import { OCEAN } from '../manifest';

/** The sea as a `WaterBody` (08 §6.1 step 4): level 0.8, its surface on the swell; the plugin registers it in `app.world.water`. */
export const OCEAN_BODY: WaterBody = swellBody('sea', OCEAN.level);
