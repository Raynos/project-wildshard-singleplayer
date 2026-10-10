import { FacetedSky as PlatformFacetedSky, type FacetedSkyGlsl as PlatformFacetedSkyGlsl, type SkyPalette as PlatformSkyPalette } from '@wildshard/game/systems/looks/facetedSky';

/** A faceted sky's palette (linear, pre-tonemap): what a day / night clock lerps per preset. */
export type SkyPalette = PlatformSkyPalette;
/** A faceted sky's dome and cloud programs as GLSL rows (SHARD-PLATFORM M3, look-family rows). */
export type FacetedSkyGlsl = PlatformFacetedSkyGlsl;
/** A gradient dome and a ring of faceted cumulus from the shard's GLSL rows, palette and seed. */
export const FacetedSky: typeof PlatformFacetedSky = PlatformFacetedSky;
