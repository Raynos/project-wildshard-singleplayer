import { loadWrappedTexture as platformLoadWrappedTexture } from '@wildshard/game/systems/looks/wrappedTexture';

/** Load a colour texture that repeats along u, mipmapped and made GPU-only once drawn (SHARD-PLATFORM M3). */
export const loadWrappedTexture: typeof platformLoadWrappedTexture = platformLoadWrappedTexture;
