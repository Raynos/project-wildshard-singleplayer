import { discLayer as platformDiscLayer, type DiscLayerRow as PlatformDiscLayerRow } from '@wildshard/game/systems/looks/discLayer';

/** One horizontal disc as data: name, program, radius, segments, centre, render order and turn (SHARD-PLATFORM M3). */
export type DiscLayerRow<P extends string = string> = PlatformDiscLayerRow<P>;
/** A horizontal disc drawn by a shard's shader family (a cloud sea, a painted vortex, a mist floor). */
export const discLayer: typeof platformDiscLayer = platformDiscLayer;
