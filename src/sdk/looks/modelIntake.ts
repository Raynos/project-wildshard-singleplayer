import { facetedGeometry as platformFacetedGeometry, fitModel as platformFitModel, hdGeometry as platformHdGeometry, splitAbove as platformSplitAbove, splitTriangles as platformSplitTriangles, type ModelFrame as PlatformModelFrame } from '@wildshard/game/systems/looks/modelIntake';

/** How `fitModel` frames a geometry: its size by span or height, floor or middle, pitch and centring (SHARD-PLATFORM M3). */
export type ModelFrame = PlatformModelFrame;
/** The faceted intake: every mesh of a loaded scene as one flat geometry (position, AO-softened facet colour, flat normals). */
export const facetedGeometry: typeof platformFacetedGeometry = platformFacetedGeometry;
/** The textured intake: the first indexed, UV-mapped mesh a predicate accepts, as float position + uv with smooth normals. */
export const hdGeometry: typeof platformHdGeometry = platformHdGeometry;
/** Fit a loaded model's geometry into a frame (in place). */
export const fitModel: typeof platformFitModel = platformFitModel;
/** Split a geometry by triangle centroid, keeping every attribute: [the rest, the triangles a predicate claims]. */
export const splitTriangles: typeof platformSplitTriangles = platformSplitTriangles;
/** Split a flat vertex-coloured geometry by triangle centroid: [below a height, above it]. */
export const splitAbove: typeof platformSplitAbove = platformSplitAbove;
