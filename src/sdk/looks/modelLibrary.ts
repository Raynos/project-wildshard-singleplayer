import { installPivotNpc as platformInstallPivotNpc, pivotNpc as platformPivotNpc, pivotNpcParts as platformPivotNpcParts, type PivotNpc as PlatformPivotNpc, type PivotNpcParts as PlatformPivotNpcParts, type PivotNpcPorts as PlatformPivotNpcPorts, bindRigid as platformBindRigid, createModelLibrary as platformCreateModelLibrary, facetMaterial as platformFacetMaterial, fitGeometry as platformFitGeometry, smoothColors as platformSmoothColors, undrawnRig as platformUndrawnRig, withoutTriangles as platformWithoutTriangles, type HdLookRow as PlatformHdLookRow, type ModelFit as PlatformModelFit, type ModelLibrary as PlatformModelLibrary, type ModelLibraryRows as PlatformModelLibraryRows } from '@wildshard/game/plugin/geometry';

/** How a hero model's materials are dressed after the matte base (tint, roughness, fog, user flags, surface rows). */
export type HdLookRow = PlatformHdLookRow;
/** A model library's files and looks, as data: facet models, hero models, baked rigs, the AO floor, the hero dressing. */
export type ModelLibraryRows<M extends string, H extends string, R extends string> = PlatformModelLibraryRows<M, H, R>;
/** How a copy is framed: turned, centred on x / z, its lowest point at a floor, sized by span or height. */
export type ModelFit = PlatformModelFit;
/** A loaded model library: preload once, then take copies of facet models, rigs and hero models. */
export type ModelLibrary<M extends string, H extends string, R extends string> = PlatformModelLibrary<M, H, R>;
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
/** A pivot NPC (SF27) in the world: its group, its talk anchor, its speaker and its per-frame motion. */
export type PivotNpc = PlatformPivotNpc;
/** A pivot NPC's figure on its pivots: the body, the head at the neck, the arm at the shoulder, the forearm at the elbow. */
export type PivotNpcParts = PlatformPivotNpcParts;
/** What installing a pivot NPC is lent: its model and material, the ground, the player, its met flag, its file and dressing. */
export type PivotNpcPorts = PlatformPivotNpcPorts;
/** A pivot NPC row's model fitted and cut onto its pivots, feet on y 0, facing +Z. */
export const pivotNpcParts: typeof platformPivotNpcParts = platformPivotNpcParts;
/** A pivot NPC row standing on the ground and moving by its motion row (no model: its talk anchor and speaker only). */
export const pivotNpc: typeof platformPivotNpc = platformPivotNpc;
/** Installs a pivot NPC row: its figure under the level root, its solid column when it has a collider, its motion each frame. */
export const installPivotNpc: typeof platformInstallPivotNpc = platformInstallPivotNpc;
