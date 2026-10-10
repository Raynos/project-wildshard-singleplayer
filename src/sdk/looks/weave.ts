import { plainWeaveTexture as platformPlainWeaveTexture, silkWeaveTexture as platformSilkWeaveTexture } from '@wildshard/game/systems/looks/weave';

/** A seeded plain-weave grain texture (R8, repeating, mipmapped; SHARD-PLATFORM M3). */
export const plainWeaveTexture: typeof platformPlainWeaveTexture = platformPlainWeaveTexture;
/** A seeded plain-weave silk with slubs, normalised to the full range (R8, repeating, mipmapped; SHARD-PLATFORM M3). */
export const silkWeaveTexture: typeof platformSilkWeaveTexture = platformSilkWeaveTexture;
