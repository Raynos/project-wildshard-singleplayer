import { FacetedOcean as PlatformFacetedOcean, type FacetedOceanDef as PlatformFacetedOceanDef, type FacetedOceanGlsl as PlatformFacetedOceanGlsl, type FacetedOceanLight as PlatformFacetedOceanLight, type FacetedOceanLook as PlatformFacetedOceanLook, type OceanColliderBox as PlatformOceanColliderBox, type OceanDryRect as PlatformOceanDryRect } from '@wildshard/game/systems/looks/facetedOcean';

/** A faceted sea's GLSL rows (SHARD-PLATFORM M3, look-family rows). */
export type FacetedOceanGlsl = PlatformFacetedOceanGlsl;
/** The sea as data: its still level, colours and full depth. */
export type FacetedOceanDef = PlatformFacetedOceanDef;
/** The light model's uniforms the sea reads. */
export type FacetedOceanLight = PlatformFacetedOceanLight;
/** A shard's sea look: rows, patch id and key, the grid's fine cell, the light. */
export type FacetedOceanLook = PlatformFacetedOceanLook;
/** A level-space rectangle the sea is clipped out of. */
export type OceanDryRect = PlatformOceanDryRect;
/** An oriented collider box the sea rings with foam. */
export type OceanColliderBox = PlatformOceanColliderBox;
/** A faceted stylized sea: a coarsening grid with Gerstner waves, a baked sea floor and foam rings, from the shard's rows. */
export const FacetedOcean: typeof PlatformFacetedOcean = PlatformFacetedOcean;
