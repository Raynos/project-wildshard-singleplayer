import { facetedGroundPainter as platformFacetedGroundPainter, type FacetedGroundCell as PlatformFacetedGroundCell, type FacetedGroundPaint as PlatformFacetedGroundPaint, type FacetedGroundRow as PlatformFacetedGroundRow } from '@wildshard/game/systems/looks/facetedGround';

/** A faceted ground's numbers as data (SHARD-PLATFORM M3): patch, roughness, band, cliff lip and slab walls. */
export type FacetedGroundRow = PlatformFacetedGroundRow;
/** One grid vertex as a faceted ground's paint reads it. */
export type FacetedGroundCell = PlatformFacetedGroundCell;
/** A faceted ground's paint: writes one vertex's colour. */
export type FacetedGroundPaint = PlatformFacetedGroundPaint;
/** A terrain painter that builds a faceted, texture-free ground (one flat-coloured indexed grid and its slab walls). */
export const facetedGroundPainter: typeof platformFacetedGroundPainter = platformFacetedGroundPainter;
