import { bakedLook as platformBakedLook, bindRigid as platformBindRigid, createModelLibrary as platformCreateModelLibrary, facetMaterial as platformFacetMaterial, fitGeometry as platformFitGeometry, smoothColors as platformSmoothColors, undrawnRig as platformUndrawnRig, withoutTriangles as platformWithoutTriangles, type BakedLookRow as PlatformBakedLookRow, type HdLookRow as PlatformHdLookRow, type ModelFit as PlatformModelFit, type ModelLibrary as PlatformModelLibrary, type ModelLibraryRows as PlatformModelLibraryRows } from '@wildshard/game/plugin/geometry';

/** How a hero model's materials are dressed after the matte base (tint, roughness, fog, user flags, surface rows). */
export type HdLookRow = PlatformHdLookRow;
/** A model library's files and looks, as data: facet models, hero models, the AO floor, the hero dressing. */
export type ModelLibraryRows<M extends string, H extends string> = PlatformModelLibraryRows<M, H>;
/** How a copy is framed: turned, centred on x / z, its lowest point at a floor, sized by span or height. */
export type ModelFit = PlatformModelFit;
/** A loaded model library: preload once, then take copies of facet models and hero models. */
export type ModelLibrary<M extends string, H extends string> = PlatformModelLibrary<M, H>;
/** A model library over its rows; a failed file is a page fault opened by the caller's fault prefix. */
export const createModelLibrary: typeof platformCreateModelLibrary = platformCreateModelLibrary;
/** A zero-area skinned stand-in for a creature whose rig did not load. */
export const undrawnRig: typeof platformUndrawnRig = platformUndrawnRig;
/** The facet models' matte vertex-colour material. */
export const facetMaterial: typeof platformFacetMaterial = platformFacetMaterial;
/** Fit a geometry into a frame: turned, centred on x / z, its lowest point at a floor, sized by span or height. */
export const fitGeometry: typeof platformFitGeometry = platformFitGeometry;
/** Drop the triangles whose centroid a cut removes; disposes the input. */
export const withoutTriangles: typeof platformWithoutTriangles = platformWithoutTriangles;
/** Bind every triangle rigidly to the bone named for its centroid. */
export const bindRigid: typeof platformBindRigid = platformBindRigid;
/** Average a facet model's painted colour per vertex position. */
export const smoothColors: typeof platformSmoothColors = platformSmoothColors;
/** A baked body's species look as rows: its ids and rig contract. */
export type BakedLookRow = PlatformBakedLookRow;
/** A species look on a baked creature body, animated by its clip rows. */
export const bakedLook: typeof platformBakedLook = platformBakedLook;
