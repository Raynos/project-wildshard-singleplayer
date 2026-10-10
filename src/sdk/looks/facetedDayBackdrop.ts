import { facetedDayBackdrop as platformFacetedDayBackdrop, type FacetedDayBackdropSpec as PlatformFacetedDayBackdropSpec, type FacetedDayLight as PlatformFacetedDayLight } from '@wildshard/game/systems/looks/facetedDayBackdrop';

/** The light model's tunables a faceted day turns. */
export type FacetedDayLight = PlatformFacetedDayLight;
/** What a faceted day backdrop is built from: the day, the sky's rows, the light and the cycle. */
export type FacetedDayBackdropSpec = PlatformFacetedDayBackdropSpec;
/** A faceted sky backdrop and its day / night clock (SHARD-PLATFORM M3, look-family rows). */
export const facetedDayBackdrop: typeof platformFacetedDayBackdrop = platformFacetedDayBackdrop;
